import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import totIcon from './assets/image/tot.svg'
import aveIcon from './assets/image/ave.svg'
import besIcon from './assets/image/bes.svg'
import resIcon from './assets/image/res.svg'
import trendIcon from './assets/image/tre.svg'
import subjectIcon from './assets/image/sub.svg'
import filterIcon from './assets/image/fil.svg'
import { useAuth } from './auth/AuthContext.tsx'
import { useYear } from './auth/YearContext.tsx'
import engLogo from './assets/image/eng.jpg'
import schoolBadge from './assets/image/school-badge.jpg'
import DepartmentSnapshotReport from './components/DepartmentSnapshotReport.tsx'
import ReportDownloadModal from './components/ReportDownloadModal.tsx'
import SubjectClassProgressReport from './components/SubjectClassProgressReport.tsx'
import StudentAllSubjectsProgressReport from './components/StudentAllSubjectsProgressReport.tsx'
import StudentResultSlip from './components/StudentResultSlip.tsx'
import {
  PASS_MARK,
  PASS_NEAR,
  SECTIONS,
  type SectionName,
} from './data/overviewStats.ts'
import {
  loadOverviewBundle,
  setCachedStudents,
  setCachedSubjectId,
  setCachedSubjectName,
  setCachedTestLabels,
  type LiveStudent,
  type SubjectAverage,
} from './data/loadOverview.ts'
import { exportYearMarksCsv } from './data/exportYearMarksCsv.ts'
import {
  buildResultSlipsForAssessment,
  departmentDidNotWriteStudents,
  departmentMostImproved,
  departmentNearPassCount,
  departmentStudentNeedsResit,
  loadDepartmentResultsBundle,
  type AssessmentOption,
  type DepartmentStudent,
} from './data/loadStudentResults.ts'
import { friendlyError } from './lib/friendlyError.ts'
import {
  averageOf,
  formatScore,
  hasScore,
  maxOf,
  metTarget,
  formatResitsNeededStatus,
  needsResit,
  resolveStudentProgress,
  studentNeedsAnyResit,
} from './lib/marks.ts'
import { jsPDF } from 'jspdf'
import {
  downloadReport,
  stampSchoolBadgeOnEveryPage,
  type ReportDownloadFormat,
} from './lib/reportDownload.ts'
import { printReport } from './lib/printReport.ts'
import { sortSubjectDisplay, sortSubjects } from './lib/subjects.ts'
import { supabase, type SubjectRow } from './lib/supabase.ts'
import { fetchSubjectTeacherName } from './lib/subjectTeacher.ts'
import overviewReportCss from './components/StudentProgressReport.css?raw'
import overviewReportExtraCss from './components/OverviewReports.css?raw'
import allSubjectsProgressCss from './components/StudentAllSubjectsProgressReport.css?raw'
import resultSlipCss from './components/StudentResultSlip.css?raw'
import './components/ReportDownloadModal.css'
import './overview.css'

type StudentFilter = 'all' | 'top' | 'typical' | 'resit'
type SectionFilter = 'all' | SectionName
type ReportKind =
  | 'snapshot'
  | 'class-list'
  | 'results'
  | 'student-result'
  | 'progress'

const FILTER_OPTIONS: { value: StudentFilter; label: string }[] = [
  { value: 'all', label: 'All Students' },
  { value: 'top', label: 'Top Scores' },
  { value: 'typical', label: 'Typical Scores' },
  { value: 'resit', label: 'Needs Resit' },
]

const Y_MIN = 10
const Y_MAX = 100
const yTicks = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]
const barHeight = (value: number) =>
  `${((value - Y_MIN) / (Y_MAX - Y_MIN)) * 100}%`
const barWidth = (value: number) => `${Math.max(0, Math.min(100, value))}%`

const RING_R = 36
const RING_C = 2 * Math.PI * RING_R
const GAUGE_R = 34
const GAUGE_C = 2 * Math.PI * GAUGE_R

const ringFillFromDelta = (delta: number) =>
  Math.max(0, Math.min(100, 50 + delta))
const ringOffset = (fillPercent: number) => RING_C * (1 - fillPercent / 100)
const gaugeOffset = (percent: number) =>
  GAUGE_C * (1 - Math.max(0, Math.min(100, percent)) / 100)

const formatDelta = (delta: number) => {
  if (delta > 0) return `+${delta}%`
  if (delta < 0) return `${delta}%`
  return '0%'
}

export default function Overview() {
  const { user } = useAuth()
  const { years, yearId, year, openYearSwitcher } = useYear()
  const navigate = useNavigate()
  const location = useLocation()
  const { subjectId: subjectIdParam } = useParams()
  const subjectIdFromRoute = subjectIdParam ? Number(subjectIdParam) : null

  const isSupervisor = user?.role === 'supervisor'
  const teacherSubjectId = user?.role === 'teacher' ? user.subjectId : null
  const activeSubjectId = subjectIdFromRoute ?? teacherSubjectId
  const isDepartmentView = isSupervisor && !subjectIdFromRoute
  const viewKey = isDepartmentView
    ? 'department'
    : `subject-${activeSubjectId ?? 'none'}`

  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all')
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all')
  const [studentQuery, setStudentQuery] = useState('')
  const [dbSubjects, setDbSubjects] = useState<SubjectRow[]>([])
  const [leaving, setLeaving] = useState(false)
  const [students, setStudents] = useState<LiveStudent[]>([])
  const [testAverages, setTestAverages] = useState<
    { test: string; average: number | null; hasMarks: boolean }[]
  >([])
  const [subjectRows, setSubjectRows] = useState<SubjectAverage[]>([])
  const [activities, setActivities] = useState<string[]>([])
  const [didNotWrite, setDidNotWrite] = useState<LiveStudent[]>([])
  const reportRef = useRef<HTMLElement | null>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadFormat, setDownloadFormat] =
    useState<ReportDownloadFormat>('pdf')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [reportAction, setReportAction] = useState<'print' | 'download'>(
    'download',
  )
  const [reportSection, setReportSection] = useState<'all' | SectionName>('all')
  const [reportKind, setReportKind] = useState<ReportKind>('snapshot')
  const [reportAssessmentId, setReportAssessmentId] = useState<number | null>(
    null,
  )
  /** Selected test index for teacher/subject class progress list. */
  const [classListTestIndex, setClassListTestIndex] = useState(0)
  const [reportStudentId, setReportStudentId] = useState<number | null>(null)
  const [deptStudents, setDeptStudents] = useState<DepartmentStudent[]>([])
  const [deptAssessments, setDeptAssessments] = useState<AssessmentOption[]>(
    [],
  )
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(
    null,
  )
  const [deptSectionFilter, setDeptSectionFilter] =
    useState<SectionFilter>('all')
  const [deptStudentQuery, setDeptStudentQuery] = useState('')
  const [subjectTeacherName, setSubjectTeacherName] = useState<string | null>(
    null,
  )
  const [marksExportBusy, setMarksExportBusy] = useState(false)
  const [marksExportError, setMarksExportError] = useState<string | null>(null)

  useEffect(() => {
    setLeaving(false)
    setDownloadOpen(false)
    setDownloadError(null)
    setReportSection('all')
    setReportKind(isDepartmentView ? 'snapshot' : 'class-list')
    setReportStudentId(null)
    setExpandedStudentId(null)
  }, [location.pathname, isDepartmentView])

  useEffect(() => {
    if (isDepartmentView || activeSubjectId == null) {
      setSubjectTeacherName(null)
      return
    }
    if (user?.role === 'teacher' && user.subjectId === activeSubjectId) {
      setSubjectTeacherName(user.displayName ?? user.fullName ?? null)
      return
    }

    let cancelled = false
    void fetchSubjectTeacherName(activeSubjectId).then((name) => {
      if (!cancelled) setSubjectTeacherName(name)
    })

    return () => {
      cancelled = true
    }
  }, [
    activeSubjectId,
    isDepartmentView,
    user?.role,
    user?.subjectId,
    user?.displayName,
    user?.fullName,
  ])

  useEffect(() => {
    void supabase
      .from('subjects')
      .select('id, name, code')
      .order('id')
      .then(({ data }) => {
        if (data) setDbSubjects(sortSubjects(data as SubjectRow[]))
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadOverviewBundle({
      yearId,
      subjectId: isDepartmentView ? null : activeSubjectId,
    }).then((bundle) => {
      if (cancelled) return
      setStudents(bundle.students)
      setCachedStudents(bundle.students)
      setCachedTestLabels(bundle.testAverages.map((t) => t.test))
      setCachedSubjectName(
        isDepartmentView
          ? 'All subjects'
          : (bundle.subjectAverages.find((s) => s.subjectId === activeSubjectId)
              ?.subject ?? null),
      )
      setCachedSubjectId(isDepartmentView ? null : (activeSubjectId ?? null))
      setTestAverages(bundle.testAverages)
      setSubjectRows(bundle.subjectAverages)
      setActivities(bundle.activities)
      setDidNotWrite(bundle.didNotWrite)
      const markedIndexes = bundle.testAverages
        .map((t, i) => (t.hasMarks ? i : -1))
        .filter((i) => i >= 0)
      setClassListTestIndex(
        markedIndexes.length > 0
          ? markedIndexes[markedIndexes.length - 1]
          : Math.max(0, bundle.testAverages.length - 1),
      )
    })
    return () => {
      cancelled = true
    }
  }, [yearId, activeSubjectId, isDepartmentView])

  useEffect(() => {
    if (!isDepartmentView) {
      setDeptStudents([])
      setDeptAssessments([])
      return
    }
    let cancelled = false
    void loadDepartmentResultsBundle({ yearId }).then((bundle) => {
      if (cancelled) return
      setDeptStudents(bundle.students)
      setDeptAssessments(bundle.assessments)
      setReportAssessmentId((current) => {
        if (
          current != null &&
          bundle.assessments.some((a) => a.id === current)
        ) {
          return current
        }
        return bundle.assessments[bundle.assessments.length - 1]?.id ?? null
      })
    })
    return () => {
      cancelled = true
    }
  }, [yearId, isDepartmentView])

  const subjectsForGrid = sortSubjectDisplay(
    dbSubjects.length > 0
      ? dbSubjects.map((s) => {
          const live = subjectRows.find(
            (x) => x.subjectId === s.id || x.subject === s.name,
          )
          return {
            subjectId: s.id,
            subject: s.name,
            code: s.code,
            average: live?.average ?? null,
            hasMarks: live?.hasMarks ?? false,
            logo: live?.logo ?? engLogo,
          }
        })
      : subjectRows.map((s) => ({
          ...s,
          code: undefined as string | undefined,
        })),
  )

  const activeSubject =
    subjectsForGrid.find((s) => s.subjectId === activeSubjectId) ?? null

  useEffect(() => {
    if (isDepartmentView) {
      setCachedSubjectName('All subjects')
      setCachedSubjectId(null)
      return
    }
    if (activeSubject?.subject) setCachedSubjectName(activeSubject.subject)
    if (activeSubjectId != null) setCachedSubjectId(activeSubjectId)
  }, [activeSubject?.subject, activeSubjectId, isDepartmentView])

  const scoredSubjects = subjectsForGrid.filter(
    (s) => s.hasMarks && s.average != null,
  )
  const byAverage = [...scoredSubjects].sort(
    (a, b) => (b.average ?? 0) - (a.average ?? 0),
  )
  const strongest = byAverage[0] ?? null
  const weakest = byAverage[byAverage.length - 1] ?? null
  const orderedSubjects = subjectsForGrid

  const scoredStudents = students.filter((s) => hasScore(s.test2))
  const classAverage = isDepartmentView
    ? averageOf(deptStudents.map((s) => s.overallLatest))
    : averageOf(students.map((s) => s.test2))
  const bestScore = isDepartmentView
    ? maxOf(deptStudents.map((s) => s.overallLatest))
    : maxOf(students.map((s) => s.test2))
  const subjectsNeedingResit = scoredSubjects.filter((s) =>
    needsResit(s.average),
  )
  const subjectsOnTrack = scoredSubjects.filter(
    (s) => s.average != null && (s.average as number) >= PASS_MARK,
  )
  const resitsRequiredCount = isDepartmentView
    ? subjectsNeedingResit.length
    : students.filter((s) => studentNeedsAnyResit(s)).length
  const improvedCount = students.filter(
    (s) => hasScore(s.test1) && hasScore(s.test2) && s.test2 > s.test1,
  ).length
  const flatCount = students.filter(
    (s) => hasScore(s.test1) && hasScore(s.test2) && s.test2 === s.test1,
  ).length
  const declinedCount = students.filter(
    (s) => hasScore(s.test1) && hasScore(s.test2) && s.test2 < s.test1,
  ).length
  const targetMetCount = isDepartmentView
    ? subjectsOnTrack.length
    : students.filter((s) => metTarget(s.test2)).length
  const scoredCount = Math.max(
    isDepartmentView ? scoredSubjects.length : scoredStudents.length,
    1,
  )
  const targetMetPercent = Math.round((targetMetCount / scoredCount) * 100)
  const nearPassCount = isDepartmentView
    ? departmentNearPassCount(deptStudents, PASS_NEAR)
    : students.filter(
        (s) =>
          hasScore(s.test2) &&
          s.test2 < PASS_MARK &&
          s.test2 >= PASS_MARK - PASS_NEAR,
      ).length

  const attentionStudents = isDepartmentView
    ? [...deptStudents]
        .filter((s) => departmentStudentNeedsResit(s))
        .sort(
          (a, b) =>
            (a.overallLatest ?? 999) - (b.overallLatest ?? 999) ||
            a.name.localeCompare(b.name),
        )
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          name: s.name,
          section: s.section,
          test1: null as number | null,
          test2: s.overallLatest,
        }))
    : [...students]
        .filter(
          (s) =>
            studentNeedsAnyResit(s) ||
            (hasScore(s.test1) && hasScore(s.test2) && s.test2 < s.test1),
        )
        .sort(
          (a, b) =>
            (b.test2 ?? -1) - (a.test2 ?? -1) || a.name.localeCompare(b.name),
        )
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          name: s.name,
          section: s.section,
          test1: s.test1,
          test2: s.test2,
        }))

  const mostImproved = isDepartmentView
    ? departmentMostImproved(deptStudents)
    : [...students]
        .filter((s) => hasScore(s.test1) && hasScore(s.test2))
        .map((s) => ({
          id: s.id,
          name: s.name,
          section: s.section,
          gain: (s.test2 as number) - (s.test1 as number),
          test2: s.test2,
        }))
        .filter((s) => s.gain > 0)
        .sort((a, b) => b.gain - a.gain)
        .slice(0, 5)

  const didNotWritePanel = isDepartmentView
    ? departmentDidNotWriteStudents(deptStudents).map((s) => ({
        id: s.id,
        name: s.name,
        section: s.section,
        studentId: s.studentId,
        photo: s.photo,
        test1: null as number | null,
        test2: s.overallLatest,
        scores: [] as (number | null)[],
        attempts: [] as LiveStudent['attempts'],
        resitsWritten: 0,
        resitsNeeded: [] as LiveStudent['resitsNeeded'],
        absent: true,
        latestFirstSit: null as number | null,
        latestResit: null as number | null,
        latestHasResit: false,
      }))
    : didNotWrite

  const trackedStudentCount = isDepartmentView
    ? deptStudents.length
    : students.length
  const resitPressurePool = isDepartmentView
    ? Math.max(scoredSubjects.length, 1)
    : students.length
  const resitPressureUnit = isDepartmentView ? 'subjects' : 'students'

  const sectionStats = SECTIONS.map((section) => {
    const members = students.filter((s) => s.section === section)
    const average = averageOf(members.map((s) => s.test2))
    return { section, average, count: members.length }
  })
  const sectionMax = Math.max(
    ...sectionStats.map((s) => s.average ?? 0),
    1,
  )

  const query = studentQuery.trim().toLowerCase()
  const filteredStudents = students.filter((student) => {
    const matchesFilter =
      studentFilter === 'all'
        ? true
        : studentFilter === 'top'
          ? metTarget(student.test2)
          : studentFilter === 'resit'
            ? studentNeedsAnyResit(student)
            : hasScore(student.test2) &&
              classAverage != null &&
              Math.abs(student.test2 - classAverage) <= 10
    const matchesSection =
      sectionFilter === 'all' || student.section === sectionFilter
    if (!matchesFilter || !matchesSection) return false
    if (!query) return true
    return (
      String(student.id).includes(query) ||
      student.studentId.includes(query) ||
      student.name.toLowerCase().includes(query)
    )
  })

  const OVERVIEW_VISIBLE = 6
  const visibleStudents =
    studentFilter === 'all'
      ? filteredStudents
      : filteredStudents.slice(0, OVERVIEW_VISIBLE)

  const cards = [
    {
      tone: 'blue' as const,
      label: 'Total Students',
      value: trackedStudentCount,
      icon: totIcon,
      to: '/total-students' as string | null,
    },
    {
      tone: 'green' as const,
      label: 'Average Score',
      value: classAverage != null ? `${classAverage}%` : '—',
      icon: aveIcon,
      to: null,
    },
    {
      tone: 'orange' as const,
      label: 'Best Score',
      value: bestScore != null ? `${bestScore}%` : '—',
      icon: besIcon,
      to: '/best-score',
    },
    {
      tone: 'red' as const,
      label: 'Resits Required',
      value: resitsRequiredCount,
      icon: resIcon,
      to: '/resits-required',
    },
  ]

  const exportMarksSpreadsheet = async () => {
    if (yearId == null) {
      setMarksExportError('Choose an academic year before exporting marks.')
      return
    }
    setMarksExportBusy(true)
    setMarksExportError(null)
    try {
      const yearText = years.find((y) => y.id === yearId)?.label ?? 'Current-year'
      await exportYearMarksCsv({
        yearId,
        yearLabel: yearText,
      })
    } catch (error) {
      setMarksExportError(
        friendlyError(
          error,
          'Could not export marks. Check your connection and try again.',
        ),
      )
    } finally {
      setMarksExportBusy(false)
    }
  }

  const exportSummary = async () => {
    const yearText = years.find((y) => y.id === yearId)?.label ?? 'N/A'
    const modeText = isDepartmentView
      ? 'Department'
      : (activeSubject?.subject ?? 'Subject')
    const fileBase = `BMI-${modeText.replace(/\s+/g, '-')}-Overview-Summary-${yearText.replace(/\s+/g, '-')}`
    const trackedStudents = trackedStudentCount

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })
    pdf.setProperties({
      title: fileBase,
      subject: 'BMI Progress System overview summary',
      creator: 'BMI Progress System',
    })

    const margin = 18
    const pageWidth = pdf.internal.pageSize.getWidth()
    let y = 24

    pdf.setTextColor(30, 0, 88)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text('Bediako Memorial Institute', margin, y)
    y += 7
    pdf.setFontSize(11)
    pdf.setTextColor(0, 168, 204)
    pdf.text('BMI · Official Overview Summary', margin, y)
    y += 5
    pdf.setDrawColor(201, 162, 39)
    pdf.setLineWidth(0.7)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 10

    pdf.setTextColor(91, 82, 120)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`Academic year: ${yearText}`, margin, y)
    pdf.text(`View: ${modeText}`, margin + 70, y)
    pdf.text(
      `Issued: ${new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
      margin + 120,
      y,
    )
    y += 10

    const kpiCards: [string, string][] = [
      ['Students', String(trackedStudents)],
      ['Average', classAverage != null ? `${classAverage}%` : '—'],
      ['Best score', bestScore != null ? `${bestScore}%` : '—'],
      [
        isDepartmentView ? 'Subjects below' : 'Need resit',
        String(resitsRequiredCount),
      ],
      [
        isDepartmentView ? 'Subjects on track' : 'On track',
        String(targetMetCount),
      ],
      [
        `Near ${PASS_MARK}%`,
        String(nearPassCount),
      ],
    ]

    const cardW = (pageWidth - margin * 2 - 10) / 3
    const cardH = 18
    kpiCards.forEach(([label, value], index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
      const x = margin + col * (cardW + 5)
      const cy = y + row * (cardH + 5)
      pdf.setFillColor(255, 254, 249)
      pdf.setDrawColor(215, 201, 163)
      pdf.roundedRect(x, cy, cardW, cardH, 2, 2, 'FD')
      pdf.setTextColor(91, 82, 120)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.text(label.toUpperCase(), x + 4, cy + 6)
      pdf.setTextColor(26, 18, 64)
      pdf.setFontSize(13)
      pdf.text(value, x + 4, cy + 14)
    })
    y += cardH * 2 + 16

    pdf.setTextColor(26, 18, 64)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('Highlights', margin, y)
    y += 7
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(40, 40, 40)
    pdf.text(
      `Strongest: ${
        strongest
          ? `${strongest.subject} (${strongest.average ?? '—'}%)`
          : '—'
      }`,
      margin,
      y,
    )
    y += 6
    pdf.text(
      `Needs attention: ${
        weakest ? `${weakest.subject} (${weakest.average ?? '—'}%)` : '—'
      }`,
      margin,
      y,
    )
    y += 10

    if (isDepartmentView && subjectsForGrid.length > 0) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(26, 18, 64)
      pdf.text('Subject averages', margin, y)
      y += 6
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      for (const subject of subjectsForGrid) {
        const avg =
          subject.hasMarks && subject.average != null
            ? `${subject.average}%`
            : 'No marks yet'
        const status =
          subject.hasMarks && subject.average != null
            ? subject.average >= PASS_MARK
              ? 'On target'
              : 'Below target'
            : '—'
        pdf.setTextColor(40, 40, 40)
        pdf.text(subject.subject, margin, y)
        pdf.text(avg, margin + 95, y)
        pdf.text(status, margin + 120, y)
        y += 6
        if (y > 265) {
          pdf.addPage()
          y = 24
        }
      }
    }

    y = Math.max(y + 10, 278)
    pdf.setFontSize(8)
    pdf.setTextColor(90)
    pdf.text(
      'Official BMI overview summary · Knowledge · Skills · Values',
      margin,
      Math.min(y, 287),
    )

    await stampSchoolBadgeOnEveryPage(pdf)
    pdf.save(`${fileBase}.pdf`)
  }

  const goBackFromSubject = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => {
      navigate('/overview')
      setLeaving(false)
    }, 180)
  }

  const staffName = user?.displayName ?? user?.fullName ?? 'Staff'
  const reportTeacherName =
    user?.role === 'teacher'
      ? staffName
      : (subjectTeacherName?.trim() || 'Not assigned')
  const yearLabel = year?.label ?? 'Current year'
  const subjectLabel = activeSubject?.subject ?? 'Subject'
  const reportStudents =
    isDepartmentView || reportSection === 'all'
      ? students
      : students.filter((s) => s.section === reportSection)
  const reportSectionLabel =
    reportSection === 'all' ? 'All sections' : reportSection
  const classListTestLabel =
    testAverages[classListTestIndex]?.test ??
    `Test ${classListTestIndex + 1}`
  const selectedAssessment =
    deptAssessments.find((a) => a.id === reportAssessmentId) ?? null
  const resultSlips =
    reportKind === 'results' || reportKind === 'student-result'
      ? reportAssessmentId != null
        ? buildResultSlipsForAssessment({
            students: deptStudents,
            assessments: deptAssessments,
            assessmentId: reportAssessmentId,
            section:
              reportKind === 'student-result' ? 'all' : reportSection,
            studentId:
              reportKind === 'student-result'
                ? (reportStudentId ?? undefined)
                : undefined,
          })
        : []
      : []
  const progressReportStudents =
    reportKind === 'progress'
      ? deptStudents.filter((student) =>
          reportSection === 'all' ? true : student.section === reportSection,
        )
      : []
  const reportFileBase =
    reportKind === 'results' || reportKind === 'student-result'
      ? `BMI-Results-${(selectedAssessment?.name ?? 'Assessment').replace(/\s+/g, '-')}-${
          reportKind === 'student-result'
            ? (resultSlips[0]?.studentId ?? 'Student')
            : reportSectionLabel.replace(/\s+/g, '-')
        }-${yearLabel.replace(/\s+/g, '-')}`
      : reportKind === 'progress'
        ? `BMI-Student-Progress-${reportSectionLabel.replace(/\s+/g, '-')}-${yearLabel.replace(/\s+/g, '-')}`
        : reportKind === 'class-list'
          ? `BMI-${subjectLabel.replace(/\s+/g, '-')}-${classListTestLabel.replace(/\s+/g, '-')}-${reportSectionLabel.replace(/\s+/g, '-')}-${yearLabel.replace(/\s+/g, '-')}`
          : isDepartmentView
            ? `BMI-Department-Snapshot-${yearLabel.replace(/\s+/g, '-')}`
            : `BMI-${subjectLabel.replace(/\s+/g, '-')}-${reportSectionLabel.replace(/\s+/g, '-')}-Class-Progress-${yearLabel.replace(/\s+/g, '-')}`

  const openClassListModal = (action: 'print' | 'download') => {
    setReportKind('class-list')
    setReportAction(action)
    setDownloadError(null)
    if (testAverages.length > 0) {
      const markedIndexes = testAverages
        .map((t, i) => (t.hasMarks ? i : -1))
        .filter((i) => i >= 0)
      setClassListTestIndex(
        markedIndexes.length > 0
          ? markedIndexes[markedIndexes.length - 1]
          : testAverages.length - 1,
      )
    }
    setDownloadOpen(true)
  }

  const openSnapshotModal = (action: 'print' | 'download') => {
    setReportKind('snapshot')
    setReportAction(action)
    setDownloadError(null)
    setDownloadOpen(true)
  }

  const openProgressModal = (action: 'print' | 'download') => {
    setReportKind('progress')
    setReportAction(action)
    setDownloadError(null)
    setReportSection('all')
    setDownloadOpen(true)
  }

  const openResultsModal = (
    action: 'print' | 'download',
    studentId?: number,
  ) => {
    setReportKind(studentId != null ? 'student-result' : 'results')
    setReportStudentId(studentId ?? null)
    setReportAction(action)
    setDownloadError(null)
    if (reportAssessmentId == null && deptAssessments.length > 0) {
      setReportAssessmentId(deptAssessments[deptAssessments.length - 1].id)
    }
    if (studentId == null) setReportSection('all')
    setDownloadOpen(true)
  }

  const runOfficialExport = async () => {
    if (
      (reportKind === 'results' || reportKind === 'student-result') &&
      reportAssessmentId == null
    ) {
      setDownloadError('Choose a test to continue.')
      return
    }
    if (reportKind === 'class-list' && testAverages.length === 0) {
      setDownloadError('No tests available for this subject yet.')
      return
    }
    if (
      (reportKind === 'results' || reportKind === 'student-result') &&
      resultSlips.length === 0
    ) {
      setDownloadError('No student results found for that selection.')
      return
    }
    if (reportKind === 'progress' && progressReportStudents.length === 0) {
      setDownloadError('No students found for that section.')
      return
    }
    if (reportAction === 'print') {
      setDownloadOpen(false)
      const node = reportRef.current
      const sheet = node?.closest('.overview__print-sheet') as HTMLElement | null
      void printReport(50, sheet ?? node)
      return
    }
    const node = reportRef.current
    const sheet = node?.parentElement
    if (!node || !sheet) {
      setDownloadError('Report is not ready.')
      return
    }
    setDownloading(true)
    setDownloadError(null)
    sheet.classList.add('is-capturing')
    try {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      await downloadReport(
        node,
        reportFileBase,
        downloadFormat,
        `${overviewReportCss}\n${overviewReportExtraCss}\n${resultSlipCss}\n${allSubjectsProgressCss}`,
      )
      setDownloadOpen(false)
    } catch {
      setDownloadError('Could not prepare the download. Try again.')
    } finally {
      sheet.classList.remove('is-capturing')
      setDownloading(false)
    }
  }

  const filteredDeptStudents = deptStudents.filter((student) => {
    if (
      deptSectionFilter !== 'all' &&
      student.section !== deptSectionFilter
    ) {
      return false
    }
    const q = deptStudentQuery.trim().toLowerCase()
    if (!q) return true
    return (
      student.name.toLowerCase().includes(q) ||
      student.studentId.toLowerCase().includes(q) ||
      String(student.id).includes(q)
    )
  })

  const assessmentOptions = deptAssessments.map((assessment) => ({
    value: String(assessment.id),
    label: assessment.name,
  }))

  const classListTestOptions = testAverages.map((test, index) => ({
    value: String(index),
    label: test.hasMarks ? test.test : `${test.test} (no marks yet)`,
  }))

  const subjectsNeedingAttention = [...scoredSubjects]
    .filter((s) => needsResit(s.average))
    .sort(
      (a, b) =>
        (b.average ?? 0) - (a.average ?? 0) ||
        a.subject.localeCompare(b.subject),
    )
    .slice(0, 5)

  const classSectionOptions = [
    { value: 'all', label: 'All sections' },
    ...SECTIONS.map((section) => ({ value: section, label: section })),
  ]

  const resultsModal =
    reportKind === 'results' || reportKind === 'student-result'
  const classListModal = reportKind === 'class-list'
  const progressModal = reportKind === 'progress'
  const downloadModal = downloadOpen ? (
    <div className="no-print">
      <ReportDownloadModal
        title={
          reportKind === 'results'
            ? reportAction === 'print'
              ? 'Print student results'
              : 'Download student results'
            : reportKind === 'student-result'
              ? reportAction === 'print'
                ? 'Print student result'
                : 'Download student result'
              : progressModal
                ? reportAction === 'print'
                  ? 'Print progress reports'
                  : 'Download progress reports'
                : classListModal
                  ? reportAction === 'print'
                    ? 'Print class progress list'
                    : 'Save class progress list'
                  : isDepartmentView
                    ? reportAction === 'print'
                      ? 'Print department snapshot'
                      : 'Save department snapshot'
                    : reportAction === 'print'
                      ? 'Print class progress list'
                      : 'Save class progress list'
        }
        description={
          reportKind === 'results'
            ? 'Choose the test and section. Each student gets an individual BECE-style result slip.'
            : reportKind === 'student-result'
              ? 'Choose which test result slip to prepare for this student.'
              : progressModal
                ? 'Each student gets one progress report across all subjects. Choose all students or filter by section.'
                : classListModal
                  ? `Choose one test (with its resits) and the section for the ${subjectLabel} class list.`
                  : isDepartmentView
                    ? reportAction === 'print'
                      ? 'Print the department snapshot for all subjects.'
                      : 'Choose a file type for the department snapshot.'
                    : `Choose options for the ${subjectLabel} class progress list.`
        }
        format={downloadFormat}
        onFormatChange={setDownloadFormat}
        onCancel={() => setDownloadOpen(false)}
        onConfirm={() => void runOfficialExport()}
        downloading={downloading}
        error={downloadError}
        confirmLabel={reportAction === 'print' ? 'Print' : 'Download'}
        showFormat={reportAction === 'download'}
        assessmentOptions={
          resultsModal
            ? assessmentOptions
            : classListModal
              ? classListTestOptions
              : undefined
        }
        assessment={
          resultsModal && reportAssessmentId != null
            ? String(reportAssessmentId)
            : classListModal
              ? String(classListTestIndex)
              : undefined
        }
        onAssessmentChange={
          resultsModal
            ? (value) => setReportAssessmentId(Number(value))
            : classListModal
              ? (value) => setClassListTestIndex(Number(value))
              : undefined
        }
        sectionOptions={
          reportKind === 'results' || classListModal || progressModal
            ? classSectionOptions
            : undefined
        }
        section={
          reportKind === 'results' || classListModal || progressModal
            ? reportSection
            : undefined
        }
        onSectionChange={
          reportKind === 'results' || classListModal || progressModal
            ? (value) => setReportSection(value as 'all' | SectionName)
            : undefined
        }
      />
    </div>
  ) : null

  const printSheet = (
    <div className="overview__print-sheet" aria-hidden="true">
      <div className="report-print-underlay" aria-hidden="true">
        <img src={schoolBadge} alt="" />
      </div>
      {reportKind === 'results' || reportKind === 'student-result' ? (
        <div
          className="overview__result-batch"
          ref={(node) => {
            reportRef.current = node
          }}
        >
          {resultSlips.map((slip, index) => (
            <StudentResultSlip
              key={`${slip.id}-${slip.assessmentId}`}
              slip={slip}
              yearLabel={yearLabel}
              supervisorName={staffName}
              pageBreakAfter={index < resultSlips.length - 1}
            />
          ))}
        </div>
      ) : reportKind === 'progress' ? (
        <div
          className="overview__result-batch"
          ref={(node) => {
            reportRef.current = node
          }}
        >
          {progressReportStudents.map((student, index) => (
            <StudentAllSubjectsProgressReport
              key={student.id}
              student={student}
              assessments={deptAssessments}
              yearLabel={yearLabel}
              supervisorName={staffName}
              pageBreakAfter={index < progressReportStudents.length - 1}
            />
          ))}
        </div>
      ) : isDepartmentView ? (
        <DepartmentSnapshotReport
          reportRef={reportRef}
          subjects={subjectsForGrid}
          studentCount={trackedStudentCount}
          yearLabel={yearLabel}
          supervisorName={staffName}
          strongest={strongest}
          weakest={weakest}
          resitCount={resitsRequiredCount}
          targetMetCount={targetMetCount}
          departmentAverage={
            scoredSubjects.length === 0
              ? null
              : Math.round(
                  scoredSubjects.reduce(
                    (sum, s) => sum + (s.average as number),
                    0,
                  ) / scoredSubjects.length,
                )
          }
        />
      ) : (
        <SubjectClassProgressReport
          reportRef={reportRef}
          students={reportStudents}
          subjectName={subjectLabel}
          yearLabel={yearLabel}
          teacherName={reportTeacherName}
          testLabel={classListTestLabel}
          assessmentIndex={classListTestIndex}
          sectionLabel={reportSectionLabel}
        />
      )}
    </div>
  )

  if (isDepartmentView) {
    return (
      <main className="overview">
        <div className="overview__content zoom-in" key={viewKey}>
          <OverviewTopBar
            title="Department Overview"
            subtitle={year?.label ?? 'Department'}
            yearLabel={year?.label ?? '—'}
            canSwitchYear={isSupervisor}
            onSwitchYear={openYearSwitcher}
            isSupervisor={isSupervisor}
          />

          <div className="overview__report-bar no-print">
            <div>
              <p className="overview__report-bar-title">Official reports</p>
              <p className="overview__report-bar-lead">
                Department snapshot, full student progress across all subjects,
                or BECE-style results by test and section.
              </p>
            </div>
            <div className="overview__report-bar-actions">
              <button
                type="button"
                className="overview__quick-btn"
                onClick={() => openSnapshotModal('print')}
              >
                Print snapshot
              </button>
              <button
                type="button"
                className="overview__quick-btn"
                onClick={() => openSnapshotModal('download')}
              >
                Download snapshot
              </button>
              <button
                type="button"
                className="overview__quick-btn is-navy"
                onClick={() => openProgressModal('print')}
                disabled={deptStudents.length === 0}
              >
                Print progress
              </button>
              <button
                type="button"
                className="overview__quick-btn is-navy"
                onClick={() => openProgressModal('download')}
                disabled={deptStudents.length === 0}
              >
                Download progress
              </button>
              <button
                type="button"
                className="overview__quick-btn is-gold"
                onClick={() => openResultsModal('print')}
                disabled={deptAssessments.length === 0}
              >
                Print results
              </button>
              <button
                type="button"
                className="overview__quick-btn is-gold"
                onClick={() => openResultsModal('download')}
                disabled={deptAssessments.length === 0}
              >
                Download results
              </button>
            </div>
          </div>

          <div className="overview__callout overview__callout--gold">
            {strongest && weakest ? (
              <>
                Strongest <strong>{strongest.subject}</strong> {strongest.average}%
                {' · '}
                Needs attention <strong>{weakest.subject}</strong>{' '}
                {weakest.average}%
              </>
            ) : (
              <>No subject marks recorded yet</>
            )}
          </div>

          <div className="overview__subject-grid">
            {subjectsForGrid.length === 0 ? (
              <p className="overview__student-empty">No subjects found.</p>
            ) : (
              subjectsForGrid.map((subject) => (
                <button
                  key={subject.subjectId}
                  type="button"
                  className="overview__subject-tile"
                  onClick={() =>
                    navigate(`/overview/subject/${subject.subjectId}`)
                  }
                >
                  <img src={subject.logo} alt="" />
                  <span>
                    <strong>{subject.subject}</strong>
                    <small>
                      {subject.hasMarks && subject.average != null
                        ? `Avg ${subject.average}%`
                        : 'No marks yet'}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="overview__charts">
            <section className="overview__chart-card">
              <div className="overview__chart-head">
                <h2 className="overview__chart-title">
                  <img src={trendIcon} alt="" />
                  Performance Trend
                </h2>
                <p className="overview__chart-subtitle">Average by subject</p>
              </div>
              <div className="bar-chart" role="img" aria-label="Subject trend">
                <div className="bar-chart__plot">
                  <div className="bar-chart__grid" aria-hidden="true">
                    {yTicks.map((tick) => (
                      <div className="bar-chart__grid-row" key={tick}>
                        <span>{tick}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="bar-chart__scroll">
                    <div className="bar-chart__bars">
                      {scoredSubjects.length === 0 ? (
                        <p className="overview__student-empty">
                          No subject marks recorded yet.
                        </p>
                      ) : (
                        scoredSubjects.map((item) => (
                          <div className="bar-chart__col" key={item.subjectId}>
                            <span className="bar-chart__value">
                              {item.average}%
                            </span>
                            <div className="bar-chart__track">
                              <div
                                className={`bar-chart__bar${
                                  item.subjectId === strongest?.subjectId
                                    ? ' is-latest'
                                    : ''
                                }${
                                  needsResit(item.average) ? ' is-warn' : ''
                                }`}
                                style={{
                                  height: barHeight(item.average as number),
                                }}
                              />
                            </div>
                            <span className="bar-chart__label">
                              {item.subject.split(' ')[0]}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="overview__chart-card">
              <div className="overview__chart-head">
                <h2 className="overview__chart-title">
                  <img src={subjectIcon} alt="" />
                  Subject Performance
                </h2>
                <p className="overview__chart-subtitle">Class averages</p>
              </div>
              <div className="subject-bars">
                {orderedSubjects.map((item, i) => (
                  <button
                    type="button"
                    className="subject-bars__row subject-bars__row--btn"
                    key={item.subjectId}
                    onClick={() =>
                      navigate(`/overview/subject/${item.subjectId}`)
                    }
                  >
                    <div className="subject-bars__label">
                      <img
                        className="subject-bars__logo"
                        src={item.logo}
                        alt=""
                      />
                      <span className="subject-bars__name">{item.subject}</span>
                    </div>
                    <div className="subject-bars__track">
                      <div
                        className={`subject-bars__bar${
                          needsResit(item.average) ? ' is-warn' : ''
                        }`}
                        style={{
                          width: barWidth(item.average ?? 0),
                          animationDelay: `${i * 0.06}s`,
                        }}
                      />
                    </div>
                    <span className="subject-bars__value">
                      {item.hasMarks && item.average != null
                        ? `${item.average}%`
                        : '—'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="overview__insights" aria-label="Subject insights">
            <div className="overview__insights-grid overview__insights-grid--dept">
              <article className="insight-card insight-card--attention">
                <div className="insight-card__head">
                  <h2 className="insight-card__title">Needs Attention</h2>
                  <p className="insight-card__subtitle">
                    Subjects below {PASS_MARK}%
                  </p>
                </div>
                <ul className="insight-attention">
                  {subjectsNeedingAttention.length === 0 ? (
                    <li>
                      <div className="insight-attention__row is-empty">
                        <span className="insight-attention__meta">
                          <strong>All subjects on track</strong>
                          <small>None below {PASS_MARK}%</small>
                        </span>
                      </div>
                    </li>
                  ) : (
                    subjectsNeedingAttention.map((subject) => (
                      <li key={subject.subjectId}>
                        <button
                          type="button"
                          className="insight-attention__row"
                          onClick={() =>
                            navigate(`/overview/subject/${subject.subjectId}`)
                          }
                        >
                          <img
                            className="insight-attention__logo"
                            src={subject.logo}
                            alt=""
                          />
                          <span className="insight-attention__meta">
                            <strong>{subject.subject}</strong>
                            <small>Avg {subject.average ?? '—'}%</small>
                          </span>
                          <span className="insight-attention__delta is-down">
                            {subject.average ?? '—'}%
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </article>
            </div>
          </section>

          <section className="overview__students no-print">
            <div className="overview__students-head">
              <div>
                <h2 className="overview__chart-title">Student results</h2>
                <p className="overview__chart-subtitle">
                  Expand a student for progress across all subjects. Use Print /
                  Download progress above for full multi-subject reports by
                  section, or prepare a BECE-style result for any test.
                </p>
              </div>
            </div>

            <div className="overview__section-chips">
              <button
                type="button"
                className={deptSectionFilter === 'all' ? 'is-active' : ''}
                onClick={() => setDeptSectionFilter('all')}
              >
                All sections
              </button>
              {SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  className={deptSectionFilter === section ? 'is-active' : ''}
                  onClick={() => setDeptSectionFilter(section)}
                >
                  {section}
                </button>
              ))}
            </div>

            <div className="overview__student-filters">
              <label className="overview__student-search">
                <span className="visually-hidden">Search students</span>
                <input
                  type="search"
                  value={deptStudentQuery}
                  onChange={(e) => setDeptStudentQuery(e.target.value)}
                  placeholder="Search by ID or name"
                />
              </label>
              <p className="overview__student-count">
                {`Showing ${filteredDeptStudents.length} of ${deptStudents.length} students`}
              </p>
            </div>

            <div className="overview__dept-student-list">
              {filteredDeptStudents.length === 0 ? (
                <p className="overview__student-empty">
                  No students match this section or search.
                </p>
              ) : (
                filteredDeptStudents.map((student) => {
                  const expanded = expandedStudentId === student.id
                  const scoredSubjects = student.subjects.filter(
                    (s) => s.latest != null,
                  )
                  return (
                    <article
                      key={student.id}
                      className={`dept-student${expanded ? ' is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="dept-student__toggle"
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedStudentId(expanded ? null : student.id)
                        }
                      >
                        <span className="dept-student__identity">
                          <span className="dept-student__avatar">
                            {student.id}
                          </span>
                          <span className="dept-student__meta">
                            <strong>{student.name}</strong>
                            <small>
                              {student.section}
                              {' · '}
                              {student.studentId}
                              {' · '}
                              Overall{' '}
                              {student.overallLatest != null
                                ? `${student.overallLatest}%`
                                : '—'}
                            </small>
                          </span>
                        </span>
                        <span className="dept-student__chevron" aria-hidden="true">
                          {expanded ? '▾' : '▸'}
                        </span>
                      </button>

                      {expanded ? (
                        <div className="dept-student__panel">
                          <div className="dept-student__actions">
                            <button
                              type="button"
                              className="overview__quick-btn"
                              onClick={() =>
                                openResultsModal('print', student.id)
                              }
                              disabled={deptAssessments.length === 0}
                            >
                              Print result
                            </button>
                            <button
                              type="button"
                              className="overview__quick-btn is-gold"
                              onClick={() =>
                                openResultsModal('download', student.id)
                              }
                              disabled={deptAssessments.length === 0}
                            >
                              Download result
                            </button>
                          </div>

                          {scoredSubjects.length === 0 ? (
                            <p className="overview__student-empty">
                              No subject marks recorded for this student yet.
                            </p>
                          ) : (
                            <div className="dept-student__subjects">
                              {scoredSubjects.map((subject) => {
                                const canProgress = subject.progress != null
                                const progressClass = !canProgress
                                  ? 'is-flat'
                                  : (subject.progress as number) > 0
                                    ? 'is-up'
                                    : (subject.progress as number) < 0
                                      ? 'is-down'
                                      : 'is-flat'
                                return (
                                  <div
                                    key={subject.subjectId}
                                    className="dept-student__subject"
                                  >
                                    <div className="dept-student__subject-head">
                                      <strong>
                                        {subject.subjectName}
                                        {subject.isCore ? (
                                          <span className="dept-student__core">
                                            Core
                                          </span>
                                        ) : null}
                                      </strong>
                                      <span
                                        className={`dept-student__progress ${progressClass}`}
                                        title="Change from first recorded mark to latest"
                                      >
                                        {!canProgress
                                          ? '—'
                                          : (subject.progress as number) === 0
                                            ? 'No change'
                                            : formatDelta(
                                                subject.progress as number,
                                              )}
                                      </span>
                                    </div>
                                    <p className="dept-student__subject-scores">
                                      <span>
                                        First · {formatScore(subject.first)}
                                      </span>
                                      <span>
                                        Latest · {formatScore(subject.latest)}
                                      </span>
                                      <span>
                                        {subject.resitsWritten} resit
                                        {subject.resitsWritten === 1
                                          ? ''
                                          : 's'}
                                      </span>
                                    </p>
                                    {deptAssessments.length > 0 ? (
                                      <ul className="dept-student__sittings">
                                        {deptAssessments.map(
                                          (assessment, index) => {
                                            const attempt =
                                              subject.attempts[index]
                                            const best =
                                              subject.scores[index] ?? null
                                            if (
                                              best == null &&
                                              (!attempt ||
                                                attempt.sittings.length === 0)
                                            ) {
                                              return null
                                            }
                                            return (
                                              <li key={assessment.id}>
                                                <strong>
                                                  {assessment.name}
                                                </strong>
                                                <span>
                                                  Best {formatScore(best)}
                                                  {attempt?.hasResit
                                                    ? ` · Test ${formatScore(attempt.firstSit)} → Resit ${formatScore(attempt.bestResit)}`
                                                    : ''}
                                                </span>
                                              </li>
                                            )
                                          },
                                        )}
                                      </ul>
                                    ) : null}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  )
                })
              )}
            </div>
          </section>

          <QuickActions
            isSupervisor={isSupervisor}
            onExport={() => void exportSummary()}
            onExportMarks={() => void exportMarksSpreadsheet()}
            marksExportBusy={marksExportBusy}
            marksExportError={marksExportError}
          />
          <ExtraPanels
            mostImproved={mostImproved}
            nearPassCount={nearPassCount}
            resitsRequiredCount={resitsRequiredCount}
            targetMetCount={targetMetCount}
            activities={activities}
            didNotWrite={didNotWritePanel}
            resitScope="all subjects"
            studentTotal={resitPressurePool}
            pressureUnit={resitPressureUnit}
          />
        </div>
        {printSheet}
        {downloadModal}
      </main>
    )
  }

  return (
    <main className="overview">
      <div
        className={`overview__content ${leaving ? 'zoom-out' : 'zoom-in'}`}
        key={viewKey}
      >
        <OverviewTopBar
          title={
            activeSubject
              ? `${activeSubject.subject} Overview`
              : 'Assessment Overview'
          }
          subtitle={year?.label ?? ''}
          yearLabel={year?.label ?? '—'}
          canSwitchYear={isSupervisor}
          onSwitchYear={openYearSwitcher}
          isSupervisor={isSupervisor}
          showBack={Boolean(isSupervisor && subjectIdFromRoute)}
          onBack={goBackFromSubject}
          subjectLogo={activeSubject?.logo}
          subjectName={activeSubject?.subject}
        />

        <div className="overview__report-bar no-print">
          <div>
            <p className="overview__report-bar-title">Class progress report</p>
            <p className="overview__report-bar-lead">
              Print or download every student&apos;s {subjectLabel} test
              progress.
            </p>
          </div>
          <div className="overview__report-bar-actions">
            <button
              type="button"
              className="overview__quick-btn"
              onClick={() => openClassListModal('print')}
            >
              Print class list
            </button>
            <button
              type="button"
              className="overview__quick-btn is-gold"
              onClick={() => openClassListModal('download')}
            >
              Download class list
            </button>
          </div>
        </div>

        <div className="overview__cards">
          {cards.map((card) => {
            const content = (
              <>
                <div className="overview__card-text">
                  <span className="overview__card-label">{card.label}</span>
                  <span className="overview__card-value">{card.value}</span>
                </div>
                <img className="overview__card-icon" src={card.icon} alt="" />
              </>
            )
            if (card.to) {
              return (
                <Link
                  className={`overview__card overview__card--${card.tone}`}
                  key={card.label}
                  to={card.to}
                >
                  {content}
                </Link>
              )
            }
            return (
              <div
                className={`overview__card overview__card--${card.tone} overview__card--static`}
                key={card.label}
              >
                {content}
              </div>
            )
          })}
        </div>

        <div className="overview__charts">
          <section className="overview__chart-card">
            <div className="overview__chart-head">
              <h2 className="overview__chart-title">
                <img src={trendIcon} alt="" />
                Performance Trend
              </h2>
              <p className="overview__chart-subtitle">
                {isSupervisor ? 'Tests in this subject' : 'By test'}
              </p>
            </div>
            <div className="bar-chart" role="img" aria-label="Trend chart">
              <div className="bar-chart__plot">
                <div className="bar-chart__grid" aria-hidden="true">
                  {yTicks.map((tick) => (
                    <div className="bar-chart__grid-row" key={tick}>
                      <span>{tick}%</span>
                    </div>
                  ))}
                </div>
                <div className="bar-chart__scroll">
                  <div className="bar-chart__bars">
                    {testAverages.filter((t) => t.hasMarks).length === 0 ? (
                      <p className="overview__student-empty">
                        No test marks recorded yet.
                      </p>
                    ) : (
                      testAverages
                        .filter((t) => t.hasMarks && t.average != null)
                        .map((item, i, list) => (
                          <div className="bar-chart__col" key={item.test}>
                            <span className="bar-chart__value">
                              {item.average}%
                            </span>
                            <div className="bar-chart__track">
                              <div
                                className={`bar-chart__bar${
                                  i === list.length - 1 ? ' is-latest' : ''
                                }`}
                                style={{
                                  height: barHeight(item.average as number),
                                }}
                              />
                            </div>
                            <span className="bar-chart__label">{item.test}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="overview__chart-card">
            <div className="overview__chart-head">
              <h2 className="overview__chart-title">
                <img src={subjectIcon} alt="" />
                Subject Performance
              </h2>
              <p className="overview__chart-subtitle">By section</p>
            </div>
            <div className="subject-bars">
              {sectionStats.map((item, i) => (
                <div className="subject-bars__row" key={item.section}>
                  <div className="subject-bars__label">
                    <span className="subject-bars__chip">
                      {item.section[0]}
                    </span>
                    <span className="subject-bars__name">{item.section}</span>
                  </div>
                  <div className="subject-bars__track">
                    <div
                      className={`subject-bars__bar${
                        needsResit(item.average) ? ' is-warn' : ''
                      }`}
                      style={{
                        width: barWidth(item.average ?? 0),
                        animationDelay: `${i * 0.06}s`,
                      }}
                    />
                  </div>
                  <span className="subject-bars__value">
                    {item.average != null ? `${item.average}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="overview__insights" aria-label="Class insights">
          <div className="overview__insights-grid">
            <article className="insight-card insight-card--attention">
              <div className="insight-card__head">
                <h2 className="insight-card__title">Needs Attention</h2>
                <p className="insight-card__subtitle">
                  Below {PASS_MARK}% or declined
                </p>
              </div>
              <ul className="insight-attention">
                {attentionStudents.length === 0 ? (
                  <li>
                    <div className="insight-attention__row is-empty">
                      <span className="insight-attention__meta">
                        <strong>No students flagged</strong>
                        <small>Everyone on track</small>
                      </span>
                    </div>
                  </li>
                ) : (
                  attentionStudents.map((student) => {
                    const delta =
                      hasScore(student.test1) && hasScore(student.test2)
                        ? student.test2 - student.test1
                        : 0
                    return (
                      <li key={student.id}>
                        <button
                          type="button"
                          className="insight-attention__row"
                          onClick={() =>
                            navigate(`/student-info/${student.id}`)
                          }
                        >
                          <span className="insight-attention__avatar">
                            {student.id}
                          </span>
                          <span className="insight-attention__meta">
                            <strong>{student.name}</strong>
                            <small>
                              {formatScore(student.test2)} · {student.section}
                            </small>
                          </span>
                          <span
                            className={`insight-attention__delta${
                              delta < 0
                                ? ' is-down'
                                : delta > 0
                                  ? ' is-up'
                                  : ' is-flat'
                            }`}
                          >
                            {formatDelta(delta)}
                          </span>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </article>

            <article className="insight-card">
              <div className="insight-card__head">
                <h2 className="insight-card__title">Class Progress</h2>
                <p className="insight-card__subtitle">
                  Movement from Test 1 to Test 2
                </p>
              </div>
              <div className="insight-progress">
                <div className="insight-progress__item is-up">
                  <strong>{improvedCount}</strong>
                  <span>Improved</span>
                </div>
                <div className="insight-progress__item is-flat">
                  <strong>{flatCount}</strong>
                  <span>No change</span>
                </div>
                <div className="insight-progress__item is-down">
                  <strong>{declinedCount}</strong>
                  <span>Declined</span>
                </div>
                <div className="insight-progress__item is-target">
                  <strong>{targetMetCount}</strong>
                  <span>Hit {PASS_MARK}%+</span>
                </div>
              </div>
            </article>

            <article className="insight-card">
              <div className="insight-card__head">
                <h2 className="insight-card__title">Section Comparison</h2>
                <p className="insight-card__subtitle">
                  Average Test 2 by section
                </p>
              </div>
              <div className="insight-sections">
                {sectionStats.map((item) => (
                  <div className="insight-sections__row" key={item.section}>
                    <span className="insight-sections__label">
                      {item.section}
                      <small>{item.count} students</small>
                    </span>
                    <div className="insight-sections__track">
                      <div
                        className="insight-sections__bar"
                        style={{
                          width: `${
                            item.average != null
                              ? (item.average / sectionMax) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <strong>
                      {item.average != null ? `${item.average}%` : '—'}
                    </strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="insight-card insight-card--gauge">
              <div className="insight-card__head">
                <h2 className="insight-card__title">Pass Mark</h2>
                <p className="insight-card__subtitle">
                  Students at {PASS_MARK}% or higher
                </p>
              </div>
              <div className="insight-gauge">
                <div className="insight-gauge__ring">
                  <svg viewBox="0 0 88 88" aria-hidden="true">
                    <circle
                      className="insight-gauge__track"
                      cx="44"
                      cy="44"
                      r={GAUGE_R}
                    />
                    <circle
                      className="insight-gauge__fill"
                      cx="44"
                      cy="44"
                      r={GAUGE_R}
                      strokeDasharray={GAUGE_C}
                      strokeDashoffset={gaugeOffset(targetMetPercent)}
                    />
                  </svg>
                  <span className="insight-gauge__value">{targetMetPercent}%</span>
                </div>
                <p className="insight-gauge__text">
                  <strong>
                    {targetMetCount} of {students.length}
                  </strong>{' '}
                  met the {PASS_MARK}% target
                </p>
              </div>
            </article>
          </div>
        </section>

        <QuickActions
          isSupervisor={isSupervisor}
          onExport={() => void exportSummary()}
          onExportMarks={
            isSupervisor ? () => void exportMarksSpreadsheet() : undefined
          }
          marksExportBusy={marksExportBusy}
          marksExportError={marksExportError}
        />
        <ExtraPanels
          mostImproved={mostImproved}
          nearPassCount={nearPassCount}
          resitsRequiredCount={resitsRequiredCount}
          targetMetCount={targetMetCount}
          activities={activities}
          didNotWrite={didNotWritePanel}
          resitScope={
            isSupervisor && !activeSubject
              ? 'all subjects'
              : activeSubject?.subject ?? 'this subject'
          }
          studentTotal={resitPressurePool}
          pressureUnit={resitPressureUnit}
        />

        <section className="overview__students no-print">
          <div className="overview__section-chips">
            <button
              type="button"
              className={sectionFilter === 'all' ? 'is-active' : ''}
              onClick={() => setSectionFilter('all')}
            >
              All sections
            </button>
            {SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                className={sectionFilter === section ? 'is-active' : ''}
                onClick={() => setSectionFilter(section)}
              >
                {section}
              </button>
            ))}
          </div>

          <div className="overview__student-filters">
            <div className="overview__filter-group">
              <span className="overview__filter-label">
                <img src={filterIcon} alt="" />
                Filter
              </span>
              <label className="overview__filter-select-wrap">
                <span className="visually-hidden">Student filter</span>
                <select
                  className="overview__filter-select"
                  value={studentFilter}
                  onChange={(e) =>
                    setStudentFilter(e.target.value as StudentFilter)
                  }
                >
                  {FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="overview__student-search">
              <span className="visually-hidden">Search students</span>
              <input
                type="search"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Search by ID or name"
              />
            </label>

            <p className="overview__student-count">
              {`Showing ${visibleStudents.length} of ${filteredStudents.length} students`}
            </p>
          </div>

          <div className="overview__student-list">
            {visibleStudents.length === 0 ? (
              <p className="overview__student-empty">
                No students match this filter or search.
              </p>
            ) : (
              visibleStudents.map((student) => {
                const progress = resolveStudentProgress(
                  student,
                  testAverages.map((t) => t.test),
                )
                const canDelta = progress != null
                const delta = progress?.delta ?? 0
                const studentNeedsResit = studentNeedsAnyResit(student)
                const deltaClass = !canDelta
                  ? 'is-flat'
                  : delta > 0
                    ? 'is-up'
                    : delta < 0
                      ? 'is-down'
                      : 'is-flat'
                const ringFill = canDelta ? ringFillFromDelta(delta) : 50
                const statusLabel = studentNeedsResit
                  ? formatResitsNeededStatus(student)
                  : !hasScore(student.test2)
                    ? 'No mark recorded'
                    : `Target met · ${PASS_MARK}%+`
                const statusClass = studentNeedsResit
                  ? ' is-resit'
                  : !hasScore(student.test2)
                    ? ' is-empty'
                    : ' is-pass'
                return (
                  <article className="student-card" key={student.id}>
                    <div className="student-card__top">
                      <div className="student-card__identity">
                        <span className="student-card__avatar">{student.id}</span>
                        <div className="student-card__meta">
                          <h3 className="student-card__name">{student.name}</h3>
                          <p className="student-card__tests">
                            <span>{student.section}</span>
                            <span>Test 1 · {formatScore(student.test1)}</span>
                            <span>Latest · {formatScore(student.test2)}</span>
                          </p>
                        </div>
                      </div>
                      <div className={`student-card__ring ${deltaClass}`}>
                        <svg viewBox="0 0 88 88" aria-hidden="true">
                          <circle
                            className="student-card__ring-track"
                            cx="44"
                            cy="44"
                            r={RING_R}
                          />
                          <circle
                            className={`student-card__ring-fill ${deltaClass}`}
                            cx="44"
                            cy="44"
                            r={RING_R}
                            strokeDasharray={RING_C}
                            strokeDashoffset={ringOffset(ringFill)}
                          />
                        </svg>
                        <span className={`student-card__ring-value ${deltaClass}`}>
                          {canDelta ? formatDelta(delta) : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="student-card__stats">
                      <span className="student-card__resits">
                        <strong>{student.resitsWritten}</strong>
                        {student.resitsWritten === 1
                          ? ' resit written'
                          : ' resits written'}
                      </span>
                    </div>
                    <div className={`student-card__status${statusClass}`}>
                      {statusLabel}
                    </div>
                    {studentNeedsResit ? (
                      <ul className="student-card__resit-tests">
                        {student.resitsNeeded.map((item) => (
                          <li key={item.assessmentIndex}>
                            {item.reason === 'did_not_write'
                              ? `${item.assessmentName} · DNW`
                              : `${item.assessmentName} · ${item.bestScore}%`}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <button
                      type="button"
                      className="student-card__view"
                      onClick={() => navigate(`/student-info/${student.id}`)}
                    >
                      View
                    </button>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </div>
      {printSheet}
      {downloadModal}
    </main>
  )
}

function OverviewTopBar({
  title,
  subtitle,
  yearLabel,
  canSwitchYear,
  onSwitchYear,
  isSupervisor,
  showBack,
  onBack,
  subjectLogo,
  subjectName,
}: {
  title: string
  subtitle: string
  yearLabel: string
  canSwitchYear: boolean
  onSwitchYear: () => void
  isSupervisor: boolean
  showBack?: boolean
  onBack?: () => void
  subjectLogo?: string
  subjectName?: string
}) {
  return (
    <div className="overview__heading overview__heading--bar">
      {showBack ? (
        <button type="button" className="overview__back" onClick={onBack}>
          All subjects
        </button>
      ) : null}
      <div className="overview__heading-main">
        <h1 className="overview__title">{title}</h1>
        <p className="overview__heading-sub">{subtitle}</p>
      </div>
      <div className="overview__subject-row">
        {subjectLogo ? (
          <img className="overview__subject-logo-img" src={subjectLogo} alt="" />
        ) : (
          <div className="overview__subject-logo" aria-hidden="true" />
        )}
        <span className="overview__subject-name">
          {subjectName ?? (isSupervisor ? 'JHS 3' : 'Subject')}
        </span>
        {canSwitchYear ? (
          <button
            type="button"
            className="overview__year-switch"
            onClick={onSwitchYear}
          >
            <span>Year</span>
            <strong>{yearLabel}</strong>
            <em>Switch</em>
          </button>
        ) : (
          <div className="overview__year-switch is-static">
            <span>Year</span>
            <strong>{yearLabel}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickActions({
  isSupervisor,
  onExport,
  onExportMarks,
  marksExportBusy = false,
  marksExportError = null,
}: {
  isSupervisor: boolean
  onExport: () => void
  onExportMarks?: () => void
  marksExportBusy?: boolean
  marksExportError?: string | null
}) {
  const { user } = useAuth()
  const canEnterMarks = user?.canEnterMarks !== false

  return (
    <section className="overview__quick">
      <h2>Actions</h2>
      <div className="overview__quick-row">
        {isSupervisor ? (
          <>
            <Link to="/manage/students" className="overview__quick-btn is-gold">
              Add student
            </Link>
            <Link to="/manage/staff" className="overview__quick-btn is-gold">
              Add teacher
            </Link>
            <Link to="/manage/assessments" className="overview__quick-btn">
              Create test
            </Link>
            <Link to="/manage/bece" className="overview__quick-btn is-gold">
              BECE results
            </Link>
            <Link
              to="/manage/teacher-access"
              className="overview__quick-btn is-ash"
            >
              Marks access
            </Link>
          </>
        ) : canEnterMarks ? (
          <>
            <Link to="/manage/marks" className="overview__quick-btn">
              Enter marks
            </Link>
            <Link
              to="/manage/marks?edit=1"
              className="overview__quick-btn is-gold"
            >
              Edit test / resit
            </Link>
          </>
        ) : (
          <span className="overview__quick-locked">Marks entry locked</span>
        )}
        <button
          type="button"
          className="overview__quick-btn is-ash"
          onClick={onExport}
        >
          Export summary
        </button>
        {isSupervisor && onExportMarks ? (
          <button
            type="button"
            className="overview__quick-btn is-navy"
            onClick={onExportMarks}
            disabled={marksExportBusy}
          >
            {marksExportBusy ? 'Preparing CSV…' : 'Export marks (CSV)'}
          </button>
        ) : null}
      </div>
      {isSupervisor && marksExportError ? (
        <p className="overview__quick-error" role="alert">
          {marksExportError}
        </p>
      ) : null}
    </section>
  )
}

function ExtraPanels({
  mostImproved,
  nearPassCount,
  resitsRequiredCount,
  targetMetCount,
  activities,
  didNotWrite,
  resitScope,
  studentTotal,
  pressureUnit = 'students',
}: {
  mostImproved: Array<{
    id: number
    name: string
    section: string
    gain: number
    test2: number | null
  }>
  nearPassCount: number
  resitsRequiredCount: number
  targetMetCount: number
  activities: string[]
  didNotWrite: LiveStudent[]
  resitScope: string
  studentTotal: number
  pressureUnit?: 'students' | 'subjects'
}) {
  const navigate = useNavigate()
  const totalPool = Math.max(studentTotal, targetMetCount + resitsRequiredCount, 1)
  const resitPercent = Math.round((resitsRequiredCount / totalPool) * 100)
  const passPercent = Math.max(0, 100 - resitPercent)
  const needLabel =
    pressureUnit === 'subjects' ? 'Subjects below' : 'Need resit'
  const trackLabel =
    pressureUnit === 'subjects' ? 'Subjects on track' : 'On track'

  return (
    <section className="overview__extra">
      <article className="overview__extra-card is-gold">
        <div className="overview__extra-head">
          <h3>Most improved</h3>
          <span className="overview__extra-tag">{mostImproved.length}</span>
        </div>
        <ul className="overview__rich-list">
          {mostImproved.length === 0 ? (
            <li className="overview__rich-empty">No gains recorded yet</li>
          ) : (
            mostImproved.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/student-info/${student.id}`)}
                >
                  <strong>{student.name}</strong>
                  <span className="overview__rich-pill is-up">
                    +{student.gain}%
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </article>

      <article className="overview__extra-card overview__resit-card">
        <div className="overview__extra-head">
          <h3>Resit pressure</h3>
          <span className="overview__extra-tag">{resitScope}</span>
        </div>
        <div className="overview__resit-body">
          <div className="overview__resit-ring" aria-hidden="true">
            <svg viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="34" className="overview__resit-track" />
              <circle
                cx="44"
                cy="44"
                r="34"
                className="overview__resit-fill"
                strokeDasharray={`${(resitPercent / 100) * 213.6} 213.6`}
              />
            </svg>
            <strong>{resitsRequiredCount}</strong>
          </div>
          <div className="overview__resit-stats">
            <div>
              <span>{needLabel}</span>
              <strong>{resitsRequiredCount}</strong>
            </div>
            <div>
              <span>{trackLabel}</span>
              <strong>{targetMetCount}</strong>
            </div>
            <div>
              <span>Pressure</span>
              <strong>{resitPercent}%</strong>
            </div>
          </div>
        </div>
        <div className="overview__resit-split">
          <span style={{ width: `${passPercent}%` }} className="is-pass" />
          <span style={{ width: `${resitPercent}%` }} className="is-resit" />
        </div>
      </article>

      <article className="overview__extra-card is-ash">
        <div className="overview__extra-head">
          <h3>Recent activity</h3>
        </div>
        <ul className="overview__rich-list">
          {activities.length === 0 ? (
            <li className="overview__rich-empty">No recent activity</li>
          ) : (
            activities.slice(0, 5).map((item) => <li key={item}>{item}</li>)
          )}
        </ul>
      </article>

      <article className="overview__extra-card is-gold">
        <div className="overview__extra-head">
          <h3>Near {PASS_MARK}%</h3>
          <span className="overview__extra-tag">{nearPassCount}</span>
        </div>
        <p className="overview__extra-blurb">
          Within {PASS_NEAR}% of the pass mark
        </p>
        <div className="overview__meter-track overview__meter-track--tall">
          <div
            className="overview__meter-fill is-gold"
            style={{
              width: `${Math.min(
                100,
                (nearPassCount / Math.max(studentTotal, 1)) * 100,
              )}%`,
            }}
          />
        </div>
      </article>

      <article className="overview__extra-card is-ash">
        <div className="overview__extra-head">
          <h3>Did not write</h3>
          <span className="overview__extra-tag">{didNotWrite.length}</span>
        </div>
        <ul className="overview__rich-list">
          {didNotWrite.length === 0 ? (
            <li className="overview__rich-empty">None recorded</li>
          ) : (
            didNotWrite.slice(0, 5).map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/student-info/${student.id}`)}
                >
                  <strong>{student.name}</strong>
                  <span>{student.section}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </article>
    </section>
  )
}

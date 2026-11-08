import { PASS_MARK, type SectionName, SECTIONS } from './overviewStats.ts'
import type {
  AssessmentAttemptView,
  SittingMark,
} from './loadOverview.ts'
import { displayName } from '../lib/person.ts'
import {
  beceGradeFromScore,
  beceGradeLabel,
  computeBeceAggregate,
  formatBeceGrade,
  isBeceCoreCode,
  type BeceGrade,
} from '../lib/beceGrades.ts'
import { resolveStudentPhoto } from '../lib/studentPhoto.ts'
import { sortSubjects } from '../lib/subjects.ts'
import {
  supabase,
  type AssessmentRow,
  type MarkRow,
  type StudentRow,
  type SubjectRow,
} from '../lib/supabase.ts'

export type AssessmentOption = {
  id: number
  name: string
  sequenceNo: number
}

export type SubjectProgressLine = {
  subjectId: number
  subjectName: string
  subjectCode: string
  isCore: boolean
  scores: (number | null)[]
  attempts: AssessmentAttemptView[]
  first: number | null
  latest: number | null
  progress: number | null
  resitsWritten: number
}

export type DepartmentStudent = {
  id: number
  studentId: string
  name: string
  section: SectionName
  photo: string
  subjects: SubjectProgressLine[]
  /** Average of latest best scores across subjects that have marks. */
  overallLatest: number | null
}

export type ResultSubjectLine = {
  subjectId: number
  subjectName: string
  subjectCode: string
  isCore: boolean
  score: number | null
  status: 'scored' | 'did_not_write' | 'missing'
  firstSit: number | null
  bestResit: number | null
  hasResit: boolean
  sittings: SittingMark[]
  grade: BeceGrade | null
  gradeLabel: string
  gradeDisplay: string
  usedInAggregate: boolean
}

export type StudentResultSlipData = {
  id: number
  studentId: string
  name: string
  section: SectionName
  photo: string
  assessmentId: number
  assessmentName: string
  subjects: ResultSubjectLine[]
  aggregate: number | null
  aggregateComplete: boolean
  electiveNames: string[]
}

export type DepartmentResultsBundle = {
  assessments: AssessmentOption[]
  subjects: SubjectRow[]
  students: DepartmentStudent[]
  fromDatabase: boolean
}

function normalizeSection(value: string): SectionName {
  const upper = value.trim().toUpperCase()
  if ((SECTIONS as readonly string[]).includes(upper)) {
    return upper as SectionName
  }
  return 'TULIPS'
}

function marksFor(
  marks: MarkRow[],
  studentId: number,
  assessmentId: number,
  subjectId: number,
) {
  return marks.filter(
    (m) =>
      m.student_id === studentId &&
      m.assessment_id === assessmentId &&
      m.subject_id === subjectId,
  )
}

function bestScore(
  marks: MarkRow[],
  studentId: number,
  assessmentId: number,
  subjectId: number,
): number | null {
  const relevant = marksFor(marks, studentId, assessmentId, subjectId).filter(
    (m) => m.status !== 'did_not_write' && m.score != null,
  )
  if (relevant.length === 0) return null
  return Math.max(...relevant.map((m) => m.score as number))
}

function attemptView(
  marks: MarkRow[],
  studentId: number,
  assessmentId: number,
  subjectId: number,
): AssessmentAttemptView {
  const relevant = marksFor(marks, studentId, assessmentId, subjectId)
  const byAttempt = new Map<number, MarkRow>()
  for (const mark of relevant) {
    const existing = byAttempt.get(mark.attempt_no)
    if (!existing) {
      byAttempt.set(mark.attempt_no, mark)
      continue
    }
    if (existing.status !== 'scored' && mark.status === 'scored') {
      byAttempt.set(mark.attempt_no, mark)
    }
  }
  const sittings: SittingMark[] = [...byAttempt.values()]
    .sort((a, b) => a.attempt_no - b.attempt_no)
    .map((mark) => ({
      attemptNo: mark.attempt_no,
      label: mark.attempt_no <= 1 ? 'Test' : `Resit ${mark.attempt_no - 1}`,
      score: mark.status === 'scored' ? mark.score : null,
      status: mark.status,
    }))
  const first = sittings.find((s) => s.attemptNo === 1 && s.status === 'scored')
  const resitScores = sittings
    .filter((s) => s.attemptNo > 1 && s.status === 'scored' && s.score != null)
    .map((s) => s.score as number)
  return {
    firstSit: first?.score ?? null,
    bestResit: resitScores.length === 0 ? null : Math.max(...resitScores),
    hasResit: resitScores.length > 0,
    sittings,
  }
}

export async function loadDepartmentResultsBundle(opts: {
  yearId: number | null
}): Promise<DepartmentResultsBundle> {
  let studentsQuery = supabase
    .from('students')
    .select(
      'id, identity_code, full_name, section, photo_url, academic_year_id, gender, date_of_birth',
    )
    .order('id')
  if (opts.yearId != null) {
    studentsQuery = studentsQuery.eq('academic_year_id', opts.yearId)
  }

  const [{ data: studentsData }, { data: subjectsData }] = await Promise.all([
    studentsQuery,
    supabase.from('subjects').select('id, name, code').order('id'),
  ])

  const dbStudents = (studentsData ?? []) as StudentRow[]
  const dbSubjects = sortSubjects((subjectsData ?? []) as SubjectRow[])

  let assessments: AssessmentRow[] = []
  if (opts.yearId != null) {
    const { data } = await supabase
      .from('assessments')
      .select('id, academic_year_id, name, sequence_no')
      .eq('academic_year_id', opts.yearId)
      .order('sequence_no')
    assessments = (data ?? []) as AssessmentRow[]
  }

  const assessmentIds = assessments.map((a) => a.id)
  let marks: MarkRow[] = []
  if (assessmentIds.length > 0) {
    const { data } = await supabase
      .from('marks')
      .select(
        'id, student_id, subject_id, assessment_id, attempt_no, score, status, entered_by, created_at',
      )
      .in('assessment_id', assessmentIds)
      .order('created_at', { ascending: false })
      .limit(8000)
    marks = (data ?? []) as MarkRow[]
  }

  const assessmentOptions: AssessmentOption[] = assessments.map((a) => ({
    id: a.id,
    name: a.name,
    sequenceNo: a.sequence_no,
  }))

  const students: DepartmentStudent[] = dbStudents.map((row) => {
    const subjects: SubjectProgressLine[] = dbSubjects.map((subject) => {
      const scores = assessments.map((assessment) =>
        bestScore(marks, row.id, assessment.id, subject.id),
      )
      const attempts = assessments.map((assessment) =>
        attemptView(marks, row.id, assessment.id, subject.id),
      )
      const firstIndex = scores.findIndex((n) => n != null)
      const latestIndex = [...scores]
        .map((n, i) => ({ n, i }))
        .reverse()
        .find((row) => row.n != null)?.i
      const first = firstIndex >= 0 ? scores[firstIndex] : null
      const latest =
        latestIndex != null ? scores[latestIndex] : null
      // First test first-sit (fallback best) → latest test best (includes resits).
      const firstSit =
        firstIndex >= 0 && attempts[firstIndex]?.firstSit != null
          ? attempts[firstIndex].firstSit
          : first
      const progress =
        firstSit != null && latest != null ? latest - firstSit : null
      const resitsWritten = marks.filter(
        (m) =>
          m.student_id === row.id &&
          m.subject_id === subject.id &&
          m.attempt_no > 1,
      ).length

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code,
        isCore: isBeceCoreCode(subject.code),
        scores,
        attempts,
        first: firstSit,
        latest,
        progress,
        resitsWritten,
      }
    })

    const latestScores = subjects
      .map((s) => s.latest)
      .filter((n): n is number => n != null)
    const overallLatest =
      latestScores.length === 0
        ? null
        : Math.round(
            latestScores.reduce((sum, n) => sum + n, 0) / latestScores.length,
          )

    return {
      id: row.id,
      studentId: row.identity_code,
      name: displayName(row.full_name, row.gender),
      section: normalizeSection(row.section),
      photo: resolveStudentPhoto(row.photo_url, row.gender),
      subjects,
      overallLatest,
    }
  })

  return {
    assessments: assessmentOptions,
    subjects: dbSubjects,
    students,
    fromDatabase: true,
  }
}

function lineFromProgress(
  subject: SubjectProgressLine,
  assessmentIndex: number,
): ResultSubjectLine {
  const score = subject.scores[assessmentIndex] ?? null
  const attempt = subject.attempts[assessmentIndex] ?? {
    firstSit: null,
    bestResit: null,
    hasResit: false,
    sittings: [],
  }
  const hasDnw =
    score == null &&
    attempt.sittings.some((s) => s.status === 'did_not_write')
  const status: ResultSubjectLine['status'] =
    score != null ? 'scored' : hasDnw ? 'did_not_write' : 'missing'
  const grade =
    status === 'scored'
      ? beceGradeFromScore(score)
      : status === 'did_not_write'
        ? (9 as BeceGrade)
        : null

  return {
    subjectId: subject.subjectId,
    subjectName: subject.subjectName,
    subjectCode: subject.subjectCode,
    isCore: subject.isCore,
    score,
    status,
    firstSit: attempt.firstSit,
    bestResit: attempt.bestResit,
    hasResit: attempt.hasResit,
    sittings: attempt.sittings,
    grade,
    gradeLabel: beceGradeLabel(grade),
    gradeDisplay: formatBeceGrade(grade),
    usedInAggregate: false,
  }
}

export function buildStudentResultSlip(
  student: DepartmentStudent,
  assessment: AssessmentOption,
  assessmentIndex: number,
): StudentResultSlipData {
  const lines = student.subjects.map((subject) =>
    lineFromProgress(subject, assessmentIndex),
  )

  const electiveIds = new Set(
    lines
      .filter((l) => !l.isCore && l.grade != null)
      .sort((a, b) => (a.grade as number) - (b.grade as number))
      .slice(0, 2)
      .map((l) => l.subjectId),
  )

  const withFlags = lines.map((line) => ({
    ...line,
    usedInAggregate: line.isCore
      ? line.grade != null
      : electiveIds.has(line.subjectId),
  }))

  const breakdown = computeBeceAggregate(
    withFlags.map((line) => ({
      code: line.subjectCode,
      name: line.subjectName,
      grade: line.grade,
    })),
  )

  return {
    id: student.id,
    studentId: student.studentId,
    name: student.name,
    section: student.section,
    photo: student.photo,
    assessmentId: assessment.id,
    assessmentName: assessment.name,
    subjects: withFlags,
    aggregate: breakdown.aggregate,
    aggregateComplete: breakdown.complete,
    electiveNames: breakdown.electiveNames,
  }
}

export function buildResultSlipsForAssessment(opts: {
  students: DepartmentStudent[]
  assessments: AssessmentOption[]
  assessmentId: number
  section: 'all' | SectionName
  studentId?: number
}): StudentResultSlipData[] {
  const assessmentIndex = opts.assessments.findIndex(
    (a) => a.id === opts.assessmentId,
  )
  const assessment = opts.assessments[assessmentIndex]
  if (!assessment || assessmentIndex < 0) return []

  const filtered = opts.students.filter((s) => {
    if (opts.studentId != null && s.id !== opts.studentId) return false
    if (opts.section !== 'all' && s.section !== opts.section) return false
    return true
  })

  return filtered
    .map((student) =>
      buildStudentResultSlip(student, assessment, assessmentIndex),
    )
    .filter((slip) =>
      slip.subjects.some(
        (s) => s.status === 'scored' || s.status === 'did_not_write',
      ),
    )
}

export type SubjectProgressView = {
  label: string
  from: number
  to: number
  delta: number
  isResit: boolean
}

/**
 * Progress for a subject line: Test 1 (first sit) → latest test best.
 * If the latest written work includes a resit, `to` is that resit best.
 */
export function resolveSubjectProgress(
  subject: SubjectProgressLine,
  assessmentLabels: string[] = [],
): SubjectProgressView | null {
  const firstIndex = subject.scores.findIndex((n) => n != null)
  const latestIndex = [...subject.scores]
    .map((n, i) => ({ n, i }))
    .reverse()
    .find((row) => row.n != null)?.i
  if (firstIndex < 0 || latestIndex == null) return null

  const firstAttempt = subject.attempts[firstIndex]
  const latestAttempt = subject.attempts[latestIndex]
  const from =
    firstAttempt?.firstSit != null
      ? firstAttempt.firstSit
      : (subject.scores[firstIndex] as number)
  const to = subject.scores[latestIndex] as number
  const fromLabel = assessmentLabels[firstIndex] ?? 'Test 1'
  const toLabel = assessmentLabels[latestIndex] ?? 'Latest test'
  const latestIsResit = Boolean(latestAttempt?.hasResit)

  if (firstIndex === latestIndex && latestIsResit) {
    return {
      label: `${fromLabel} → Resit`,
      from,
      to,
      delta: to - from,
      isResit: true,
    }
  }

  return {
    label: latestIsResit
      ? `${fromLabel} → ${toLabel} (resit)`
      : `${fromLabel} → ${toLabel}`,
    from,
    to,
    delta: to - from,
    isResit: latestIsResit,
  }
}

/** True when any subject/assessment still needs a resit (below pass or DNW). */
export function departmentStudentNeedsResit(
  student: DepartmentStudent,
): boolean {
  return student.subjects.some((subject) =>
    subject.scores.some((score, index) => {
      if (score != null) return score < PASS_MARK
      const attempt = subject.attempts[index]
      return (
        attempt?.sittings.some((sitting) => sitting.status === 'did_not_write') ??
        false
      )
    }),
  )
}

/** Student has marks and no outstanding resit across subjects. */
export function departmentStudentOnTrack(student: DepartmentStudent): boolean {
  const hasMarks = student.subjects.some((subject) =>
    subject.scores.some((score) => score != null),
  )
  return hasMarks && !departmentStudentNeedsResit(student)
}

export function departmentNearPassCount(
  students: DepartmentStudent[],
  nearBand: number,
): number {
  let count = 0
  for (const student of students) {
    const near = student.subjects.some((subject) => {
      const latest = subject.latest
      return (
        latest != null &&
        latest < PASS_MARK &&
        latest >= PASS_MARK - nearBand
      )
    })
    if (near) count += 1
  }
  return count
}

export function departmentDidNotWriteStudents(
  students: DepartmentStudent[],
): DepartmentStudent[] {
  return students.filter((student) =>
    student.subjects.some((subject) =>
      subject.attempts.some(
        (attempt, index) =>
          subject.scores[index] == null &&
          attempt.sittings.some((sitting) => sitting.status === 'did_not_write'),
      ),
    ),
  )
}

export function departmentMostImproved(
  students: DepartmentStudent[],
  limit = 5,
) {
  return students
    .map((student) => {
      const gains = student.subjects
        .map((subject) => subject.progress)
        .filter((n): n is number => n != null && n > 0)
      const gain =
        gains.length === 0 ? 0 : Math.max(...gains)
      return {
        id: student.id,
        name: student.name,
        section: student.section,
        gain,
        test2: student.overallLatest,
      }
    })
    .filter((row) => row.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, limit)
}
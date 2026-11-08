import { sortSubjectDisplay, sortSubjects } from '../lib/subjects.ts'
import {
  supabase,
  type AcademicYearRow,
  type AssessmentRow,
  type MarkRow,
  type SubjectRow,
} from '../lib/supabase.ts'

export type HomeQuickStat = { value: string; label: string }
export type HomeBecePoint = { year: number; passRate: number }
export type HomeProgressPoint = { label: string; average: number }
export type HomeSubjectPoint = { subject: string; average: number }

export type HomeStatsBundle = {
  quickStats: HomeQuickStat[]
  beceResults: HomeBecePoint[]
  classProgress: HomeProgressPoint[]
  subjectAverages: HomeSubjectPoint[]
}

function hasBece(year: AcademicYearRow) {
  return (
    year.bece_exam_year != null &&
    year.bece_pass_rate != null &&
    year.bece_student_count != null &&
    year.bece_best_aggregate != null
  )
}

export async function loadHomeStats(): Promise<HomeStatsBundle> {
  const [{ data: yearsData }, { data: subjectsData }] = await Promise.all([
    supabase
      .from('academic_years')
      .select(
        'id, label, is_active, bece_exam_year, bece_student_count, bece_pass_rate, bece_best_aggregate',
      )
      .order('id'),
    supabase.from('subjects').select('id, name, code').order('id'),
  ])

  const years = (yearsData ?? []) as AcademicYearRow[]
  const subjects = sortSubjects((subjectsData ?? []) as SubjectRow[])
  const active = years.find((y) => y.is_active) ?? years[years.length - 1]

  const beceYears = years
    .filter(hasBece)
    .sort((a, b) => (a.bece_exam_year ?? 0) - (b.bece_exam_year ?? 0))
    .slice(-5)

  const latestBece = beceYears[beceYears.length - 1]

  const beceResults: HomeBecePoint[] = beceYears.map((y) => ({
    year: y.bece_exam_year as number,
    passRate: Number(y.bece_pass_rate),
  }))

  const quickStats: HomeQuickStat[] = latestBece
    ? [
        {
          value: String(latestBece.bece_student_count),
          label: `JHS3 students (${latestBece.bece_exam_year})`,
        },
        {
          value: `${Number(latestBece.bece_pass_rate)}%`,
          label: `BECE pass rate (${latestBece.bece_exam_year})`,
        },
        {
          value: String(latestBece.bece_best_aggregate),
          label: `Best BECE aggregate (${latestBece.bece_exam_year})`,
        },
        {
          value: String(subjects.length || '—'),
          label: 'Subjects tracked',
        },
      ]
    : [
        { value: '—', label: 'JHS3 students' },
        { value: '—', label: 'BECE pass rate' },
        { value: '—', label: 'Best BECE aggregate' },
        {
          value: String(subjects.length || '—'),
          label: 'Subjects tracked',
        },
      ]

  let classProgress: HomeProgressPoint[] = []
  let subjectAverages: HomeSubjectPoint[] = []

  if (active) {
    const { data: assessmentData } = await supabase
      .from('assessments')
      .select('id, academic_year_id, name, sequence_no')
      .eq('academic_year_id', active.id)
      .order('sequence_no')

    const assessments = (assessmentData ?? []) as AssessmentRow[]
    const assessmentIds = assessments.map((a) => a.id)

    let marks: MarkRow[] = []
    if (assessmentIds.length > 0) {
      const { data: marksData } = await supabase
        .from('marks')
        .select(
          'id, student_id, subject_id, assessment_id, attempt_no, score, status, entered_by, created_at',
        )
        .in('assessment_id', assessmentIds)
        .limit(5000)
      marks = (marksData ?? []) as MarkRow[]
    }

    for (const assessment of assessments) {
      const byStudent = new Map<number, number>()
      for (const m of marks) {
        if (
          m.assessment_id !== assessment.id ||
          m.status === 'did_not_write' ||
          m.score == null
        ) {
          continue
        }
        const prev = byStudent.get(m.student_id)
        if (prev == null || m.score > prev) {
          byStudent.set(m.student_id, m.score)
        }
      }
      const studentScores = [...byStudent.values()]
      if (studentScores.length === 0) continue
      classProgress.push({
        label: assessment.name || `Test ${assessment.sequence_no}`,
        average: Math.round(
          studentScores.reduce((sum, n) => sum + n, 0) / studentScores.length,
        ),
      })
    }

    for (const subject of subjects) {
      const scores = marks
        .filter(
          (m) =>
            m.subject_id === subject.id &&
            m.status !== 'did_not_write' &&
            m.score != null,
        )
        .map((m) => m.score as number)
      if (scores.length === 0) continue
      subjectAverages.push({
        subject: subject.name,
        average: Math.round(
          scores.reduce((sum, n) => sum + n, 0) / scores.length,
        ),
      })
    }
  }

  return {
    quickStats,
    beceResults,
    classProgress,
    subjectAverages: sortSubjectDisplay(subjectAverages),
  }
}

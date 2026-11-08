import { downloadCsv, rowsToCsv } from '../lib/csvExport.ts'
import { sortSubjects } from '../lib/subjects.ts'
import {
  supabase,
  type AssessmentRow,
  type MarkRow,
  type StudentRow,
  type SubjectRow,
} from '../lib/supabase.ts'
import { displayName } from '../lib/person.ts'
import { SECTIONS, type SectionName } from './overviewStats.ts'

function normalizeSection(value: string): SectionName {
  const upper = value.trim().toUpperCase()
  if ((SECTIONS as readonly string[]).includes(upper)) {
    return upper as SectionName
  }
  return 'TULIPS'
}

function markCell(
  marks: MarkRow[],
  studentId: number,
  subjectId: number,
  assessmentId: number,
  attemptNo: number,
): string {
  const match = marks.find(
    (m) =>
      m.student_id === studentId &&
      m.subject_id === subjectId &&
      m.assessment_id === assessmentId &&
      m.attempt_no === attemptNo,
  )
  if (!match) return ''
  if (match.status === 'did_not_write') return 'DNW'
  if (match.score == null) return ''
  return String(match.score)
}

function bestMarkCell(
  marks: MarkRow[],
  studentId: number,
  subjectId: number,
  assessmentId: number,
): string {
  const relevant = marks.filter(
    (m) =>
      m.student_id === studentId &&
      m.subject_id === subjectId &&
      m.assessment_id === assessmentId,
  )
  if (relevant.length === 0) return ''
  const scored = relevant.filter(
    (m) => m.status === 'scored' && m.score != null,
  )
  if (scored.length > 0) {
    return String(Math.max(...scored.map((m) => m.score as number)))
  }
  if (relevant.some((m) => m.status === 'did_not_write')) return 'DNW'
  return ''
}

async function loadAllMarksForAssessments(
  assessmentIds: number[],
): Promise<MarkRow[]> {
  if (assessmentIds.length === 0) return []

  const pageSize = 1000
  const all: MarkRow[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from('marks')
      .select(
        'id, student_id, subject_id, assessment_id, attempt_no, score, status, entered_by, created_at',
      )
      .in('assessment_id', assessmentIds)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    const chunk = (data ?? []) as MarkRow[]
    all.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
    // Safety cap for very large years.
    if (all.length >= 50000) break
  }

  return all
}

export async function exportYearMarksCsv(opts: {
  yearId: number | null
  yearLabel: string
}): Promise<void> {
  if (opts.yearId == null) {
    throw new Error('Choose an academic year before exporting marks.')
  }

  const [{ data: studentsData }, { data: subjectsData }, { data: assessmentsData }] =
    await Promise.all([
      supabase
        .from('students')
        .select(
          'id, identity_code, full_name, section, photo_url, academic_year_id, gender, date_of_birth',
        )
        .eq('academic_year_id', opts.yearId)
        .order('full_name'),
      supabase.from('subjects').select('id, name, code').order('id'),
      supabase
        .from('assessments')
        .select('id, academic_year_id, name, sequence_no')
        .eq('academic_year_id', opts.yearId)
        .order('sequence_no'),
    ])

  const students = (studentsData ?? []) as StudentRow[]
  const subjects = sortSubjects((subjectsData ?? []) as SubjectRow[])
  const assessments = (assessmentsData ?? []) as AssessmentRow[]
  const marks = await loadAllMarksForAssessments(assessments.map((a) => a.id))

  const maxResitAttempt = marks.reduce(
    (max, mark) => (mark.attempt_no > max ? mark.attempt_no : max),
    1,
  )
  const resitAttempts = Array.from(
    { length: Math.max(0, maxResitAttempt - 1) },
    (_, i) => i + 2,
  )

  const header: string[] = [
    'Student ID',
    'Student name',
    'Section',
    'Academic year',
  ]

  for (const subject of subjects) {
    for (const assessment of assessments) {
      const base = `${subject.code} · ${assessment.name}`
      header.push(`${base} · Best`)
      header.push(`${base} · First sit`)
      for (const attemptNo of resitAttempts) {
        header.push(`${base} · Resit ${attemptNo - 1}`)
      }
    }
  }

  const rows: Array<Array<string | number | null | undefined>> = [header]

  const orderedStudents = [...students].sort((a, b) => {
    const sectionCmp = normalizeSection(a.section).localeCompare(
      normalizeSection(b.section),
    )
    if (sectionCmp !== 0) return sectionCmp
    return a.full_name.localeCompare(b.full_name)
  })

  for (const student of orderedStudents) {
    const row: Array<string | number | null | undefined> = [
      student.identity_code,
      displayName(student.full_name, student.gender),
      normalizeSection(student.section),
      opts.yearLabel,
    ]

    for (const subject of subjects) {
      for (const assessment of assessments) {
        row.push(
          bestMarkCell(marks, student.id, subject.id, assessment.id),
        )
        row.push(
          markCell(marks, student.id, subject.id, assessment.id, 1),
        )
        for (const attemptNo of resitAttempts) {
          row.push(
            markCell(
              marks,
              student.id,
              subject.id,
              assessment.id,
              attemptNo,
            ),
          )
        }
      }
    }

    rows.push(row)
  }

  const safeYear = opts.yearLabel.replace(/\s+/g, '-')
  const filename = `BMI-Marks-${safeYear}`
  downloadCsv(filename, rowsToCsv(rows))
}

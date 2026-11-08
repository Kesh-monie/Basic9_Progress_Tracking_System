import { PASS_MARK, type SectionName, SECTIONS } from './overviewStats.ts'
import { displayName } from '../lib/person.ts'
import { sortSubjects } from '../lib/subjects.ts'
import { resolveStudentPhoto } from '../lib/studentPhoto.ts'
import {
  supabase,
  type AssessmentRow,
  type MarkRow,
  type StudentRow,
  type SubjectRow,
} from '../lib/supabase.ts'

import engLogo from '../assets/image/eng.jpg'
import matLogo from '../assets/image/mat.jpg'
import sciLogo from '../assets/image/sci.jpg'
import socLogo from '../assets/image/soc.jpg'
import ictLogo from '../assets/image/ict.jpg'
import rmeLogo from '../assets/image/rme.jpg'
import fanLogo from '../assets/image/fan.jpg'
import creLogo from '../assets/image/cre.jpg'
import carLogo from '../assets/image/car.jpg'
import freLogo from '../assets/image/fre.jpg'

const SUBJECT_LOGOS: Record<string, string> = {
  ENG: engLogo,
  MAT: matLogo,
  SCI: sciLogo,
  SOC: socLogo,
  ICT: ictLogo,
  RME: rmeLogo,
  FAN: fanLogo,
  CRE: creLogo,
  CAR: carLogo,
  FRE: freLogo,
}

/** One written sitting (first test or a resit). */
export type SittingMark = {
  attemptNo: number
  /** e.g. "Test", "Resit 1", "Resit 2" */
  label: string
  score: number | null
  status: 'scored' | 'did_not_write'
}

/** First sitting vs resit breakdown for one assessment. */
export type AssessmentAttemptView = {
  firstSit: number | null
  bestResit: number | null
  hasResit: boolean
  /** Every recorded sitting for this assessment, in attempt order. */
  sittings: SittingMark[]
}

/** One assessment that still requires a resit for this student. */
export type ResitNeededItem = {
  assessmentIndex: number
  assessmentName: string
  reason: 'below_pass' | 'did_not_write'
  /** Best mark so far; null when the only record is DNW. */
  bestScore: number | null
}

export type LiveStudent = {
  id: number
  studentId: string
  name: string
  section: SectionName
  photo: string
  /** Per-assessment best scores; null = not recorded in the database. */
  scores: (number | null)[]
  /** Per-assessment first sit / resit breakdown (same order as scores). */
  attempts: AssessmentAttemptView[]
  resitsWritten: number
  /** Assessments that still need a resit (fail or DNW). */
  resitsNeeded: ResitNeededItem[]
  /** First assessment scored mark (null if unrecorded). */
  test1: number | null
  /** Latest assessment scored mark used for status (null if unrecorded). */
  test2: number | null
  /** True when the focus assessment is recorded as did not write / absent. */
  absent: boolean
  /** Latest assessment first-sit score (attempt 1), if recorded. */
  latestFirstSit: number | null
  /** Latest assessment best resit score, if the student wrote a resit. */
  latestResit: number | null
  /** True when the student has a scored resit for the latest assessment. */
  latestHasResit: boolean
}

export type SubjectAverage = {
  subject: string
  average: number | null
  logo: string
  subjectId: number
  hasMarks: boolean
}

export type OverviewBundle = {
  students: LiveStudent[]
  testAverages: { test: string; average: number | null; hasMarks: boolean }[]
  subjectAverages: SubjectAverage[]
  activities: string[]
  didNotWrite: LiveStudent[]
  fromDatabase: boolean
}

function normalizeSection(value: string): SectionName {
  const upper = value.trim().toUpperCase()
  if ((SECTIONS as readonly string[]).includes(upper)) {
    return upper as SectionName
  }
  return 'TULIPS'
}

function marksForAssessment(
  marks: MarkRow[],
  studentId: number,
  assessmentId: number,
  subjectId: number | null,
) {
  return marks.filter(
    (m) =>
      m.student_id === studentId &&
      m.assessment_id === assessmentId &&
      (subjectId == null || m.subject_id === subjectId),
  )
}

function bestScoreFor(
  marks: MarkRow[],
  studentId: number,
  assessmentId: number,
  subjectId: number | null,
): number | null {
  const relevant = marksForAssessment(
    marks,
    studentId,
    assessmentId,
    subjectId,
  ).filter((m) => m.status !== 'did_not_write' && m.score != null)
  if (relevant.length === 0) return null
  return Math.max(...relevant.map((m) => m.score as number))
}

function sittingLabel(attemptNo: number) {
  return attemptNo <= 1 ? 'Test' : `Resit ${attemptNo - 1}`
}

function attemptViewFor(
  marks: MarkRow[],
  studentId: number,
  assessmentId: number,
  subjectId: number | null,
): AssessmentAttemptView {
  const relevant = marksForAssessment(
    marks,
    studentId,
    assessmentId,
    subjectId,
  )
  const byAttempt = new Map<number, MarkRow>()
  for (const mark of relevant) {
    const existing = byAttempt.get(mark.attempt_no)
    if (!existing) {
      byAttempt.set(mark.attempt_no, mark)
      continue
    }
    // Prefer a scored mark if duplicates exist for the same attempt.
    if (existing.status !== 'scored' && mark.status === 'scored') {
      byAttempt.set(mark.attempt_no, mark)
    }
  }
  const sittings: SittingMark[] = [...byAttempt.values()]
    .sort((a, b) => a.attempt_no - b.attempt_no)
    .map((mark) => ({
      attemptNo: mark.attempt_no,
      label: sittingLabel(mark.attempt_no),
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

function wasAbsentFor(
  marks: MarkRow[],
  studentId: number,
  assessmentId: number,
  subjectId: number | null,
): boolean {
  const scored = bestScoreFor(marks, studentId, assessmentId, subjectId)
  if (scored != null) return false
  return marks.some(
    (m) =>
      m.student_id === studentId &&
      m.assessment_id === assessmentId &&
      (subjectId == null || m.subject_id === subjectId) &&
      m.status === 'did_not_write',
  )
}

function resitCountFor(
  marks: MarkRow[],
  studentId: number,
  subjectId: number | null,
) {
  return marks.filter(
    (m) =>
      m.student_id === studentId &&
      m.attempt_no > 1 &&
      (subjectId == null || m.subject_id === subjectId),
  ).length
}

function resitsNeededFor(
  scores: (number | null)[],
  attempts: AssessmentAttemptView[],
  assessments: AssessmentRow[],
): ResitNeededItem[] {
  const items: ResitNeededItem[] = []
  for (let i = 0; i < assessments.length; i += 1) {
    const best = scores[i] ?? null
    const scored = typeof best === 'number' && !Number.isNaN(best)
    const attempt = attempts[i]
    const didNotWrite =
      !scored &&
      (attempt?.sittings.some((s) => s.status === 'did_not_write') ?? false)

    if (scored && (best as number) < PASS_MARK) {
      items.push({
        assessmentIndex: i,
        assessmentName: assessments[i].name,
        reason: 'below_pass',
        bestScore: best,
      })
      continue
    }
    if (didNotWrite) {
      items.push({
        assessmentIndex: i,
        assessmentName: assessments[i].name,
        reason: 'did_not_write',
        bestScore: null,
      })
    }
  }
  return items
}

export async function loadOverviewBundle(opts: {
  yearId: number | null
  subjectId: number | null
}): Promise<OverviewBundle> {
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
    let query = supabase
      .from('marks')
      .select(
        'id, student_id, subject_id, assessment_id, attempt_no, score, status, entered_by, created_at',
      )
      .in('assessment_id', assessmentIds)
      .order('created_at', { ascending: false })
      .limit(5000)
    if (opts.subjectId != null) {
      query = query.eq('subject_id', opts.subjectId)
    }
    const { data } = await query
    marks = (data ?? []) as MarkRow[]
  }

  const focusAssessment =
    assessments.length > 0 ? assessments[assessments.length - 1] : null
  const firstAssessment = assessments[0] ?? null

  const students: LiveStudent[] = dbStudents.map((row) => {
    const section = normalizeSection(row.section)
    const scores = assessments.map((assessment) =>
      bestScoreFor(marks, row.id, assessment.id, opts.subjectId),
    )
    const attempts = assessments.map((assessment) =>
      attemptViewFor(marks, row.id, assessment.id, opts.subjectId),
    )
    const test1 =
      firstAssessment != null
        ? bestScoreFor(marks, row.id, firstAssessment.id, opts.subjectId)
        : null
    const test2 =
      focusAssessment != null
        ? bestScoreFor(marks, row.id, focusAssessment.id, opts.subjectId)
        : null
    const absent =
      focusAssessment != null &&
      wasAbsentFor(marks, row.id, focusAssessment.id, opts.subjectId)
    const latestAttempt =
      focusAssessment != null
        ? attemptViewFor(marks, row.id, focusAssessment.id, opts.subjectId)
        : {
            firstSit: null,
            bestResit: null,
            hasResit: false,
            sittings: [],
          }

    return {
      id: row.id,
      studentId: row.identity_code,
      name: displayName(row.full_name, row.gender),
      section,
      photo: resolveStudentPhoto(row.photo_url, row.gender),
      scores,
      attempts,
      resitsWritten: resitCountFor(marks, row.id, opts.subjectId),
      resitsNeeded: resitsNeededFor(scores, attempts, assessments),
      test1,
      test2,
      absent,
      latestFirstSit: latestAttempt.firstSit,
      latestResit: latestAttempt.bestResit,
      latestHasResit: latestAttempt.hasResit,
    }
  })

  const testAverages = assessments.map((assessment) => {
    const scores = students
      .map((s) => bestScoreFor(marks, s.id, assessment.id, opts.subjectId))
      .filter((n): n is number => n != null)
    return {
      test: assessment.name,
      average:
        scores.length === 0
          ? null
          : Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length),
      hasMarks: scores.length > 0,
    }
  })

  const subjectAverages: SubjectAverage[] = dbSubjects.map((subject) => {
    const scores = marks
      .filter(
        (m) =>
          m.subject_id === subject.id &&
          m.status !== 'did_not_write' &&
          m.score != null,
      )
      .map((m) => m.score as number)
    return {
      subject: subject.name,
      average:
        scores.length === 0
          ? null
          : Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length),
      logo: SUBJECT_LOGOS[subject.code] ?? engLogo,
      subjectId: subject.id,
      hasMarks: scores.length > 0,
    }
  })

  const didNotWrite = students.filter((s) => s.absent)

  const activities: string[] = []
  for (const mark of marks.slice(0, 6)) {
    const student = dbStudents.find((s) => s.id === mark.student_id)
    const subject = dbSubjects.find((s) => s.id === mark.subject_id)
    const assessment = assessments.find((a) => a.id === mark.assessment_id)
    if (student && subject && assessment) {
      const detail =
        mark.status === 'did_not_write' ? 'absent' : `${mark.score}%`
      activities.push(
        `${student.full_name}: ${detail} in ${subject.name} · ${assessment.name}`,
      )
    }
  }

  return {
    students,
    testAverages,
    subjectAverages,
    activities,
    didNotWrite,
    fromDatabase: true,
  }
}

/** Module cache so student detail / list pages can reuse the last overview load. */
let cachedStudents: LiveStudent[] = []
let cachedTestLabels: string[] = []
let cachedSubjectName: string | null = null
let cachedSubjectId: number | null = null

export function getCachedStudents() {
  return cachedStudents
}

export function setCachedStudents(students: LiveStudent[]) {
  cachedStudents = students
}

export function getCachedTestLabels() {
  return cachedTestLabels
}

export function setCachedTestLabels(labels: string[]) {
  cachedTestLabels = labels
}

export function getCachedSubjectName() {
  return cachedSubjectName
}

export function setCachedSubjectName(name: string | null) {
  cachedSubjectName = name
}

export function getCachedSubjectId() {
  return cachedSubjectId
}

export function setCachedSubjectId(id: number | null) {
  cachedSubjectId = id
}

export function getCachedStudentById(id: number | string) {
  const numericId = Number(id)
  return cachedStudents.find((student) => student.id === numericId)
}

export function getCachedSectionMates(section: string, excludeId: number) {
  return cachedStudents.filter(
    (student) => student.section === section && student.id !== excludeId,
  )
}

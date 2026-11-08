import { createClient } from '@supabase/supabase-js'
import type { Gender } from './person.ts'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anonKey)

export type StaffRole = 'supervisor' | 'teacher'

export type StaffRow = {
  id: number
  identity_code: string
  full_name: string
  role: StaffRole
  password_hash: string
  subject_id: number | null
  gender: Gender | null
  can_enter_marks: boolean
}

export type SubjectRow = {
  id: number
  name: string
  code: string
}

export type AcademicYearRow = {
  id: number
  label: string
  is_active: boolean
  bece_exam_year?: number | null
  bece_student_count?: number | null
  bece_pass_rate?: number | null
  bece_best_aggregate?: number | null
}

export type StudentRow = {
  id: number
  identity_code: string
  full_name: string
  section: string
  photo_url: string | null
  academic_year_id: number | null
  gender: Gender | null
  date_of_birth: string | null
}

export type AssessmentRow = {
  id: number
  academic_year_id: number
  name: string
  sequence_no: number
}

export type MarkStatus = 'scored' | 'did_not_write'

export type MarkRow = {
  id: number
  student_id: number
  subject_id: number
  assessment_id: number
  attempt_no: number
  score: number | null
  status: MarkStatus
  entered_by: number
  created_at: string
}

export type AssessmentSittingRow = {
  id: number
  assessment_id: number
  subject_id: number
  attempt_no: number
  written_on: string
  entered_by: number | null
  created_at: string
}

/** Result-slip / overview: highest scored attempt wins. */
export function bestScoredMark(
  marks: Pick<MarkRow, 'score' | 'status' | 'attempt_no'>[],
): number | null {
  const scored = marks
    .filter((m) => m.status === 'scored' && m.score != null)
    .map((m) => m.score as number)
  if (scored.length === 0) return null
  return Math.max(...scored)
}

import { displayName } from './person.ts'
import { supabase } from './supabase.ts'

type StaffNameRow = {
  full_name: string
  gender: string | null
}

function toTeacherLabel(row: StaffNameRow | null | undefined) {
  if (!row?.full_name) return null
  const name = displayName(row.full_name, row.gender).trim()
  return name || null
}

/** Resolve the assigned teacher display name for a subject. */
export async function fetchSubjectTeacherName(
  subjectId: number,
): Promise<string | null> {
  const byRole = await supabase
    .from('staff')
    .select('full_name, gender, subject_id')
    .eq('role', 'teacher')
    .eq('subject_id', subjectId)
    .order('id', { ascending: true })
    .limit(1)

  const fromRole = toTeacherLabel(
    (byRole.data?.[0] as StaffNameRow | undefined) ?? null,
  )
  if (fromRole) return fromRole

  // Fallback if role casing/legacy rows differ but subject is assigned.
  const bySubject = await supabase
    .from('staff')
    .select('full_name, gender, subject_id, role')
    .eq('subject_id', subjectId)
    .order('id', { ascending: true })
    .limit(5)

  const rows = (bySubject.data ?? []) as Array<
    StaffNameRow & { role: string | null }
  >
  const teacherRow =
    rows.find((r) => (r.role ?? '').trim().toLowerCase() === 'teacher') ??
    rows[0]
  return toTeacherLabel(teacherRow)
}

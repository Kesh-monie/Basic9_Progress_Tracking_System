/** Core subjects first: English, Maths, Science, Social Studies, then the rest. */
const CORE_CODES = ['ENG', 'MAT', 'SCI', 'SOC'] as const

const CORE_NAME_PATTERNS: RegExp[] = [
  /^english$/i,
  /^(math|maths|mathematics)$/i,
  /^science$/i,
  /^social(\s+studies)?$/i,
]

function coreRank(name: string, code?: string | null): number {
  const c = (code ?? '').trim().toUpperCase()
  if (c) {
    const byCode = CORE_CODES.indexOf(c as (typeof CORE_CODES)[number])
    if (byCode >= 0) return byCode
  }
  const n = name.trim()
  for (let i = 0; i < CORE_NAME_PATTERNS.length; i += 1) {
    if (CORE_NAME_PATTERNS[i].test(n)) return i
  }
  return CORE_CODES.length
}

export function compareSubjects(
  a: { name: string; code?: string | null },
  b: { name: string; code?: string | null },
): number {
  const ra = coreRank(a.name, a.code)
  const rb = coreRank(b.name, b.code)
  if (ra !== rb) return ra - rb
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function sortSubjects<T extends { name: string; code?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort(compareSubjects)
}

/** For display rows that use `subject` instead of `name`. */
export function sortSubjectDisplay<
  T extends { subject: string; code?: string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    compareSubjects(
      { name: a.subject, code: a.code },
      { name: b.subject, code: b.code },
    ),
  )
}

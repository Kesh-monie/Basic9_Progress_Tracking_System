/**
 * Ghana BECE-style stanine grades from raw percentage scores.
 * Grade 1 is best; grade 9 is lowest.
 */
export type BeceGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

const GRADE_BANDS: { min: number; grade: BeceGrade; label: string }[] = [
  { min: 90, grade: 1, label: 'Highest' },
  { min: 80, grade: 2, label: 'Higher' },
  { min: 70, grade: 3, label: 'High' },
  { min: 60, grade: 4, label: 'High Average' },
  { min: 55, grade: 5, label: 'Average' },
  { min: 50, grade: 6, label: 'Low Average' },
  { min: 40, grade: 7, label: 'Low' },
  { min: 35, grade: 8, label: 'Lower' },
  { min: 0, grade: 9, label: 'Lowest' },
]

export function beceGradeFromScore(score: number | null | undefined): BeceGrade | null {
  if (score == null || Number.isNaN(score)) return null
  const clamped = Math.max(0, Math.min(100, score))
  for (const band of GRADE_BANDS) {
    if (clamped >= band.min) return band.grade
  }
  return 9
}

export function beceGradeLabel(grade: BeceGrade | null | undefined): string {
  if (grade == null) return '—'
  return GRADE_BANDS.find((b) => b.grade === grade)?.label ?? '—'
}

export function formatBeceGrade(grade: BeceGrade | null | undefined): string {
  if (grade == null) return '—'
  return String(grade)
}

/** Core four always count toward the BECE-style aggregate. */
export function isBeceCoreCode(code: string | null | undefined): boolean {
  const c = (code ?? '').trim().toUpperCase()
  return c === 'ENG' || c === 'MAT' || c === 'SCI' || c === 'SOC'
}

export type AggregateSubjectInput = {
  code?: string | null
  name: string
  grade: BeceGrade | null
}

export type AggregateBreakdown = {
  aggregate: number | null
  coreGrades: number[]
  electiveGrades: number[]
  electiveNames: string[]
  complete: boolean
}

/**
 * Aggregate = English + Mathematics + Science + Social Studies
 * + the best (lowest grade numbers) two of the remaining subjects.
 */
export function computeBeceAggregate(
  subjects: AggregateSubjectInput[],
): AggregateBreakdown {
  const core: AggregateSubjectInput[] = []
  const electives: AggregateSubjectInput[] = []

  for (const subject of subjects) {
    if (isBeceCoreCode(subject.code)) core.push(subject)
    else electives.push(subject)
  }

  const coreGraded = core.filter((s) => s.grade != null)
  if (coreGraded.length < 4) {
    return {
      aggregate: null,
      coreGrades: coreGraded.map((s) => s.grade as number),
      electiveGrades: [],
      electiveNames: [],
      complete: false,
    }
  }

  const electiveGraded = electives
    .filter((s) => s.grade != null)
    .sort((a, b) => (a.grade as number) - (b.grade as number))
  const bestTwo = electiveGraded.slice(0, 2)

  const coreGrades = coreGraded.map((s) => s.grade as number)
  const electiveGrades = bestTwo.map((s) => s.grade as number)
  const electiveNames = bestTwo.map((s) => s.name)
  const aggregate =
    coreGrades.reduce((sum, n) => sum + n, 0) +
    electiveGrades.reduce((sum, n) => sum + n, 0)

  return {
    aggregate,
    coreGrades,
    electiveGrades,
    electiveNames,
    complete: bestTwo.length === 2,
  }
}

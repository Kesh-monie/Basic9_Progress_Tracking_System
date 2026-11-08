import type {
  LiveStudent,
  ResitNeededItem,
} from '../data/loadOverview.ts'
import { PASS_MARK } from '../data/overviewStats.ts'

/** Format a recorded score, or a dash when nothing is in the database. */
export function formatScore(score: number | null | undefined): string {
  if (score == null) return '—'
  return `${score}%`
}

export function hasScore(score: number | null | undefined): score is number {
  return typeof score === 'number' && !Number.isNaN(score)
}

export type StudentProgressView = {
  label: string
  from: number
  to: number
  delta: number
  /** True when progress is first sitting → resit on the same test. */
  isResit: boolean
}

/**
 * Progress for UI:
 * 1. Prefer first sit → best resit on the most recent test that has a resit
 *    (so 82 then resit 98 shows +16%, not best 98 → best 98).
 * 2. Otherwise first sit of Test 1 → best of latest test.
 * 3. Otherwise best of Test 1 → best of latest.
 */
export function resolveStudentProgress(
  student: LiveStudent,
  testLabels: string[] = [],
): StudentProgressView | null {
  for (let i = student.attempts.length - 1; i >= 0; i -= 1) {
    const attempt = student.attempts[i]
    if (
      attempt?.hasResit &&
      hasScore(attempt.firstSit) &&
      hasScore(attempt.bestResit)
    ) {
      const label = testLabels[i] ?? `Test ${i + 1}`
      return {
        label: `${label} → Resit`,
        from: attempt.firstSit,
        to: attempt.bestResit,
        delta: attempt.bestResit - attempt.firstSit,
        isResit: true,
      }
    }
  }

  const firstAttempt = student.attempts[0]
  const from =
    hasScore(firstAttempt?.firstSit) ? firstAttempt.firstSit : student.test1
  const to = student.test2
  if (!hasScore(from) || !hasScore(to)) return null

  // One assessment only: first sit → best (avoids best→best when both are 98).
  if (student.attempts.length <= 1 && hasScore(firstAttempt?.firstSit)) {
    return {
      label: firstAttempt?.hasResit ? 'Test → Resit' : 'First sit → Best',
      from: firstAttempt.firstSit,
      to,
      delta: to - firstAttempt.firstSit,
      isResit: Boolean(firstAttempt?.hasResit),
    }
  }

  return {
    label: 'Test 1 → Latest',
    from,
    to,
    delta: to - from,
    isResit: false,
  }
}

/**
 * Needs a resit when:
 * - marked did not write / absent for the assessment, or
 * - a real scored mark exists and is below the pass mark.
 */
export function needsResit(
  score: number | null | undefined,
  absent = false,
): boolean {
  if (absent) return true
  return hasScore(score) && score < PASS_MARK
}

/** True when the student still owes a resit on one or more assessments. */
export function studentNeedsAnyResit(
  student: Pick<LiveStudent, 'resitsNeeded'> | null | undefined,
): boolean {
  return (student?.resitsNeeded.length ?? 0) > 0
}

export function formatResitNeededItem(item: ResitNeededItem): string {
  if (item.reason === 'did_not_write') {
    return `${item.assessmentName} (DNW)`
  }
  return `${item.assessmentName} (${item.bestScore}%)`
}

/** Short status line naming every test that still needs a resit. */
export function formatResitsNeededStatus(
  student: Pick<LiveStudent, 'resitsNeeded'> | null | undefined,
): string {
  const items = student?.resitsNeeded ?? []
  if (items.length === 0) return 'Target met'
  if (items.length === 1) {
    return `Resit needed · ${formatResitNeededItem(items[0])}`
  }
  return `Resits needed · ${items.map(formatResitNeededItem).join(' · ')}`
}

export function metTarget(score: number | null | undefined): boolean {
  return hasScore(score) && score >= PASS_MARK
}

export function averageOf(scores: Array<number | null | undefined>): number | null {
  const values = scores.filter(hasScore)
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)
}

export function maxOf(scores: Array<number | null | undefined>): number | null {
  const values = scores.filter(hasScore)
  if (values.length === 0) return null
  return Math.max(...values)
}

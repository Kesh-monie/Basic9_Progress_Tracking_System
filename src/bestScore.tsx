import besIcon from './assets/image/bes.svg'
import StudentListPage from './components/StudentListPage.tsx'
import { PASS_MARK } from './data/overviewStats.ts'
import { getCachedStudents } from './data/loadOverview.ts'
import { maxOf, metTarget } from './lib/marks.ts'

export default function BestScore() {
  const roster = getCachedStudents()
  const bestScore = maxOf(roster.map((s) => s.test2))
  const students = [...roster]
    .filter((s) => metTarget(s.test2))
    .sort(
      (a, b) =>
        (b.test2 ?? 0) - (a.test2 ?? 0) || a.id - b.id,
    )

  return (
    <StudentListPage
      title="Best Score"
      subtitle={`Students who reached ${PASS_MARK}% or higher`}
      tone="orange"
      icon={besIcon}
      students={students}
      headlineValue={bestScore != null ? `${bestScore}%` : '—'}
      mode="best"
      emptyHint="No student has a recorded mark at the 90% target yet."
    />
  )
}

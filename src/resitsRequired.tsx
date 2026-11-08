import resIcon from './assets/image/res.svg'
import StudentListPage from './components/StudentListPage.tsx'
import { PASS_MARK } from './data/overviewStats.ts'
import { getCachedStudents } from './data/loadOverview.ts'
import { studentNeedsAnyResit } from './lib/marks.ts'

export default function ResitsRequired() {
  const students = [...getCachedStudents()]
    .filter((s) => studentNeedsAnyResit(s))
    .sort(
      (a, b) =>
        b.resitsNeeded.length - a.resitsNeeded.length ||
        Number(b.absent) - Number(a.absent) ||
        (a.test2 ?? -1) - (b.test2 ?? -1) ||
        b.resitsWritten - a.resitsWritten ||
        a.id - b.id,
    )

  return (
    <StudentListPage
      title="Resits Required"
      subtitle={`Any test below ${PASS_MARK}% or marked DNW`}
      tone="red"
      icon={resIcon}
      students={students}
      headlineValue={students.length}
      mode="resit"
      emptyHint="No students need a resit right now."
    />
  )
}

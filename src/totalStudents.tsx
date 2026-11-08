import totIcon from './assets/image/tot.svg'
import StudentListPage from './components/StudentListPage.tsx'
import { getCachedStudents } from './data/loadOverview.ts'

export default function TotalStudents() {
  const students = [...getCachedStudents()].sort((a, b) => a.id - b.id)

  return (
    <StudentListPage
      title="Total Students"
      subtitle="Full class list for this assessment"
      tone="blue"
      icon={totIcon}
      students={students}
      headlineValue={students.length}
      mode="total"
      emptyHint="No students match this search or section filter."
    />
  )
}

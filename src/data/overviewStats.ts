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
import photo1 from '../assets/image/111.jpg'
import photo2 from '../assets/image/222.jpg'
import photo3 from '../assets/image/333.jpg'
import photo4 from '../assets/image/444.jpg'
import photo5 from '../assets/image/555.jpg'
import photo6 from '../assets/image/666.jpg'
import photo7 from '../assets/image/777.jpg'
import photo8 from '../assets/image/888.jpg'
import photo9 from '../assets/image/bmi.jpg'
import photo10 from '../assets/image/school-badge.jpg'

export const SECTIONS = ['TULIPS', 'ROSES', 'LILIES'] as const
export type SectionName = (typeof SECTIONS)[number]

export const testAverages = [
  { test: 'Test 1', average: 52 },
  { test: 'Test 2', average: 58 },
  { test: 'Test 3', average: 61 },
  { test: 'Test 4', average: 67 },
  { test: 'Test 5', average: 73 },
  { test: 'Test 6', average: 78 },
]

export const subjectAverages = [
  { subject: 'English', average: 71, logo: engLogo, subjectId: 1 },
  { subject: 'Mathematics', average: 64, logo: matLogo, subjectId: 2 },
  { subject: 'Science', average: 68, logo: sciLogo, subjectId: 3 },
  { subject: 'Social Studies', average: 76, logo: socLogo, subjectId: 4 },
  { subject: 'ICT', average: 78, logo: ictLogo, subjectId: 5 },
  { subject: 'RME', average: 81, logo: rmeLogo, subjectId: 6 },
  { subject: 'Fante', average: 74, logo: fanLogo, subjectId: 7 },
  { subject: 'Creative Arts', average: 72, logo: creLogo, subjectId: 8 },
  { subject: 'Career Technology', average: 70, logo: carLogo, subjectId: 9 },
  { subject: 'French', average: 59, logo: freLogo, subjectId: 10 },
]

export const PASS_MARK = 90
export const PASS_NEAR = 5

type StudentSeed = {
  id: number
  studentId: string
  name: string
  section: SectionName
  photo: string
  scores: [number, number, number, number, number, number]
  resitsWritten: number
}

const studentSeeds: StudentSeed[] = [
  {
    id: 1,
    studentId: '1001',
    name: 'Ama Mensah',
    section: 'TULIPS',
    photo: photo1,
    scores: [70, 85, 78, 82, 86, 88],
    resitsWritten: 1,
  },
  {
    id: 2,
    studentId: '1002',
    name: 'Kwame Asante',
    section: 'TULIPS',
    photo: photo2,
    scores: [88, 92, 90, 91, 93, 94],
    resitsWritten: 0,
  },
  {
    id: 3,
    studentId: '1003',
    name: 'Efua Boateng',
    section: 'ROSES',
    photo: photo3,
    scores: [75, 68, 70, 66, 72, 69],
    resitsWritten: 2,
  },
  {
    id: 4,
    studentId: '1004',
    name: 'Kojo Owusu',
    section: 'ROSES',
    photo: photo4,
    scores: [60, 78, 74, 80, 81, 83],
    resitsWritten: 3,
  },
  {
    id: 5,
    studentId: '1005',
    name: 'Abena Darko',
    section: 'TULIPS',
    photo: photo5,
    scores: [82, 90, 88, 89, 91, 92],
    resitsWritten: 1,
  },
  {
    id: 6,
    studentId: '1006',
    name: 'Yaw Adjei',
    section: 'LILIES',
    photo: photo6,
    scores: [74, 74, 76, 75, 77, 78],
    resitsWritten: 1,
  },
  {
    id: 7,
    studentId: '1007',
    name: 'Akosua Frimpong',
    section: 'LILIES',
    photo: photo7,
    scores: [55, 71, 68, 73, 75, 77],
    resitsWritten: 2,
  },
  {
    id: 8,
    studentId: '1008',
    name: 'Kofi Appiah',
    section: 'ROSES',
    photo: photo8,
    scores: [91, 84, 86, 85, 87, 88],
    resitsWritten: 0,
  },
  {
    id: 9,
    studentId: '1009',
    name: 'Adwoa Sarpong',
    section: 'LILIES',
    photo: photo9,
    scores: [66, 93, 90, 92, 94, 95],
    resitsWritten: 2,
  },
  {
    id: 10,
    studentId: '1010',
    name: 'Nana Osei',
    section: 'TULIPS',
    photo: photo10,
    scores: [80, 77, 79, 78, 80, 81],
    resitsWritten: 1,
  },
]

export const studentProgress = studentSeeds.map((student) => ({
  ...student,
  test1: student.scores[0],
  test2: student.scores[1],
}))

export function getStudentById(id: number | string) {
  const numericId = Number(id)
  return studentProgress.find((student) => student.id === numericId)
}

export function getSectionMates(section: string, excludeId: number) {
  return studentProgress.filter(
    (student) => student.section === section && student.id !== excludeId,
  )
}

export const sampleActivities = [
  'Marks entered for Mathematics · Test 2',
  '3 students added to TULIPS',
  'Resit recorded for French · Test 1',
  'New assessment created: Test 3',
]

export const sampleAttendance = {
  present: 86,
  late: 8,
  absent: 6,
}

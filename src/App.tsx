import { useEffect, useState, type ReactNode } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext.tsx'
import { ThemeProvider } from './auth/ThemeContext.tsx'
import { YearProvider } from './auth/YearContext.tsx'
import RequireAuth from './auth/RequireAuth.tsx'
import Header from './components/Header.tsx'
import LoginModal from './components/LoginModal.tsx'
import YearSwitchModal from './components/YearSwitchModal.tsx'
import Home from './home.tsx'
import EditStaff from './editStaff.tsx'
import EditStudents from './editStudents.tsx'
import ManageAssessments from './manageAssessments.tsx'
import ManageBece from './manageBece.tsx'
import ManageMarks from './manageMarks.tsx'
import ManageStaff from './manageStaff.tsx'
import ManageStudents from './manageStudents.tsx'
import ManageTeacherAccess from './manageTeacherAccess.tsx'
import Overview from './overview.tsx'
import TotalStudents from './totalStudents.tsx'
import BestScore from './bestScore.tsx'
import ResitsRequired from './resitsRequired.tsx'
import StudentInfo from './student_info.tsx'

function HomeWithLogin() {
  const { user, loading } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('login') === '1') setLoginOpen(true)
  }, [searchParams])

  const closeLogin = () => {
    setLoginOpen(false)
    if (searchParams.get('login') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('login')
      setSearchParams(next, { replace: true })
    }
  }

  // Session restored (or still active): don't show the public home as if signed out.
  if (!loading && user) {
    return <Navigate to="/overview" replace />
  }

  return (
    <>
      <Header showSignIn onSignIn={() => setLoginOpen(true)} />
      <Home />
      <LoginModal open={loginOpen} onClose={closeLogin} />
    </>
  )
}

function Protected({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <>
        <Header />
        {children}
      </>
    </RequireAuth>
  )
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <YearProvider>
      <BrowserRouter>
        <YearSwitchModal />
        <Routes>
          <Route path="/" element={<HomeWithLogin />} />
          <Route path="/login" element={<Navigate to="/?login=1" replace />} />
          <Route
            path="/overview"
            element={
              <Protected>
                <Overview />
              </Protected>
            }
          />
          <Route
            path="/overview/subject/:subjectId"
            element={
              <Protected>
                <Overview />
              </Protected>
            }
          />
          <Route
            path="/total-students"
            element={
              <Protected>
                <TotalStudents />
              </Protected>
            }
          />
          <Route
            path="/best-score"
            element={
              <Protected>
                <BestScore />
              </Protected>
            }
          />
          <Route
            path="/resits-required"
            element={
              <Protected>
                <ResitsRequired />
              </Protected>
            }
          />
          <Route
            path="/student-info/:id"
            element={
              <Protected>
                <StudentInfo />
              </Protected>
            }
          />
          <Route
            path="/manage/staff"
            element={
              <Protected>
                <ManageStaff />
              </Protected>
            }
          />
          <Route
            path="/manage/staff/edit"
            element={
              <Protected>
                <EditStaff />
              </Protected>
            }
          />
          <Route
            path="/manage/students"
            element={
              <Protected>
                <ManageStudents />
              </Protected>
            }
          />
          <Route
            path="/manage/students/edit"
            element={
              <Protected>
                <EditStudents />
              </Protected>
            }
          />
          <Route
            path="/manage/assessments"
            element={
              <Protected>
                <ManageAssessments />
              </Protected>
            }
          />
          <Route
            path="/manage/marks"
            element={
              <Protected>
                <ManageMarks />
              </Protected>
            }
          />
          <Route
            path="/manage/teacher-access"
            element={
              <Protected>
                <ManageTeacherAccess />
              </Protected>
            }
          />
          <Route
            path="/manage/bece"
            element={
              <Protected>
                <ManageBece />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </YearProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App

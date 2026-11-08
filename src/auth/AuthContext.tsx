import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { friendlyError } from '../lib/friendlyError.ts'
import { displayName, type Gender } from '../lib/person.ts'
import { supabase, type StaffRole, type StaffRow } from '../lib/supabase.ts'
import { verifyPassword } from '../lib/password.ts'
import { startIdleLogout } from './idleLogout.ts'

export type AuthUser = {
  id: number
  identityCode: string
  fullName: string
  displayName: string
  role: StaffRole
  subjectId: number | null
  gender: Gender | null
  canEnterMarks: boolean
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (
    identityCode: string,
    role: StaffRole,
    password: string,
  ) => Promise<string | null>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const STORAGE_KEY = 'bmi_staff_session'
const LEGACY_STORAGE_KEY = 'fysapts_staff_session'

function toUser(row: StaffRow): AuthUser {
  const fullName = row.full_name
  return {
    id: row.id,
    identityCode: row.identity_code.trim().toUpperCase(),
    fullName,
    displayName: displayName(fullName, row.gender),
    role: row.role,
    subjectId: row.subject_id,
    gender: row.gender ?? null,
    canEnterMarks: row.role === 'supervisor' ? true : Boolean(row.can_enter_marks),
  }
}

function normalizeRole(value: string): StaffRole | null {
  const role = value.trim().toLowerCase()
  if (role === 'supervisor' || role === 'teacher') return role
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ??
        localStorage.getItem(LEGACY_STORAGE_KEY)
      if (raw) {
        setUser(JSON.parse(raw) as AuthUser)
        if (localStorage.getItem(STORAGE_KEY) == null) {
          localStorage.setItem(STORAGE_KEY, raw)
          localStorage.removeItem(LEGACY_STORAGE_KEY)
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    setLoading(false)
  }, [])

  const persist = (next: AuthUser) => {
    setUser(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }

  // Sign out supervisor/teacher after 30 minutes idle.
  useEffect(() => {
    if (!user) return
    return startIdleLogout(() => {
      logout()
    })
  }, [user])

  const refreshUser = async () => {
    if (!user) return
    const { data } = await supabase
      .from('staff')
      .select(
        'id, identity_code, full_name, role, password_hash, subject_id, gender, can_enter_marks',
      )
      .eq('id', user.id)
      .maybeSingle()
    if (!data) return
    const row = data as StaffRow
    const normalizedRole = normalizeRole(row.role)
    if (!normalizedRole) return
    persist(toUser({ ...row, role: normalizedRole }))
  }

  const login = async (
    identityCode: string,
    role: StaffRole,
    password: string,
  ) => {
    const code = identityCode.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(code)) {
      return 'Staff ID must be exactly 3 letters.'
    }

    const { data, error } = await supabase
      .from('staff')
      .select(
        'id, identity_code, full_name, role, password_hash, subject_id, gender, can_enter_marks',
      )
      .limit(200)

    if (error) {
      return friendlyError(
        error,
        'Could not sign in. Check your connection and try again.',
      )
    }

    const rows = (data ?? []) as StaffRow[]
    if (rows.length === 0) {
      return 'No staff accounts found. Ask a supervisor to set up the database.'
    }

    const matchesCode = rows.filter(
      (row) => row.identity_code.trim().toUpperCase() === code,
    )

    const row =
      matchesCode.find((item) => normalizeRole(item.role) === role) ?? null

    const wrongLogin = 'Wrong login details. Check your ID, role, and password.'

    if (!row) {
      return wrongLogin
    }

    const ok = await verifyPassword(password, row.password_hash)
    if (!ok) return wrongLogin

    const normalizedRole = normalizeRole(row.role)
    if (!normalizedRole) return 'Staff role in database is invalid.'

    if (normalizedRole === 'teacher' && row.subject_id == null) {
      return 'Teacher account has no subject assigned.'
    }

    persist(toUser({ ...row, role: normalizedRole }))
    return null
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

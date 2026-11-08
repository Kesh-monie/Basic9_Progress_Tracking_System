import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { friendlyError } from '../lib/friendlyError.ts'
import { supabase, type AcademicYearRow } from '../lib/supabase.ts'

type YearContextValue = {
  years: AcademicYearRow[]
  yearId: number | null
  year: AcademicYearRow | null
  loading: boolean
  refreshYears: () => Promise<void>
  /** Sets this year active in the database for the whole school. */
  setActiveYear: (id: number) => Promise<string | null>
  yearSwitcherOpen: boolean
  openYearSwitcher: () => void
  closeYearSwitcher: () => void
}

const YearContext = createContext<YearContextValue | null>(null)

export function YearProvider({ children }: { children: ReactNode }) {
  const [years, setYears] = useState<AcademicYearRow[]>([])
  const [yearId, setYearIdState] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [yearSwitcherOpen, setYearSwitcherOpen] = useState(false)

  const refreshYears = useCallback(async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('id, label, is_active')
      .order('id')
    const rows = (data ?? []) as AcademicYearRow[]
    setYears(rows)
    const active = rows.find((y) => y.is_active) ?? rows[rows.length - 1] ?? null
    setYearIdState(active?.id ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshYears()
  }, [refreshYears])

  const setActiveYear = async (id: number) => {
    if (!years.some((y) => y.id === id)) {
      return 'That academic year was not found.'
    }

    // Clear other active flags, then set the chosen year.
    const { error: clearError } = await supabase
      .from('academic_years')
      .update({ is_active: false })
      .neq('id', id)

    if (clearError) {
      return friendlyError(clearError, 'Could not switch academic year.')
    }

    const { error: setError } = await supabase
      .from('academic_years')
      .update({ is_active: true })
      .eq('id', id)

    if (setError) {
      return friendlyError(setError, 'Could not switch academic year.')
    }

    await refreshYears()
    return null
  }

  const year = years.find((y) => y.id === yearId) ?? null

  return (
    <YearContext.Provider
      value={{
        years,
        yearId,
        year,
        loading,
        refreshYears,
        setActiveYear,
        yearSwitcherOpen,
        openYearSwitcher: () => setYearSwitcherOpen(true),
        closeYearSwitcher: () => setYearSwitcherOpen(false),
      }}
    >
      {children}
    </YearContext.Provider>
  )
}

export function useYear() {
  const ctx = useContext(YearContext)
  if (!ctx) throw new Error('useYear must be used within YearProvider')
  return ctx
}

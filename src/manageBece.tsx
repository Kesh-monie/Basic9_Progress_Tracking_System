import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.tsx'
import { friendlyError } from './lib/friendlyError.ts'
import { supabase, type AcademicYearRow } from './lib/supabase.ts'
import './manage.css'

const YEAR_COUNT = 5

type BeceSlot = {
  examYear: number
  yearId: number | null
  studentCount: string
  passRate: string
  bestAggregate: string
}

function windowYears(endYear: number, count = YEAR_COUNT): number[] {
  return Array.from({ length: count }, (_, i) => endYear - (count - 1 - i))
}

function slotsFromYears(
  years: AcademicYearRow[],
  endYear: number,
): BeceSlot[] {
  return windowYears(endYear).map((examYear) => {
    const match = years.find((y) => y.bece_exam_year === examYear)
    return {
      examYear,
      yearId: match?.id ?? null,
      studentCount:
        match?.bece_student_count != null ? String(match.bece_student_count) : '',
      passRate:
        match?.bece_pass_rate != null ? String(match.bece_pass_rate) : '',
      bestAggregate:
        match?.bece_best_aggregate != null
          ? String(match.bece_best_aggregate)
          : '',
    }
  })
}

function defaultEndYear(years: AcademicYearRow[]): number {
  const saved = years
    .map((y) => y.bece_exam_year)
    .filter((y): y is number => y != null)
  const latestSaved = saved.length > 0 ? Math.max(...saved) : null
  const current = new Date().getFullYear()
  return Math.max(current, latestSaved ?? current)
}

function academicLabelForExam(examYear: number) {
  return `${examYear - 1}/${examYear}`
}

export default function ManageBece() {
  const { user } = useAuth()
  const [years, setYears] = useState<AcademicYearRow[]>([])
  const [endYear, setEndYear] = useState(() => new Date().getFullYear())
  const [slots, setSlots] = useState<BeceSlot[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const applyWindow = (rows: AcademicYearRow[], end: number) => {
    setEndYear(end)
    setSlots(slotsFromYears(rows, end))
  }

  const load = async (preferredEnd?: number) => {
    const { data, error: loadError } = await supabase
      .from('academic_years')
      .select(
        'id, label, is_active, bece_exam_year, bece_student_count, bece_pass_rate, bece_best_aggregate',
      )
      .order('id')
    if (loadError) {
      setError(friendlyError(loadError, 'Could not load BECE years.'))
      return
    }
    const rows = (data ?? []) as AcademicYearRow[]
    setYears(rows)
    const end = preferredEnd ?? (initialized ? endYear : defaultEndYear(rows))
    applyWindow(rows, end)
    setInitialized(true)
  }

  useEffect(() => {
    void load()
  }, [])

  if (user?.role !== 'supervisor') {
    return <Navigate to="/overview" replace />
  }

  const shiftWindow = (delta: number) => {
    setMessage(null)
    setError(null)
    applyWindow(years, endYear + delta)
  }

  const updateSlot = (examYear: number, patch: Partial<BeceSlot>) => {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.examYear === examYear ? { ...slot, ...patch } : slot,
      ),
    )
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const filled = slots.filter(
      (s) =>
        s.studentCount.trim() || s.passRate.trim() || s.bestAggregate.trim(),
    )

    if (filled.length === 0) {
      setError('Fill at least one of the five years.')
      return
    }

    for (const slot of filled) {
      const studentCount = Number(slot.studentCount)
      const passRate = Number(slot.passRate)
      const bestAgg = Number(slot.bestAggregate)

      if (!Number.isInteger(studentCount) || studentCount < 0) {
        setError(`BECE ${slot.examYear}: student count must be 0 or more.`)
        return
      }
      if (Number.isNaN(passRate) || passRate < 0 || passRate > 100) {
        setError(`BECE ${slot.examYear}: pass rate must be between 0 and 100.`)
        return
      }
      if (!Number.isInteger(bestAgg) || bestAgg < 6 || bestAgg > 54) {
        setError(
          `BECE ${slot.examYear}: best aggregate should be a whole number (typically 6–54).`,
        )
        return
      }
    }

    setSaving(true)

    for (const slot of filled) {
      const payload = {
        bece_exam_year: slot.examYear,
        bece_student_count: Number(slot.studentCount),
        bece_pass_rate: Number(slot.passRate),
        bece_best_aggregate: Number(slot.bestAggregate),
      }

      if (slot.yearId != null) {
        const { error: upError } = await supabase
          .from('academic_years')
          .update(payload)
          .eq('id', slot.yearId)
        if (upError) {
          setSaving(false)
          setError(friendlyError(upError, 'Could not save BECE figures.'))
          return
        }
        continue
      }

      const label = academicLabelForExam(slot.examYear)
      const { data: existing } = await supabase
        .from('academic_years')
        .select('id, bece_exam_year')
        .eq('label', label)
        .maybeSingle()

      if (existing) {
        const { error: upError } = await supabase
          .from('academic_years')
          .update(payload)
          .eq('id', existing.id)
        if (upError) {
          setSaving(false)
          setError(friendlyError(upError, 'Could not save BECE figures.'))
          return
        }
      } else {
        const { error: insError } = await supabase.from('academic_years').insert({
          label,
          is_active: false,
          ...payload,
        })
        if (insError) {
          setSaving(false)
          setError(friendlyError(insError, 'Could not save BECE figures.'))
          return
        }
      }
    }

    setSaving(false)
    setMessage(
      `Saved ${filled.length} BECE year${filled.length === 1 ? '' : 's'}. Home chart shows the latest ${YEAR_COUNT} with data.`,
    )
    await load(endYear)
  }

  const startYear = endYear - (YEAR_COUNT - 1)

  return (
    <main className="manage-page manage-page--wide">
      <div className="manage-page__content zoom-in">
        <div className="manage-page__top">
          <Link to="/overview" className="manage-page__back">
            ← Overview
          </Link>
          <div>
            <h1>BECE results</h1>
            <p className="manage-page__lead">
              Edit any five-year window. Shift forward after the next BECE to
              enter new results.
            </p>
          </div>
        </div>

        <div className="bece-window">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => shiftWindow(-1)}
            aria-label="Earlier years"
          >
            ← Earlier
          </button>
          <strong className="bece-window__range">
            BECE {startYear} – {endYear}
          </strong>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => shiftWindow(1)}
            aria-label="Later years"
          >
            Later →
          </button>
        </div>

        <form className="manage-sheet" onSubmit={onSubmit}>
          <div className="bulk-table bulk-table--bece">
            <div className="bulk-table__head">
              <span>Exam year</span>
              <span>Students</span>
              <span>Pass %</span>
              <span>Best agg.</span>
            </div>
            {slots.map((slot) => (
              <div className="bulk-table__row" key={slot.examYear}>
                <strong className="bece-year-label">BECE {slot.examYear}</strong>
                <input
                  type="number"
                  min={0}
                  value={slot.studentCount}
                  onChange={(e) =>
                    updateSlot(slot.examYear, { studentCount: e.target.value })
                  }
                  placeholder="e.g. 48"
                  aria-label={`Students ${slot.examYear}`}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={slot.passRate}
                  onChange={(e) =>
                    updateSlot(slot.examYear, { passRate: e.target.value })
                  }
                  placeholder="e.g. 92"
                  aria-label={`Pass rate ${slot.examYear}`}
                />
                <input
                  type="number"
                  min={6}
                  max={54}
                  value={slot.bestAggregate}
                  onChange={(e) =>
                    updateSlot(slot.examYear, {
                      bestAggregate: e.target.value,
                    })
                  }
                  placeholder="e.g. 9"
                  aria-label={`Best aggregate ${slot.examYear}`}
                />
              </div>
            ))}
          </div>

          {error ? <p className="manage-form__error">{error}</p> : null}
          {message ? <p className="manage-form__ok">{message}</p> : null}

          <div className="manage-sheet__actions">
            <p className="manage-page__lead" style={{ margin: 0 }}>
              Leave a year blank to skip it.
            </p>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save all years'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

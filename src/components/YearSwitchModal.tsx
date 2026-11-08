import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.tsx'
import { useYear } from '../auth/YearContext.tsx'
import { friendlyError } from '../lib/friendlyError.ts'
import { supabase } from '../lib/supabase.ts'
import './YearSwitchModal.css'

function sameId(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null) return false
  return Number(a) === Number(b)
}

export default function YearSwitchModal() {
  const { user } = useAuth()
  const {
    years,
    year,
    yearSwitcherOpen,
    closeYearSwitcher,
    setActiveYear,
    refreshYears,
  } = useYear()

  const [pickId, setPickId] = useState<number | null>(null)
  const [step, setStep] = useState<'pick' | 'confirm'>('pick')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!user && yearSwitcherOpen) closeYearSwitcher()
  }, [user, yearSwitcherOpen, closeYearSwitcher])

  useEffect(() => {
    if (!yearSwitcherOpen) return
    setPickId(year?.id ?? years[0]?.id ?? null)
    setStep('pick')
    setError(null)
    setClosing(false)
    setNewLabel('')
  }, [yearSwitcherOpen, year?.id])

  if (!yearSwitcherOpen || !user) return null

  const pickIndex = years.findIndex((y) => sameId(y.id, pickId))
  const pick = pickIndex >= 0 ? years[pickIndex] : null
  const canPrev = pickIndex > 0
  const canNext = pickIndex >= 0 && pickIndex < years.length - 1
  const isSameAsActive = pick != null && year != null && sameId(pick.id, year.id)

  const goPrev = () => {
    if (!canPrev) return
    setPickId(years[pickIndex - 1].id)
  }

  const goNext = () => {
    if (!canNext) return
    setPickId(years[pickIndex + 1].id)
  }

  const requestClose = () => {
    setClosing(true)
    window.setTimeout(() => {
      setClosing(false)
      closeYearSwitcher()
    }, 180)
  }

  const onPrimary = async () => {
    if (!pick) return
    setError(null)

    if (step === 'pick') {
      if (isSameAsActive) {
        requestClose()
        return
      }
      setStep('confirm')
      return
    }

    setSaving(true)
    const message = await setActiveYear(pick.id)
    setSaving(false)
    if (message) {
      setError(message)
      return
    }
    requestClose()
  }

  const addYear = async () => {
    const label = newLabel.trim()
    if (!label) {
      setError('Enter a year label, e.g. 2027/2028.')
      return
    }
    if (years.some((y) => y.label.toLowerCase() === label.toLowerCase())) {
      setError('That year already exists.')
      return
    }
    setAdding(true)
    setError(null)
    const { data, error: insertError } = await supabase
      .from('academic_years')
      .insert({ label, is_active: false })
      .select('id, label, is_active')
      .single()
    setAdding(false)
    if (insertError) {
      setError(friendlyError(insertError, 'Could not add the academic year.'))
      return
    }
    await refreshYears()
    if (data?.id != null) setPickId(data.id)
    setNewLabel('')
  }

  return (
    <div
      className={`year-modal ${closing ? 'is-closing' : ''}`}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={`year-modal__card ${closing ? 'zoom-out' : 'zoom-in'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="year-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="year-modal__close"
          onClick={requestClose}
          aria-label="Close"
        >
          ×
        </button>

        {step === 'pick' ? (
          <>
            <p className="year-modal__eyebrow">Working year</p>
            <h2 id="year-modal-title" className="year-modal__title">
              Switch academic year
            </h2>
            <p className="year-modal__lead">
              Applies to marks, students, and tests for everyone.
            </p>

            {year ? (
              <div className="year-modal__current">
                <span>Current</span>
                <strong>{year.label}</strong>
              </div>
            ) : null}

            {years.length <= 1 ? (
              <p className="year-modal__hint">
                Only one year is in the system, so Prev/Next stay off until you
                add another year below.
              </p>
            ) : null}

            <div className="year-modal__picker">
              <button
                type="button"
                className="year-modal__nav"
                disabled={!canPrev}
                onClick={goPrev}
                aria-label="Previous year"
              >
                ←
              </button>
              <div className="year-modal__pick-value">
                <strong>{pick?.label ?? '—'}</strong>
                {pick?.is_active ? (
                  <span className="year-modal__badge">Active now</span>
                ) : (
                  <span className="year-modal__badge is-muted">Inactive</span>
                )}
              </div>
              <button
                type="button"
                className="year-modal__nav"
                disabled={!canNext}
                onClick={goNext}
                aria-label="Next year"
              >
                →
              </button>
            </div>

            <div className="year-modal__list">
              {years.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`year-modal__list-item${
                    sameId(item.id, pickId) ? ' is-selected' : ''
                  }`}
                  onClick={() => setPickId(item.id)}
                >
                  <span>{item.label}</span>
                  {item.is_active ? <em>Active</em> : null}
                </button>
              ))}
            </div>

            <div className="year-modal__add">
              <label>
                <span>Add academic year</span>
                <div className="year-modal__add-row">
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. 2027/2028"
                  />
                  <button
                    type="button"
                    className="year-modal__btn is-ghost"
                    onClick={() => void addYear()}
                    disabled={adding}
                  >
                    {adding ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </label>
            </div>
          </>
        ) : (
          <>
            <p className="year-modal__eyebrow">Confirm change</p>
            <h2 id="year-modal-title" className="year-modal__title">
              Change working year?
            </h2>
            <p className="year-modal__lead">
              Everyone will use the new year until you change it again.
            </p>

            <div className="year-modal__confirm-box">
              <div>
                <span>From</span>
                <strong>{year?.label ?? '—'}</strong>
              </div>
              <div className="year-modal__arrow" aria-hidden="true">
                →
              </div>
              <div>
                <span>To</span>
                <strong>{pick?.label ?? '—'}</strong>
              </div>
            </div>
          </>
        )}

        {error ? <p className="year-modal__error">{error}</p> : null}

        <div className="year-modal__actions">
          {step === 'confirm' ? (
            <button
              type="button"
              className="year-modal__btn is-ghost"
              onClick={() => setStep('pick')}
              disabled={saving}
            >
              No
            </button>
          ) : (
            <button
              type="button"
              className="year-modal__btn is-ghost"
              onClick={requestClose}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="year-modal__btn is-primary"
            onClick={() => void onPrimary()}
            disabled={saving || !pick}
          >
            {saving
              ? 'Saving…'
              : step === 'confirm'
                ? 'Yes, change year'
                : isSameAsActive
                  ? 'Keep current'
                  : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

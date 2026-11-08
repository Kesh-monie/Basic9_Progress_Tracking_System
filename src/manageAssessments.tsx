import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.tsx'
import { useYear } from './auth/YearContext.tsx'
import YearStepper from './components/YearStepper.tsx'
import { friendlyError } from './lib/friendlyError.ts'
import { supabase, type AssessmentRow } from './lib/supabase.ts'
import './manage.css'

export default function ManageAssessments() {
  const { user } = useAuth()
  const { yearId, year } = useYear()
  const [existing, setExisting] = useState<AssessmentRow[]>([])
  const [pickSeq, setPickSeq] = useState(1)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (yearId == null) return
    void supabase
      .from('assessments')
      .select('id, academic_year_id, name, sequence_no')
      .eq('academic_year_id', yearId)
      .order('sequence_no')
      .then(({ data }) => {
        const rows = (data ?? []) as AssessmentRow[]
        setExisting(rows)
        const max = rows.reduce((m, r) => Math.max(m, r.sequence_no), 0)
        setPickSeq(max + 1)
      })
  }, [yearId, message])

  if (user?.role !== 'supervisor') {
    return <Navigate to="/overview" replace />
  }

  const alreadyExists = existing.some((a) => a.sequence_no === pickSeq)
  const testName = `Test ${pickSeq}`

  const confirmCreate = async () => {
    if (yearId == null) return
    setMessage(null)
    setError(null)
    if (alreadyExists) {
      setError(`${testName} already exists.`)
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('assessments').insert({
      academic_year_id: yearId,
      name: testName,
      sequence_no: pickSeq,
    })
    setSaving(false)
    if (insertError) {
      setError(friendlyError(insertError, 'Could not create the test.'))
      return
    }
    setMessage(`${testName} · ${year?.label}`)
  }

  return (
    <main className="manage-page">
      <div className="manage-page__content zoom-in">
        <div className="manage-page__top">
          <Link to="/overview" className="manage-page__back">
            ← Overview
          </Link>
          <div>
            <h1>Create test</h1>
            <p className="manage-page__lead">Pick year and test number.</p>
          </div>
        </div>

        <YearStepper compact />

        <div className="manage-sheet create-test">
          <div className="create-test__picker">
            <button
              type="button"
              className="year-stepper__btn"
              disabled={pickSeq <= 1}
              onClick={() => setPickSeq((n) => Math.max(1, n - 1))}
            >
              ←
            </button>
            <div className="create-test__value">
              <strong>{testName}</strong>
              {existing.length > 0 ? (
                <span>
                  {existing.map((a) => a.name).join(' · ')}
                </span>
              ) : (
                <span>No tests yet</span>
              )}
            </div>
            <button
              type="button"
              className="year-stepper__btn"
              onClick={() => setPickSeq((n) => n + 1)}
            >
              →
            </button>
          </div>

          {error ? <p className="manage-form__error">{error}</p> : null}
          {message ? <p className="manage-form__ok">{message}</p> : null}

          <button
            type="button"
            className="btn-primary"
            onClick={() => void confirmCreate()}
            disabled={saving || alreadyExists || yearId == null}
          >
            {alreadyExists
              ? 'Already created'
              : saving
                ? 'Saving…'
                : `Create ${testName}`}
          </button>
        </div>
      </div>
    </main>
  )
}

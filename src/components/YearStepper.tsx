import { useAuth } from '../auth/AuthContext.tsx'
import { useYear } from '../auth/YearContext.tsx'
import '../manage.css'

type YearStepperProps = {
  compact?: boolean
  /** @deprecated kept for call sites; year is always the school active year */
  locked?: boolean
}

export default function YearStepper({ compact = false }: YearStepperProps) {
  const { user } = useAuth()
  const { year, loading, openYearSwitcher } = useYear()
  const isSupervisor = user?.role === 'supervisor'

  if (loading) {
    return <div className="year-stepper year-stepper--compact">Loading…</div>
  }

  if (!year) {
    return <p className="manage-form__error">No academic years found.</p>
  }

  return (
    <div
      className={`year-stepper year-chip${compact ? ' year-stepper--compact' : ''}`}
    >
      <div className="year-chip__main">
        <span className="year-chip__label">Working year</span>
        <strong className="year-chip__value">{year.label}</strong>
      </div>
      {isSupervisor ? (
        <button
          type="button"
          className="year-chip__switch"
          onClick={openYearSwitcher}
        >
          Switch year
        </button>
      ) : (
        <span className="year-stepper__badge">Active</span>
      )}
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.tsx'
import type { StaffRole } from '../lib/supabase.ts'
import '../login.css'

type LoginModalProps = {
  open: boolean
  onClose: () => void
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [identityCode, setIdentityCode] = useState('')
  const [role, setRole] = useState<StaffRole>('supervisor')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setClosing(false)
    setShowPassword(false)
  }, [open])

  useEffect(() => {
    if (open && user) {
      onClose()
      navigate('/overview')
    }
  }, [open, user, onClose, navigate])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const requestClose = () => {
    setClosing(true)
    window.setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }

  if (!open) return null

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const message = await login(identityCode, role, password)
    setSubmitting(false)
    if (message) {
      setError(message)
      return
    }
    navigate('/overview')
  }

  return (
    <div
      className={`login-modal ${closing ? 'is-closing' : ''}`}
      role="presentation"
      onClick={requestClose}
    >
      <form
        className={`login-card ${closing ? 'zoom-out' : 'zoom-in'}`}
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button
          type="button"
          className="login-card__close"
          onClick={requestClose}
          aria-label="Close sign in"
        >
          ×
        </button>

        <h2 id="login-modal-title" className="login-card__title">
          Sign in
        </h2>

        <label className="login-field">
          <span>Staff ID</span>
          <input
            value={identityCode}
            onChange={(e) => setIdentityCode(e.target.value.toUpperCase())}
            maxLength={3}
            minLength={3}
            placeholder="Staff ID"
            required
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className="login-field">
          <span>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            <option value="supervisor">Supervisor</option>
            <option value="teacher">Teacher</option>
          </select>
        </label>

        <label className="login-field">
          <span>Password</span>
          <div className="login-field__password">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="login-field__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 7c2.8 0 5.3 1.6 6.5 4-1.2 2.4-3.7 4-6.5 4s-5.3-1.6-6.5-4c1.2-2.4 3.7-4 6.5-4m0-2C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 5a2 2 0 1 0 .01 4.01A2 2 0 0 0 12 10z"
                  />
                  <path
                    fill="currentColor"
                    d="M3.3 2.9 2 4.2l18.8 18.8 1.3-1.3L3.3 2.9z"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 5C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 12c-2.8 0-5.3-1.6-6.5-4C6.7 10.6 9.2 9 12 9s5.3 1.6 6.5 4c-1.2 2.4-3.7 4-6.5 4zm0-7a3 3 0 1 0 .01 6.01A3 3 0 0 0 12 10z"
                  />
                </svg>
              )}
            </button>
          </div>
        </label>

        {error ? <p className="login-card__error">{error}</p> : null}

        <button
          type="submit"
          className="login-card__submit"
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

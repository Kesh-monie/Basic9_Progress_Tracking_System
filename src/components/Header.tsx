import { useNavigate } from 'react-router-dom'
import bmiLogo from '../assets/image/bmi.jpg'
import favicon from '../assets/image/favicon.png'
import { useAuth } from '../auth/AuthContext.tsx'
import { useTheme } from '../auth/ThemeContext.tsx'
import { useYear } from '../auth/YearContext.tsx'
import './Header.css'

type HeaderProps = {
  showSignIn?: boolean
  onSignIn?: () => void
}

export default function Header({ showSignIn = false, onSignIn }: HeaderProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { year, openYearSwitcher, closeYearSwitcher } = useYear()
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="site-header-wrap">
      <header className="site-header">
        <img className="site-header__logo" src={bmiLogo} alt="BMI" />
        <div className="site-header__text">
          <p className="site-header__title">Bediako Memorial Institute</p>
          <p className="site-header__subtitle">
            Students Performance Tracking System
          </p>
        </div>

        <div className="site-header__end">
          {user ? (
            <div className="site-header__user">
              {year ? (
                <button
                  type="button"
                  className="site-header__year"
                  onClick={() => {
                    if (user.role === 'supervisor') openYearSwitcher()
                  }}
                  disabled={user.role !== 'supervisor'}
                  title={
                    user.role === 'supervisor'
                      ? 'Switch academic year'
                      : 'Working academic year'
                  }
                >
                  <span>Year</span>
                  <strong>{year.label}</strong>
                </button>
              ) : null}
              <span className="site-header__user-name">
                {user.displayName ?? user.fullName}
              </span>
              <span className="site-header__user-role">{user.role}</span>
              <button
                type="button"
                className="site-header__signout"
                onClick={() => {
                  closeYearSwitcher()
                  logout()
                  navigate('/', { replace: true })
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <img className="site-header__favicon" src={favicon} alt="" />
          )}

          <button
            type="button"
            className="site-header__theme"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            <svg
              className="site-header__theme-icon is-sun"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4.2" fill="currentColor" />
              <g
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              >
                <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2" />
                <path d="M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M17.3 5.1l1.6-1.6M5.1 18.9l1.6-1.6" />
              </g>
            </svg>
            <svg
              className="site-header__theme-icon is-moon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M19.5 13.4A7.8 7.8 0 0 1 10.6 4.5a.7.7 0 0 0-.9-.8A8.9 8.9 0 1 0 20.3 14.3a.7.7 0 0 0-.8-.9Z"
              />
            </svg>
          </button>
        </div>
      </header>

      {showSignIn && !user ? (
        <div className="site-header__signin-row">
          <button
            type="button"
            className="site-header__signin"
            onClick={() => onSignIn?.()}
          >
            Sign in
          </button>
        </div>
      ) : null}
    </div>
  )
}

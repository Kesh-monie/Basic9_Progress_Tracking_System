import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.tsx'
import { useYear } from './auth/YearContext.tsx'
import PassportPhotoField from './components/PassportPhotoField.tsx'
import YearStepper from './components/YearStepper.tsx'
import { SECTIONS } from './data/overviewStats.ts'
import type { Gender } from './lib/person.ts'
import { friendlyError } from './lib/friendlyError.ts'
import { uploadStudentPhoto } from './lib/studentPhoto.ts'
import { supabase } from './lib/supabase.ts'
import './manage.css'

type StudentDraft = {
  key: string
  identityCode: string
  fullName: string
  gender: Gender | ''
  dateOfBirth: string
  section: string
  photoFile: File | null
}

const emptyRow = (): StudentDraft => ({
  key: crypto.randomUUID(),
  identityCode: '',
  fullName: '',
  gender: '',
  dateOfBirth: '',
  section: '',
  photoFile: null,
})

export default function ManageStudents() {
  const { user } = useAuth()
  const { yearId } = useYear()
  const [rows, setRows] = useState<StudentDraft[]>([emptyRow()])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (user?.role !== 'supervisor') {
    return <Navigate to="/overview" replace />
  }

  const updateRow = (key: string, patch: Partial<StudentDraft>) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (yearId == null) {
      setError('Select an academic year.')
      return
    }

    const filled = rows.filter(
      (row) =>
        row.identityCode.trim() ||
        row.fullName.trim() ||
        row.gender ||
        row.dateOfBirth ||
        row.section ||
        row.photoFile,
    )

    if (filled.length === 0) {
      setError('Add at least one student.')
      return
    }

    const payload: Array<{
      identity_code: string
      full_name: string
      gender: Gender
      date_of_birth: string | null
      section: string
      photo_url: string | null
      academic_year_id: number
    }> = []

    for (const row of filled) {
      const code = row.identityCode.trim()
      if (!/^\d{4}$/.test(code)) {
        setError(`ID “${row.identityCode || 'blank'}” must be 4 digits.`)
        return
      }
      if (!row.fullName.trim()) {
        setError(`Name missing for ${code}.`)
        return
      }
      if (row.gender !== 'male' && row.gender !== 'female') {
        setError(`Select gender for ${code}.`)
        return
      }
      if (!row.section) {
        setError(`Section missing for ${code}.`)
        return
      }
      payload.push({
        identity_code: code,
        full_name: row.fullName.trim(),
        gender: row.gender,
        date_of_birth: row.dateOfBirth.trim() || null,
        section: row.section,
        photo_url: null,
        academic_year_id: yearId,
      })
    }

    const codes = payload.map((p) => p.identity_code)
    if (new Set(codes).size !== codes.length) {
      setError('Duplicate student IDs in the list.')
      return
    }

    setSaving(true)
    try {
      for (let i = 0; i < filled.length; i += 1) {
        const file = filled[i].photoFile
        if (!file) continue
        payload[i].photo_url = await uploadStudentPhoto(
          file,
          filled[i].identityCode.trim(),
        )
      }

      const { error: insertError } = await supabase
        .from('students')
        .insert(payload)
      if (insertError) {
        setError(friendlyError(insertError, 'Could not save students.'))
        setSaving(false)
        return
      }

      setMessage(
        `${payload.length} student${payload.length === 1 ? '' : 's'} saved.`,
      )
      setRows([emptyRow()])
    } catch (err) {
      setError(friendlyError(err, 'Could not save students.'))
    }
    setSaving(false)
  }

  return (
    <main className="manage-page manage-page--wide">
      <div className="manage-page__content zoom-in">
        <div className="manage-page__top">
          <Link to="/overview" className="manage-page__back">
            ← Overview
          </Link>
          <div className="manage-page__heading">
            <div>
              <h1>Add students</h1>
              <p className="manage-page__lead">
                Bulk entry for the selected year. Passport photo is optional.
              </p>
            </div>
            <Link to="/manage/students/edit" className="btn-ghost">
              Edit students
            </Link>
          </div>
        </div>

        <YearStepper compact />

        <form className="manage-sheet" onSubmit={onSubmit}>
          <div className="student-draft-list">
            {rows.map((row, index) => (
              <div className="student-draft" key={row.key}>
                <PassportPhotoField
                  compact
                  gender={row.gender}
                  file={row.photoFile}
                  onFileChange={(photoFile) =>
                    updateRow(row.key, { photoFile })
                  }
                />
                <div className="student-draft__fields">
                  <div className="student-draft__grid">
                    <label className="manage-field">
                      <span>ID</span>
                      <input
                        value={row.identityCode}
                        onChange={(e) =>
                          updateRow(row.key, {
                            identityCode: e.target.value
                              .replace(/\D/g, '')
                              .slice(0, 4),
                          })
                        }
                        maxLength={4}
                        placeholder="1001"
                        inputMode="numeric"
                        aria-label={`Student ID row ${index + 1}`}
                      />
                    </label>
                    <label className="manage-field">
                      <span>Full name</span>
                      <input
                        value={row.fullName}
                        onChange={(e) =>
                          updateRow(row.key, { fullName: e.target.value })
                        }
                        placeholder="Student name"
                        aria-label={`Name row ${index + 1}`}
                      />
                    </label>
                    <label className="manage-field">
                      <span>Gender</span>
                      <select
                        value={row.gender}
                        onChange={(e) =>
                          updateRow(row.key, {
                            gender: e.target.value as Gender | '',
                          })
                        }
                        aria-label={`Gender row ${index + 1}`}
                      >
                        <option value="">Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </label>
                    <label className="manage-field">
                      <span>Date of birth</span>
                      <input
                        type="date"
                        value={row.dateOfBirth}
                        onChange={(e) =>
                          updateRow(row.key, { dateOfBirth: e.target.value })
                        }
                        aria-label={`Date of birth row ${index + 1}`}
                      />
                    </label>
                    <label className="manage-field">
                      <span>Section</span>
                      <select
                        value={row.section}
                        onChange={(e) =>
                          updateRow(row.key, { section: e.target.value })
                        }
                        aria-label={`Section row ${index + 1}`}
                      >
                        <option value="">Section</option>
                        {SECTIONS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="bulk-table__remove student-draft__remove"
                    onClick={() =>
                      setRows((prev) =>
                        prev.length === 1
                          ? [emptyRow()]
                          : prev.filter((r) => r.key !== row.key),
                      )
                    }
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="manage-sheet__actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
            >
              + Add row
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || yearId == null}
            >
              {saving ? 'Saving…' : 'Save all'}
            </button>
          </div>

          {error ? <p className="manage-form__error">{error}</p> : null}
          {message ? <p className="manage-form__ok">{message}</p> : null}
        </form>
      </div>
    </main>
  )
}

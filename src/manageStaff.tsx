import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.tsx'
import { hashPassword } from './lib/password.ts'
import type { Gender } from './lib/person.ts'
import { friendlyError } from './lib/friendlyError.ts'
import { sortSubjects } from './lib/subjects.ts'
import { supabase, type SubjectRow } from './lib/supabase.ts'
import './manage.css'

type TeacherRow = {
  key: string
  identityCode: string
  fullName: string
  gender: Gender | ''
  subjectId: string
  password: string
}

const emptyRow = (): TeacherRow => ({
  key: crypto.randomUUID(),
  identityCode: '',
  fullName: '',
  gender: '',
  subjectId: '',
  password: '',
})

export default function ManageStaff() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [rows, setRows] = useState<TeacherRow[]>([emptyRow()])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void supabase
      .from('subjects')
      .select('id, name, code')
      .order('id')
      .then(({ data }) => {
        if (data) setSubjects(sortSubjects(data as SubjectRow[]))
      })
  }, [])

  if (user?.role !== 'supervisor') {
    return <Navigate to="/overview" replace />
  }

  const updateRow = (key: string, patch: Partial<TeacherRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const filled = rows.filter(
      (row) =>
        row.identityCode.trim() ||
        row.fullName.trim() ||
        row.gender ||
        row.subjectId ||
        row.password,
    )

    if (filled.length === 0) {
      setError('Add at least one teacher.')
      return
    }

    const payload: Array<{
      identity_code: string
      full_name: string
      gender: Gender
      role: 'teacher'
      password_hash: string
      subject_id: number
      can_enter_marks: boolean
    }> = []

    for (const row of filled) {
      const code = row.identityCode.trim().toUpperCase()
      if (!/^[A-Z]{3}$/.test(code)) {
        setError(`Staff ID “${row.identityCode || 'blank'}” must be 3 letters.`)
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
      if (!row.subjectId) {
        setError(`Subject missing for ${code}.`)
        return
      }
      if (row.password.length < 6) {
        setError(`Password for ${code} must be at least 6 characters.`)
        return
      }
      payload.push({
        identity_code: code,
        full_name: row.fullName.trim(),
        gender: row.gender,
        role: 'teacher',
        password_hash: await hashPassword(row.password),
        subject_id: Number(row.subjectId),
        can_enter_marks: true,
      })
    }

    const codes = payload.map((p) => p.identity_code)
    if (new Set(codes).size !== codes.length) {
      setError('Duplicate staff IDs in the list.')
      return
    }

    setSaving(true)
    const { error: insertError } = await supabase.from('staff').insert(payload)
    setSaving(false)

    if (insertError) {
      setError(friendlyError(insertError, 'Could not save teachers.'))
      return
    }

    setMessage(`${payload.length} teacher${payload.length === 1 ? '' : 's'} saved.`)
    setRows([emptyRow()])
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
              <h1>Add teachers</h1>
              <p className="manage-page__lead">
                Fill rows, then save all at once.
              </p>
            </div>
            <Link to="/manage/staff/edit" className="btn-ghost">
              Edit staff
            </Link>
          </div>
        </div>

        <form className="manage-sheet" onSubmit={onSubmit}>
          <div className="bulk-table bulk-table--staff">
            <div className="bulk-table__head">
              <span>ID</span>
              <span>Full name</span>
              <span>Gender</span>
              <span>Subject</span>
              <span>Password</span>
              <span />
            </div>
            {rows.map((row, index) => (
              <div className="bulk-table__row" key={row.key}>
                <input
                  value={row.identityCode}
                  onChange={(e) =>
                    updateRow(row.key, {
                      identityCode: e.target.value.toUpperCase(),
                    })
                  }
                  maxLength={3}
                  placeholder="MAT"
                  aria-label={`Staff ID row ${index + 1}`}
                />
                <input
                  value={row.fullName}
                  onChange={(e) =>
                    updateRow(row.key, { fullName: e.target.value })
                  }
                  placeholder="Teacher name"
                  aria-label={`Name row ${index + 1}`}
                />
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
                <select
                  value={row.subjectId}
                  onChange={(e) =>
                    updateRow(row.key, { subjectId: e.target.value })
                  }
                  aria-label={`Subject row ${index + 1}`}
                >
                  <option value="">Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} · {subject.name}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  value={row.password}
                  onChange={(e) =>
                    updateRow(row.key, { password: e.target.value })
                  }
                  placeholder="Password"
                  aria-label={`Password row ${index + 1}`}
                />
                <button
                  type="button"
                  className="bulk-table__remove"
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
            <button type="submit" className="btn-primary" disabled={saving}>
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

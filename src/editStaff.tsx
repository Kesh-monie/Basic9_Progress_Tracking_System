import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.tsx'
import { hashPassword } from './lib/password.ts'
import type { Gender } from './lib/person.ts'
import { friendlyError } from './lib/friendlyError.ts'
import { sortSubjects } from './lib/subjects.ts'
import { supabase, type StaffRow, type SubjectRow } from './lib/supabase.ts'
import './manage.css'

type EditForm = {
  fullName: string
  gender: Gender | ''
  subjectId: string
  newPassword: string
}

function roleLabel(role: string) {
  return role === 'supervisor' ? 'Supervisor' : 'Teacher'
}

export default function EditStaff() {
  const { user, refreshUser } = useAuth()
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<EditForm>({
    fullName: '',
    gender: '',
    subjectId: '',
    newPassword: '',
  })
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: staffData, error: staffError }, { data: subjectData }] =
      await Promise.all([
        supabase
          .from('staff')
          .select(
            'id, identity_code, full_name, role, password_hash, subject_id, gender, can_enter_marks',
          )
          .order('identity_code'),
        supabase.from('subjects').select('id, name, code').order('id'),
      ])
    if (staffError) {
      setError(friendlyError(staffError, 'Could not load staff.'))
      return
    }
    const rows = (staffData ?? []) as StaffRow[]
    rows.sort((a, b) => {
      if (a.role === b.role) return a.identity_code.localeCompare(b.identity_code)
      return a.role === 'supervisor' ? -1 : 1
    })
    setStaff(rows)
    setSubjects(sortSubjects((subjectData ?? []) as SubjectRow[]))
  }

  useEffect(() => {
    void load()
  }, [])

  if (user?.role !== 'supervisor') {
    return <Navigate to="/overview" replace />
  }

  const selected = staff.find((t) => t.id === selectedId) ?? null
  const editingSupervisor = selected?.role === 'supervisor'

  const selectStaff = (row: StaffRow) => {
    setSelectedId(row.id)
    setMessage(null)
    setError(null)
    setForm({
      fullName: row.full_name,
      gender: row.gender ?? '',
      subjectId: row.subject_id != null ? String(row.subject_id) : '',
      newPassword: '',
    })
  }

  const filtered = staff.filter((t) => {
    const q = filter.trim().toLowerCase()
    if (!q) return true
    return (
      t.identity_code.toLowerCase().includes(q) ||
      t.full_name.toLowerCase().includes(q) ||
      t.role.toLowerCase().includes(q)
    )
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setMessage(null)
    setError(null)

    if (!form.fullName.trim()) {
      setError('Name is required.')
      return
    }
    if (form.gender !== 'male' && form.gender !== 'female') {
      setError('Select gender.')
      return
    }
    if (selected.role === 'teacher' && !form.subjectId) {
      setError('Select a subject.')
      return
    }
    if (form.newPassword && form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    const payload: Record<string, unknown> = {
      full_name: form.fullName.trim(),
      gender: form.gender,
      subject_id:
        selected.role === 'supervisor'
          ? form.subjectId
            ? Number(form.subjectId)
            : null
          : Number(form.subjectId),
    }
    if (form.newPassword) {
      payload.password_hash = await hashPassword(form.newPassword)
    }

    setSaving(true)
    const { error: upError } = await supabase
      .from('staff')
      .update(payload)
      .eq('id', selected.id)
    setSaving(false)

    if (upError) {
      setError(friendlyError(upError, 'Could not save staff.'))
      return
    }

    if (user.id === selected.id) {
      await refreshUser()
    }

    setMessage(
      form.newPassword
        ? `Updated ${selected.identity_code} and set a new password.`
        : `Updated ${selected.identity_code}.`,
    )
    setForm((f) => ({ ...f, newPassword: '' }))
    await load()
  }

  const subjectLabel = (row: StaffRow) => {
    if (row.role === 'supervisor') return 'Supervisor'
    if (row.subject_id == null) return 'No subject'
    const s = subjects.find((x) => x.id === row.subject_id)
    return s ? `${s.code} · ${s.name}` : `Subject #${row.subject_id}`
  }

  return (
    <main className="manage-page manage-page--wide">
      <div className="manage-page__content zoom-in">
        <div className="manage-page__top">
          <Link to="/overview" className="manage-page__back">
            ← Overview
          </Link>
          <div>
            <h1>Edit staff</h1>
            <p className="manage-page__lead">
              Edit teachers or your supervisor account (name, gender, password).
              Leave password blank to keep the current one.
            </p>
          </div>
        </div>

        <div className="edit-layout">
          <div className="manage-sheet">
            <label className="manage-field">
              <span>Search</span>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="ID, name, or role"
              />
            </label>
            <ul className="access-list">
              {filtered.length === 0 ? (
                <li className="manage-page__lead">No staff found.</li>
              ) : (
                filtered.map((row) => (
                  <li key={row.id} className="access-list__row">
                    <div>
                      <strong>
                        {row.identity_code} · {row.full_name}
                        {user.id === row.id ? ' (you)' : ''}
                      </strong>
                      <small>
                        {roleLabel(row.role)}
                        {row.role === 'teacher'
                          ? ` · ${subjectLabel(row)}`
                          : ''}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => selectStaff(row)}
                    >
                      Edit
                    </button>
                  </li>
                ))
              )}
            </ul>
            <Link to="/manage/staff" className="btn-ghost">
              ← Back to add teachers
            </Link>
          </div>

          <form className="manage-sheet" onSubmit={onSubmit}>
            {selected ? (
              <>
                <p className="manage-page__lead" style={{ margin: 0 }}>
                  Editing <strong>{selected.identity_code}</strong> (
                  {roleLabel(selected.role)}
                  {user.id === selected.id ? ' · you' : ''})
                </p>
                <label className="manage-field">
                  <span>Full name</span>
                  <input
                    value={form.fullName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fullName: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className="manage-field">
                  <span>Gender</span>
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        gender: e.target.value as Gender | '',
                      }))
                    }
                    required
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
                {!editingSupervisor ? (
                  <label className="manage-field">
                    <span>Subject</span>
                    <select
                      value={form.subjectId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, subjectId: e.target.value }))
                      }
                      required
                    >
                      <option value="">Select</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} · {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="manage-field">
                  <span>New password (optional)</span>
                  <input
                    type="password"
                    value={form.newPassword}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, newPassword: e.target.value }))
                    }
                    placeholder="Leave blank to keep current"
                    autoComplete="new-password"
                  />
                </label>
                {error ? <p className="manage-form__error">{error}</p> : null}
                {message ? <p className="manage-form__ok">{message}</p> : null}
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : (
              <p className="manage-page__lead" style={{ margin: 0 }}>
                Select a staff member on the left to edit.
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  )
}

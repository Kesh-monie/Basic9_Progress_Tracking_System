import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.tsx'
import { useYear } from './auth/YearContext.tsx'
import PassportPhotoField from './components/PassportPhotoField.tsx'
import YearStepper from './components/YearStepper.tsx'
import { SECTIONS } from './data/overviewStats.ts'
import type { Gender } from './lib/person.ts'
import { friendlyError } from './lib/friendlyError.ts'
import {
  resolveStudentPhoto,
  uploadStudentPhoto,
} from './lib/studentPhoto.ts'
import { supabase, type StudentRow } from './lib/supabase.ts'
import './manage.css'

type EditForm = {
  identityCode: string
  fullName: string
  gender: Gender | ''
  dateOfBirth: string
  section: string
  photoFile: File | null
  clearPhoto: boolean
}

export default function EditStudents() {
  const { user } = useAuth()
  const { yearId } = useYear()
  const [students, setStudents] = useState<StudentRow[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<EditForm>({
    identityCode: '',
    fullName: '',
    gender: '',
    dateOfBirth: '',
    section: '',
    photoFile: null,
    clearPhoto: false,
  })
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (yearId == null) {
      setStudents([])
      return
    }
    const { data, error: loadError } = await supabase
      .from('students')
      .select(
        'id, identity_code, full_name, section, photo_url, academic_year_id, gender, date_of_birth',
      )
      .eq('academic_year_id', yearId)
      .order('identity_code')
    if (loadError) {
      setError(friendlyError(loadError, 'Could not load students.'))
      return
    }
    setStudents((data ?? []) as StudentRow[])
  }

  useEffect(() => {
    setSelectedId(null)
    setMessage(null)
    setError(null)
    void load()
  }, [yearId])

  if (user?.role !== 'supervisor') {
    return <Navigate to="/overview" replace />
  }

  const selected = students.find((s) => s.id === selectedId) ?? null

  const selectStudent = (row: StudentRow) => {
    setSelectedId(row.id)
    setMessage(null)
    setError(null)
    setForm({
      identityCode: row.identity_code,
      fullName: row.full_name,
      gender: row.gender ?? '',
      dateOfBirth: row.date_of_birth ?? '',
      section: row.section,
      photoFile: null,
      clearPhoto: false,
    })
  }

  const filtered = students.filter((s) => {
    const q = filter.trim().toLowerCase()
    if (!q) return true
    return (
      s.identity_code.toLowerCase().includes(q) ||
      s.full_name.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    )
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || yearId == null) return
    setMessage(null)
    setError(null)

    const code = form.identityCode.trim()
    if (!/^\d{4}$/.test(code)) {
      setError('Student ID must be 4 digits.')
      return
    }
    if (!form.fullName.trim()) {
      setError('Name is required.')
      return
    }
    if (form.gender !== 'male' && form.gender !== 'female') {
      setError('Select gender.')
      return
    }
    if (!form.section) {
      setError('Select a section.')
      return
    }

    setSaving(true)
    try {
      let photoUrl: string | null = selected.photo_url
      if (form.clearPhoto && !form.photoFile) {
        photoUrl = null
      }
      if (form.photoFile) {
        photoUrl = await uploadStudentPhoto(form.photoFile, code)
      }

      const { error: upError } = await supabase
        .from('students')
        .update({
          identity_code: code,
          full_name: form.fullName.trim(),
          gender: form.gender,
          date_of_birth: form.dateOfBirth.trim() || null,
          section: form.section,
          photo_url: photoUrl,
        })
        .eq('id', selected.id)

      if (upError) {
        setError(friendlyError(upError, 'Could not save student.'))
        setSaving(false)
        return
      }

      setMessage(`Updated student ${code}.`)
      setForm((f) => ({ ...f, photoFile: null, clearPhoto: false }))
      await load()
    } catch (err) {
      setError(friendlyError(err, 'Could not save student.'))
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
          <div>
            <h1>Edit students</h1>
            <p className="manage-page__lead">
              Update details or add a passport photo later.
            </p>
          </div>
        </div>

        <YearStepper compact />

        <div className="edit-layout">
          <div className="manage-sheet">
            <label className="manage-field">
              <span>Search</span>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="ID, name, or section"
              />
            </label>
            <ul className="access-list">
              {yearId == null ? (
                <li className="manage-page__lead">Select an academic year.</li>
              ) : filtered.length === 0 ? (
                <li className="manage-page__lead">No students in this year.</li>
              ) : (
                filtered.map((row) => (
                  <li key={row.id} className="access-list__row">
                    <div className="access-list__with-photo">
                      <img
                        className="access-list__passport"
                        src={resolveStudentPhoto(row.photo_url, row.gender)}
                        alt=""
                      />
                      <div>
                        <strong>
                          {row.identity_code} · {row.full_name}
                        </strong>
                        <small>
                          {row.section} · DOB{' '}
                          {row.date_of_birth?.trim() || 'N/A'}
                        </small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => selectStudent(row)}
                    >
                      Edit
                    </button>
                  </li>
                ))
              )}
            </ul>
            <Link to="/manage/students" className="btn-ghost">
              ← Back to add students
            </Link>
          </div>

          <form className="manage-sheet" onSubmit={onSubmit}>
            {selected ? (
              <>
                <p className="manage-page__lead" style={{ margin: 0 }}>
                  Editing <strong>{selected.identity_code}</strong>
                </p>
                <PassportPhotoField
                  gender={form.gender}
                  savedUrl={selected.photo_url}
                  file={form.photoFile}
                  clearSaved={form.clearPhoto}
                  onFileChange={(photoFile) =>
                    setForm((f) => ({
                      ...f,
                      photoFile,
                      clearPhoto: photoFile ? false : f.clearPhoto,
                    }))
                  }
                  onClearSaved={() =>
                    setForm((f) => ({
                      ...f,
                      photoFile: null,
                      clearPhoto: true,
                    }))
                  }
                />
                <label className="manage-field">
                  <span>Student ID</span>
                  <input
                    value={form.identityCode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        identityCode: e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 4),
                      }))
                    }
                    maxLength={4}
                    inputMode="numeric"
                    required
                  />
                </label>
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
                <label className="manage-field">
                  <span>Date of birth</span>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dateOfBirth: e.target.value }))
                    }
                  />
                </label>
                <label className="manage-field">
                  <span>Section</span>
                  <select
                    value={form.section}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, section: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select</option>
                    {SECTIONS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {error ? <p className="manage-form__error">{error}</p> : null}
                {message ? <p className="manage-form__ok">{message}</p> : null}
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : (
              <p className="manage-page__lead" style={{ margin: 0 }}>
                Select a student on the left to edit.
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  )
}

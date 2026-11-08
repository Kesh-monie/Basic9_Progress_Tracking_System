import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.tsx'
import { displayName, type Gender } from './lib/person.ts'
import { friendlyError } from './lib/friendlyError.ts'
import { sortSubjects } from './lib/subjects.ts'
import { supabase, type SubjectRow } from './lib/supabase.ts'
import './manage.css'

type TeacherAccess = {
  id: number
  identity_code: string
  full_name: string
  gender: Gender | null
  subject_id: number | null
  can_enter_marks: boolean
}

export default function ManageTeacherAccess() {
  const { user } = useAuth()
  const [teachers, setTeachers] = useState<TeacherAccess[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [{ data: staffData }, { data: subjectData }] = await Promise.all([
      supabase
        .from('staff')
        .select(
          'id, identity_code, full_name, gender, subject_id, can_enter_marks',
        )
        .eq('role', 'teacher')
        .order('identity_code'),
      supabase.from('subjects').select('id, name, code').order('id'),
    ])
    setTeachers((staffData ?? []) as TeacherAccess[])
    setSubjects(sortSubjects((subjectData ?? []) as SubjectRow[]))
  }

  useEffect(() => {
    void load()
  }, [])

  if (user?.role !== 'supervisor') {
    return <Navigate to="/overview" replace />
  }

  const subjectName = (id: number | null) =>
    subjects.find((s) => s.id === id)?.name ?? '—'

  const setOne = async (id: number, canEnter: boolean) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const { error: upErr } = await supabase
      .from('staff')
      .update({ can_enter_marks: canEnter })
      .eq('id', id)
      .eq('role', 'teacher')
    setBusy(false)
    if (upErr) {
      setError(friendlyError(upErr, 'Could not update marks access.'))
      return
    }
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, can_enter_marks: canEnter } : t,
      ),
    )
    setMessage(canEnter ? 'Marks entry enabled.' : 'Marks entry disabled.')
  }

  const setAll = async (canEnter: boolean) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const { error: upErr } = await supabase
      .from('staff')
      .update({ can_enter_marks: canEnter })
      .eq('role', 'teacher')
    setBusy(false)
    if (upErr) {
      setError(friendlyError(upErr, 'Could not update marks access.'))
      return
    }
    setTeachers((prev) =>
      prev.map((t) => ({ ...t, can_enter_marks: canEnter })),
    )
    setMessage(
      canEnter
        ? 'Marks entry enabled for all teachers.'
        : 'Marks entry disabled for all teachers.',
    )
  }

  const enabledCount = teachers.filter((t) => t.can_enter_marks).length

  return (
    <main className="manage-page manage-page--wide">
      <div className="manage-page__content zoom-in">
        <div className="manage-page__top">
          <Link to="/overview" className="manage-page__back">
            ← Overview
          </Link>
          <div>
            <h1>Teacher marks access</h1>
            <p className="manage-page__lead">
              {enabledCount}/{teachers.length} can enter marks
            </p>
          </div>
        </div>

        <div className="manage-sheet">
          <div className="access-toolbar">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || teachers.length === 0}
              onClick={() => void setAll(true)}
            >
              Enable all
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy || teachers.length === 0}
              onClick={() => void setAll(false)}
            >
              Disable all
            </button>
          </div>

          {teachers.length === 0 ? (
            <p className="manage-page__lead">No teachers found.</p>
          ) : (
            <ul className="access-list">
              {teachers.map((teacher) => (
                <li key={teacher.id} className="access-list__row">
                  <div>
                    <strong>
                      {displayName(teacher.full_name, teacher.gender)}
                    </strong>
                    <small>
                      {teacher.identity_code} · {subjectName(teacher.subject_id)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className={`access-toggle${
                      teacher.can_enter_marks ? ' is-on' : ' is-off'
                    }`}
                    disabled={busy}
                    onClick={() =>
                      void setOne(teacher.id, !teacher.can_enter_marks)
                    }
                  >
                    {teacher.can_enter_marks ? 'On' : 'Off'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error ? <p className="manage-form__error">{error}</p> : null}
          {message ? <p className="manage-form__ok">{message}</p> : null}
        </div>
      </div>
    </main>
  )
}

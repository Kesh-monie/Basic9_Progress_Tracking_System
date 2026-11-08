import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.tsx'
import { useYear } from './auth/YearContext.tsx'
import YearStepper from './components/YearStepper.tsx'
import { PASS_MARK } from './data/overviewStats.ts'
import { friendlyError } from './lib/friendlyError.ts'
import { displayName } from './lib/person.ts'
import {
  bestScoredMark,
  supabase,
  type AssessmentRow,
  type AssessmentSittingRow,
  type MarkRow,
  type StudentRow,
} from './lib/supabase.ts'
import './manage.css'

type Draft = {
  score: string
  didNotWrite: boolean
}

export default function ManageMarks() {
  const { user, refreshUser } = useAuth()
  const { yearId, year } = useYear()
  const [params] = useSearchParams()
  const editMode = params.get('edit') === '1'
  const focusStudentId = (() => {
    const raw = params.get('student')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  })()

  const subjectId = user?.role === 'teacher' ? user.subjectId : null
  const canEnter = user?.canEnterMarks !== false
  const allowed =
    user?.role === 'teacher' && subjectId != null && canEnter

  const [assessments, setAssessments] = useState<AssessmentRow[]>([])
  const [assessmentId, setAssessmentId] = useState<number | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [marks, setMarks] = useState<MarkRow[]>([])
  const [sittings, setSittings] = useState<AssessmentSittingRow[]>([])

  const [kind, setKind] = useState<'test' | 'resit' | null>(null)
  const [attemptNo, setAttemptNo] = useState(1)
  const [writtenOn, setWrittenOn] = useState('')
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.role === 'teacher') void refreshUser()
    // Refresh once on open so lock status is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!allowed || yearId == null) return
    void Promise.all([
      supabase
        .from('assessments')
        .select('id, academic_year_id, name, sequence_no')
        .eq('academic_year_id', yearId)
        .order('sequence_no'),
      supabase
        .from('students')
        .select(
          'id, identity_code, full_name, section, photo_url, academic_year_id, gender, date_of_birth',
        )
        .eq('academic_year_id', yearId)
        .order('identity_code'),
    ]).then(([aRes, sRes]) => {
      const rows = (aRes.data ?? []) as AssessmentRow[]
      setAssessments(rows)
      setAssessmentId((prev) => prev ?? rows[0]?.id ?? null)
      setStudents((sRes.data ?? []) as StudentRow[])
    })
  }, [allowed, yearId])

  useEffect(() => {
    if (!allowed || assessmentId == null || subjectId == null) return
    void Promise.all([
      supabase
        .from('marks')
        .select(
          'id, student_id, subject_id, assessment_id, attempt_no, score, status, entered_by, created_at',
        )
        .eq('assessment_id', assessmentId)
        .eq('subject_id', subjectId),
      supabase
        .from('assessment_sittings')
        .select(
          'id, assessment_id, subject_id, attempt_no, written_on, entered_by, created_at',
        )
        .eq('assessment_id', assessmentId)
        .eq('subject_id', subjectId),
    ]).then(([mRes, sRes]) => {
      setMarks((mRes.data ?? []) as MarkRow[])
      setSittings((sRes.data ?? []) as AssessmentSittingRow[])
      setKind(null)
      setAttemptNo(1)
      setWrittenOn('')
      setDrafts({})
      setMessage(null)
      setError(null)
    })
  }, [allowed, assessmentId, subjectId])

  const maxAttempt = useMemo(
    () => marks.reduce((max, m) => Math.max(max, m.attempt_no), 0),
    [marks],
  )

  const hasAnyTestMarks = marks.some((m) => m.attempt_no === 1)
  const sittingForAttempt = sittings.find((s) => s.attempt_no === attemptNo)
  const needsDate = !sittingForAttempt

  const bestByStudent = useMemo(() => {
    const map = new Map<number, number | null>()
    for (const student of students) {
      const theirs = marks.filter((m) => m.student_id === student.id)
      map.set(student.id, bestScoredMark(theirs))
    }
    return map
  }, [students, marks])

  const focusStudent = useMemo(
    () =>
      focusStudentId == null
        ? null
        : (students.find((s) => s.id === focusStudentId) ?? null),
    [students, focusStudentId],
  )

  const listStudents = useMemo(() => {
    if (kind == null) return []
    const hasAttemptMark = (studentId: number, attempt: number) =>
      marks.some(
        (m) => m.student_id === studentId && m.attempt_no === attempt,
      )
    const needsResit = (studentId: number) => {
      const best = bestByStudent.get(studentId)
      return best == null || best < PASS_MARK
    }
    let list =
      editMode
        ? students.filter((s) => hasAttemptMark(s.id, attemptNo))
        : kind === 'test'
          ? students.filter((s) => !hasAttemptMark(s.id, 1))
          : students.filter(
              (s) => needsResit(s.id) && !hasAttemptMark(s.id, attemptNo),
            )
    if (focusStudentId != null) {
      list = list.filter((s) => s.id === focusStudentId)
    }
    return list
  }, [
    students,
    marks,
    kind,
    attemptNo,
    editMode,
    bestByStudent,
    focusStudentId,
  ])

  useEffect(() => {
    const next: Record<number, Draft> = {}
    for (const student of listStudents) {
      const existing = marks.find(
        (m) => m.student_id === student.id && m.attempt_no === attemptNo,
      )
      next[student.id] = {
        score:
          existing?.status === 'scored' && existing.score != null
            ? String(existing.score)
            : '',
        didNotWrite: existing?.status === 'did_not_write',
      }
    }
    setDrafts(next)
    if (sittingForAttempt) setWrittenOn(sittingForAttempt.written_on)
  }, [listStudents, attemptNo, marks, sittingForAttempt])

  const resitOptions = useMemo(() => {
    const options: number[] = []
    const highestResitAttempt = Math.max(maxAttempt, 1)
    for (let a = 2; a <= highestResitAttempt; a += 1) options.push(a)
    const next = Math.max(maxAttempt + 1, 2)
    if (!options.includes(next)) options.push(next)
    return options
  }, [maxAttempt])

  if (user?.role === 'teacher' && !canEnter) {
    return (
      <main className="manage-page">
        <div className="manage-page__content zoom-in">
          <Link to="/overview" className="manage-page__back">
            ← Overview
          </Link>
          <h1>Marks locked</h1>
          <p className="manage-page__lead">
            The supervisor has turned off marks entry for your account.
          </p>
        </div>
      </main>
    )
  }

  if (!allowed) {
    return <Navigate to="/overview" replace />
  }

  const chooseTest = () => {
    setKind('test')
    setAttemptNo(1)
  }

  const chooseResit = (n: number) => {
    setKind('resit')
    setAttemptNo(n)
  }

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (assessmentId == null || subjectId == null || !user) return
    if (kind == null) {
      setError('Select test or resit first.')
      return
    }
    if (needsDate && !writtenOn) {
      setError('Pick the date this test/resit was written.')
      return
    }
    if (listStudents.length === 0) {
      setError('No students left for this sitting.')
      return
    }

    const rows: Array<{
      student_id: number
      subject_id: number
      assessment_id: number
      attempt_no: number
      score: number | null
      status: 'scored' | 'did_not_write'
      entered_by: number
    }> = []

    for (const student of listStudents) {
      const draft = drafts[student.id]
      if (!draft) continue
      if (draft.didNotWrite) {
        rows.push({
          student_id: student.id,
          subject_id: subjectId,
          assessment_id: assessmentId,
          attempt_no: attemptNo,
          score: null,
          status: 'did_not_write',
          entered_by: user.id,
        })
        continue
      }
      if (draft.score.trim() === '') continue
      const scoreNum = Number(draft.score)
      if (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        setError(
          `Invalid score for ${displayName(student.full_name, student.gender)}.`,
        )
        return
      }
      rows.push({
        student_id: student.id,
        subject_id: subjectId,
        assessment_id: assessmentId,
        attempt_no: attemptNo,
        score: scoreNum,
        status: 'scored',
        entered_by: user.id,
      })
    }

    if (rows.length === 0) {
      setError('Enter at least one score or mark Did not write.')
      return
    }

    setSaving(true)

    if (needsDate) {
      const { error: sitErr } = await supabase
        .from('assessment_sittings')
        .insert({
          assessment_id: assessmentId,
          subject_id: subjectId,
          attempt_no: attemptNo,
          written_on: writtenOn,
          entered_by: user.id,
        })
      if (sitErr && !sitErr.message.toLowerCase().includes('duplicate')) {
        setSaving(false)
        setError(friendlyError(sitErr, 'Could not save the test date.'))
        return
      }
    }

    if (editMode) {
      for (const row of rows) {
        const { error: upErr } = await supabase
          .from('marks')
          .update({
            score: row.score,
            status: row.status,
            entered_by: row.entered_by,
          })
          .eq('student_id', row.student_id)
          .eq('subject_id', row.subject_id)
          .eq('assessment_id', row.assessment_id)
          .eq('attempt_no', row.attempt_no)
        if (upErr) {
          setSaving(false)
          setError(friendlyError(upErr, 'Could not update marks.'))
          return
        }
      }
    } else {
      const { error: insErr } = await supabase.from('marks').upsert(rows, {
        onConflict: 'student_id,subject_id,assessment_id,attempt_no',
      })
      if (insErr) {
        setSaving(false)
        setError(friendlyError(insErr, 'Could not save marks.'))
        return
      }
    }

    setSaving(false)
    setMessage(
      editMode
        ? `Updated ${rows.length} mark(s).`
        : `Saved ${rows.length} mark(s). You can leave and finish the rest later.`,
    )

    const { data } = await supabase
      .from('marks')
      .select(
        'id, student_id, subject_id, assessment_id, attempt_no, score, status, entered_by, created_at',
      )
      .eq('assessment_id', assessmentId)
      .eq('subject_id', subjectId)
    setMarks((data ?? []) as MarkRow[])
    const { data: sitData } = await supabase
      .from('assessment_sittings')
      .select(
        'id, assessment_id, subject_id, attempt_no, written_on, entered_by, created_at',
      )
      .eq('assessment_id', assessmentId)
      .eq('subject_id', subjectId)
    setSittings((sitData ?? []) as AssessmentSittingRow[])
  }

  const selectedAssessment = assessments.find((a) => a.id === assessmentId)

  return (
    <main className="manage-page manage-page--wide">
      <div className="manage-page__content zoom-in">
        <div className="manage-page__top">
          <Link
            to={
              focusStudentId != null
                ? `/student-info/${focusStudentId}`
                : '/overview'
            }
            className="manage-page__back"
          >
            {focusStudentId != null ? '← Student' : '← Overview'}
          </Link>
          <div>
            <h1>{editMode ? 'Edit marks' : 'Enter marks'}</h1>
            <p className="manage-page__lead">
              {year?.label ?? 'Active year'}
              {focusStudent
                ? ` · ${displayName(focusStudent.full_name, focusStudent.gender)}`
                : ' · class list'}
            </p>
          </div>
        </div>

        <YearStepper locked compact />

        <form className="manage-sheet" onSubmit={onSave}>
          <label className="manage-field">
            <span>Test</span>
            <select
              value={assessmentId ?? ''}
              onChange={(e) =>
                setAssessmentId(e.target.value ? Number(e.target.value) : null)
              }
              required
            >
              {assessments.length === 0 ? (
                <option value="">No tests yet</option>
              ) : (
                assessments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              )}
            </select>
          </label>

          {assessmentId && kind == null ? (
            <div className="mark-choice">
              <div className="mark-choice__row">
                <button type="button" className="btn-primary" onClick={chooseTest}>
                  {editMode ? 'Edit test' : 'Test marks'}
                </button>
                {hasAnyTestMarks || editMode ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setKind('resit')
                      setAttemptNo(0)
                    }}
                  >
                    {editMode ? 'Edit resit' : 'Resit marks'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {kind === 'resit' && attemptNo < 2 ? (
            <div className="mark-choice">
              <div className="mark-choice__row">
                {resitOptions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="btn-ghost"
                    onClick={() => chooseResit(a)}
                  >
                    Resit {a - 1}
                    {a > maxAttempt ? ' · new' : ''}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setKind(null)}
                >
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {kind === 'test' || (kind === 'resit' && attemptNo >= 2) ? (
            <>
              <div className="mark-meta">
                <strong>
                  {kind === 'test'
                    ? selectedAssessment?.name
                    : `${selectedAssessment?.name} · Resit ${attemptNo - 1}`}
                </strong>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setKind(null)}
                >
                  Change
                </button>
              </div>

              {needsDate ? (
                <label className="manage-field">
                  <span>Date written</span>
                  <input
                    type="date"
                    value={writtenOn}
                    onChange={(e) => setWrittenOn(e.target.value)}
                    required
                  />
                </label>
              ) : (
                <p className="manage-page__lead">
                  Date: <strong>{sittingForAttempt?.written_on}</strong>
                </p>
              )}

              <div className="mark-list">
                <div className="mark-list__head">
                  <span>{listStudents.length} students</span>
                </div>
                {listStudents.length === 0 ? (
                  <p className="manage-page__lead">All done for this sitting.</p>
                ) : (
                  listStudents.map((student) => {
                    const draft = drafts[student.id] ?? {
                      score: '',
                      didNotWrite: false,
                    }
                    return (
                      <div className="mark-list__row" key={student.id}>
                        <div>
                          <strong>
                            {displayName(student.full_name, student.gender)}
                          </strong>
                          <small>
                            {student.identity_code} · {student.section}
                            {!editMode && kind === 'resit'
                              ? ` · best ${bestByStudent.get(student.id) ?? '—'}`
                              : ''}
                          </small>
                        </div>
                        <div className="mark-list__inputs">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="%"
                            disabled={draft.didNotWrite}
                            value={draft.didNotWrite ? '' : draft.score}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [student.id]: {
                                  ...draft,
                                  score: e.target.value,
                                  didNotWrite: false,
                                },
                              }))
                            }
                          />
                          <label className="mark-list__absent">
                            <input
                              type="checkbox"
                              checked={draft.didNotWrite}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [student.id]: {
                                    score: '',
                                    didNotWrite: e.target.checked,
                                  },
                                }))
                              }
                            />
                            Did not write
                          </label>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {error ? <p className="manage-form__error">{error}</p> : null}
              {message ? <p className="manage-form__ok">{message}</p> : null}

              <button
                type="submit"
                className="btn-primary"
                disabled={saving || listStudents.length === 0}
              >
                {saving ? 'Saving…' : editMode ? 'Save changes' : 'Save marks'}
              </button>
            </>
          ) : null}
        </form>
      </div>
    </main>
  )
}

import type { RefObject } from 'react'
import favicon from '../assets/image/favicon.png'
import schoolBadge from '../assets/image/school-badge.jpg'
import { PASS_MARK } from '../data/overviewStats.ts'
import type { LiveStudent } from '../data/loadOverview.ts'
import { averageOf, formatScore, hasScore } from '../lib/marks.ts'
import './StudentProgressReport.css'
import './OverviewReports.css'

type Props = {
  students: LiveStudent[]
  subjectName: string
  yearLabel: string
  teacherName: string
  /** Label of the selected test (e.g. "Test 1"). */
  testLabel: string
  /** Index into each student's attempts/scores for that test. */
  assessmentIndex: number
  sectionLabel?: string
  reportRef?: RefObject<HTMLElement | null>
}

const formatDelta = (delta: number) => {
  if (delta > 0) return `+${delta}%`
  if (delta < 0) return `${delta}%`
  return '0%'
}

const todayLabel = () =>
  new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

function sittingDisplay(score: number | null, status: 'scored' | 'did_not_write') {
  if (status === 'did_not_write') return 'DNW'
  return formatScore(score)
}

export default function SubjectClassProgressReport({
  students,
  subjectName,
  yearLabel,
  teacherName,
  testLabel,
  assessmentIndex,
  sectionLabel = 'All sections',
  reportRef,
}: Props) {
  const ordered = [...students].sort(
    (a, b) =>
      a.section.localeCompare(b.section) ||
      a.studentId.localeCompare(b.studentId),
  )

  const bestScores = students.map((s) => s.scores[assessmentIndex] ?? null)
  const classAverage = averageOf(bestScores)
  const targetMet = bestScores.filter(
    (score) => hasScore(score) && score >= PASS_MARK,
  ).length

  return (
    <article
      className="progress-report overview-report overview-report--class-list"
      ref={reportRef}
      id="subject-class-progress-report"
    >
      <div className="progress-report__watermark" aria-hidden="true">
        <img src={schoolBadge} alt="" />
      </div>

      <header className="progress-report__letterhead">
        <div className="progress-report__brand">
          <img className="progress-report__favicon" src={favicon} alt="" />
          <div>
            <p className="progress-report__school-short">BMI</p>
            <h1 className="progress-report__school">
              Bediako Memorial Institute
            </h1>
            <p className="progress-report__motto">
              Knowledge · Skills · Values
            </p>
          </div>
        </div>
        <div className="progress-report__meta">
          <p className="progress-report__doc-title">Class Progress List</p>
          <p>
            <strong>Subject:</strong> {subjectName}
          </p>
          <p>
            <strong>Assessment:</strong> {testLabel}
          </p>
          <p>
            <strong>Section:</strong> {sectionLabel}
          </p>
          <p>
            <strong>Academic year:</strong> {yearLabel}
          </p>
          <p>
            <strong>Date issued:</strong> {todayLabel()}
          </p>
        </div>
      </header>

      <div className="progress-report__rule" />

      <section className="overview-report__summary overview-report__summary--four">
        <div>
          <span>Students</span>
          <strong>{students.length}</strong>
        </div>
        <div>
          <span>Class average</span>
          <strong>{classAverage != null ? `${classAverage}%` : '—'}</strong>
        </div>
        <div>
          <span>Target met</span>
          <strong>
            {targetMet}/{students.length}
          </strong>
        </div>
        <div>
          <span>Teacher</span>
          <strong className="is-text">{teacherName}</strong>
        </div>
      </section>

      <p className="overview-report__legend">
        This list covers <strong>{testLabel}</strong> only — the first sitting
        and every resit. DNW = did not write. Colored deltas show progress from
        one sitting to the next. Where a resit was written, the higher mark is
        the best for that test.
      </p>

      <section className="progress-report__block">
        <h2>
          {subjectName} — {testLabel} &amp; resits
        </h2>
        <div className="overview-report__table-wrap">
          <table className="overview-report__table overview-report__table--sittings">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>ID</th>
                <th>Section</th>
                <th>
                  {testLabel}
                  <small>Test + resits</small>
                </th>
                <th>
                  Best
                  <small>Highest mark</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 ? (
                <tr>
                  <td colSpan={6}>No students found for this selection.</td>
                </tr>
              ) : (
                ordered.map((student, index) => {
                  const sittings =
                    student.attempts[assessmentIndex]?.sittings ?? []
                  const best = student.scores[assessmentIndex] ?? null
                  let prevScore: number | null = null
                  return (
                    <tr
                      key={student.id}
                      className="overview-report__student-row"
                    >
                      <td>{index + 1}</td>
                      <td>
                        <strong>{student.name}</strong>
                      </td>
                      <td>{student.studentId}</td>
                      <td>{student.section}</td>
                      <td className="overview-report__sit-cell">
                        {sittings.length === 0 ? (
                          <span className="overview-report__empty-sit">—</span>
                        ) : (
                          <ul className="overview-report__sit-list">
                            {sittings.map((sitting) => {
                              const currentScore =
                                sitting.status === 'scored' &&
                                sitting.score != null
                                  ? sitting.score
                                  : null
                              const step =
                                currentScore != null && prevScore != null
                                  ? currentScore - prevScore
                                  : null
                              if (currentScore != null) {
                                prevScore = currentScore
                              }
                              const tone =
                                step == null
                                  ? 'flat'
                                  : step > 0
                                    ? 'up'
                                    : step < 0
                                      ? 'down'
                                      : 'flat'
                              return (
                                <li
                                  key={`${student.id}-${assessmentIndex}-${sitting.attemptNo}`}
                                >
                                  <span className="overview-report__sit-label">
                                    {sitting.label}
                                  </span>
                                  <strong
                                    className={
                                      sitting.status === 'did_not_write'
                                        ? 'is-dnw'
                                        : undefined
                                    }
                                  >
                                    {sittingDisplay(
                                      sitting.score,
                                      sitting.status,
                                    )}
                                  </strong>
                                  <em
                                    className={
                                      step != null
                                        ? `progress-report__delta is-${tone}`
                                        : undefined
                                    }
                                  >
                                    {step != null ? formatDelta(step) : ''}
                                  </em>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </td>
                      <td>
                        <strong>{formatScore(best)}</strong>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="progress-report__signoff">
        <div>
          <p className="progress-report__sign-line" />
          <span>Subject teacher</span>
          <strong>{teacherName}</strong>
        </div>
        <div>
          <p className="progress-report__sign-line" />
          <span>Date</span>
          <strong>{todayLabel()}</strong>
        </div>
        <div>
          <p className="progress-report__sign-line" />
          <span>Pass mark</span>
          <strong>{PASS_MARK}%</strong>
        </div>
      </footer>

      <p className="progress-report__footer-note">
        Official BMI class progress list · {subjectName} · {testLabel} ·{' '}
        {sectionLabel} · {yearLabel}
      </p>
    </article>
  )
}

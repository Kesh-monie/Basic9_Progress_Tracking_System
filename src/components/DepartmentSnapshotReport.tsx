import type { RefObject } from 'react'
import favicon from '../assets/image/favicon.png'
import schoolBadge from '../assets/image/school-badge.jpg'
import { PASS_MARK } from '../data/overviewStats.ts'
import type { SubjectAverage } from '../data/loadOverview.ts'
import { formatScore } from '../lib/marks.ts'
import './StudentProgressReport.css'
import './OverviewReports.css'

type SubjectRow = SubjectAverage & {
  code?: string | null
}

type Props = {
  subjects: SubjectRow[]
  studentCount: number
  yearLabel: string
  supervisorName: string
  strongest: SubjectRow | null
  weakest: SubjectRow | null
  resitCount: number
  targetMetCount: number
  departmentAverage: number | null
  reportRef?: RefObject<HTMLElement | null>
}

const todayLabel = () =>
  new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export default function DepartmentSnapshotReport({
  subjects,
  studentCount,
  yearLabel,
  supervisorName,
  strongest,
  weakest,
  resitCount,
  targetMetCount,
  departmentAverage,
  reportRef,
}: Props) {
  const scoredSubjects = subjects.filter(
    (s) => s.hasMarks && s.average != null,
  )

  return (
    <article
      className="progress-report overview-report overview-report--snapshot"
      ref={reportRef}
      id="department-snapshot-report"
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
          <p className="progress-report__doc-title">Department Snapshot</p>
          <p>
            <strong>Scope:</strong> All subjects · JHS 3
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

      <section className="overview-report__summary">
        <div>
          <span>Subjects</span>
          <strong>{subjects.length}</strong>
          <small>{scoredSubjects.length} with marks</small>
        </div>
        <div>
          <span>Dept. average</span>
          <strong>
            {departmentAverage != null ? `${departmentAverage}%` : '—'}
          </strong>
          <small>Across marked subjects</small>
        </div>
        <div>
          <span>Students</span>
          <strong>{studentCount}</strong>
          <small>Tracked this year</small>
        </div>
        <div>
          <span>Subjects on track</span>
          <strong className="is-up">{targetMetCount}</strong>
          <small>Average {PASS_MARK}%+</small>
        </div>
        <div>
          <span>Subjects below</span>
          <strong className={resitCount > 0 ? 'is-down' : 'is-up'}>
            {resitCount}
          </strong>
          <small>Need resit focus</small>
        </div>
      </section>

      <section className="overview-report__highlights">
        <div>
          <span>Strongest subject</span>
          <strong>
            {strongest
              ? `${strongest.subject} · ${formatScore(strongest.average)}`
              : '—'}
          </strong>
        </div>
        <div>
          <span>Needs attention</span>
          <strong className="is-down">
            {weakest
              ? `${weakest.subject} · ${formatScore(weakest.average)}`
              : '—'}
          </strong>
        </div>
        <div>
          <span>Pass mark</span>
          <strong>{PASS_MARK}%</strong>
        </div>
      </section>

      <p className="overview-report__legend">
        Subject status uses each subject class average against the {PASS_MARK}%
        pass mark. Students tracked: {studentCount}.
      </p>

      <section className="progress-report__block">
        <h2>Subject performance overview</h2>
        <div className="overview-report__table-wrap">
          <table className="overview-report__table">
            <thead>
              <tr>
                <th>#</th>
                <th>Subject</th>
                <th>Code</th>
                <th>Average</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={5}>No subjects found.</td>
                </tr>
              ) : (
                subjects.map((subject, index) => {
                  const below =
                    subject.average != null && subject.average < PASS_MARK
                  return (
                    <tr key={subject.subjectId}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{subject.subject}</strong>
                      </td>
                      <td>{subject.code ?? '—'}</td>
                      <td>
                        {subject.hasMarks && subject.average != null
                          ? `${subject.average}%`
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={`overview-report__chip is-${
                            !subject.hasMarks || subject.average == null
                              ? 'empty'
                              : below
                                ? 'resit'
                                : 'pass'
                          }`}
                        >
                          {!subject.hasMarks || subject.average == null
                            ? 'No marks'
                            : below
                              ? 'Below target'
                              : 'On target'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="progress-report__notes">
        <h2>Supervisor note</h2>
        <p>
          {strongest && weakest
            ? `${strongest.subject} currently leads the department at ${strongest.average}%, while ${weakest.subject} needs the closest follow-up at ${weakest.average}%. ${resitCount} subject${resitCount === 1 ? '' : 's'} currently sit below the ${PASS_MARK}% target.`
            : 'Subject marks are still incomplete for a full department comparison.'}
        </p>
      </section>

      <footer className="progress-report__signoff">
        <div>
          <p className="progress-report__sign-line" />
          <span>Supervisor</span>
          <strong>{supervisorName}</strong>
        </div>
        <div>
          <p className="progress-report__sign-line" />
          <span>Date</span>
          <strong>{todayLabel()}</strong>
        </div>
        <div>
          <p className="progress-report__sign-line" />
          <span>Reviewed</span>
          <strong>________________</strong>
        </div>
      </footer>

      <p className="progress-report__footer-note">
        Official BMI department snapshot · All subjects · {yearLabel}
      </p>
    </article>
  )
}

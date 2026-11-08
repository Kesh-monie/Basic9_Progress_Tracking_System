import type { RefObject } from 'react'
import favicon from '../assets/image/favicon.png'
import schoolBadge from '../assets/image/school-badge.jpg'
import type { StudentResultSlipData } from '../data/loadStudentResults.ts'
import { formatScore } from '../lib/marks.ts'
import './StudentProgressReport.css'
import './StudentResultSlip.css'

export type StudentResultSlipProps = {
  slip: StudentResultSlipData
  yearLabel: string
  supervisorName: string
  reportRef?: RefObject<HTMLElement | null>
  /** When rendering many slips for print, mark page breaks. */
  pageBreakAfter?: boolean
}

const todayLabel = () =>
  new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

function scoreCell(slipLine: StudentResultSlipData['subjects'][number]) {
  if (slipLine.status === 'did_not_write') return 'DNW'
  if (slipLine.status === 'missing') return '—'
  return formatScore(slipLine.score)
}

export default function StudentResultSlip({
  slip,
  yearLabel,
  supervisorName,
  reportRef,
  pageBreakAfter = false,
}: StudentResultSlipProps) {
  return (
    <article
      className={`progress-report result-slip${pageBreakAfter ? ' result-slip--break' : ''}`}
      ref={reportRef}
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
          <p className="progress-report__doc-title">Student assessment result</p>
          <p>
            <strong>Assessment:</strong> {slip.assessmentName}
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

      <section className="progress-report__student">
        <div className="progress-report__photo">
          <img src={slip.photo} alt="" />
        </div>
        <div className="progress-report__student-grid">
          <div>
            <span>Student name</span>
            <strong>{slip.name}</strong>
          </div>
          <div>
            <span>Student ID</span>
            <strong>{slip.studentId}</strong>
          </div>
          <div>
            <span>Section</span>
            <strong>{slip.section}</strong>
          </div>
          <div>
            <span>Supervisor</span>
            <strong>{supervisorName}</strong>
          </div>
        </div>
      </section>

      <section className="result-slip__block">
        <h3 className="result-slip__heading">Subject results</h3>
        <p className="result-slip__note">
          Higher mark used after resit. Grades 1–9 (BECE). Aggregate = Eng,
          Maths, Science, Social + best 2 others.
        </p>

        <table className="result-slip__table">
          <thead>
            <tr>
              <th scope="col">Subject</th>
              <th scope="col">Raw mark</th>
              <th scope="col">Grade</th>
              <th scope="col">Interpretation</th>
              <th scope="col">Agg.</th>
            </tr>
          </thead>
          <tbody>
            {slip.subjects.map((line) => (
              <tr
                key={line.subjectId}
                className={line.usedInAggregate ? 'is-counted' : undefined}
              >
                <td>
                  <strong>{line.subjectName}</strong>
                  {line.isCore ? (
                    <span className="result-slip__core">Core</span>
                  ) : null}
                  {line.hasResit &&
                  line.firstSit != null &&
                  line.score != null ? (
                    <span className="result-slip__resit-hint">
                      Best of {line.firstSit}%
                      {line.bestResit != null ? ` / ${line.bestResit}%` : ''}
                    </span>
                  ) : null}
                </td>
                <td>{scoreCell(line)}</td>
                <td className="result-slip__grade">{line.gradeDisplay}</td>
                <td>{line.gradeLabel}</td>
                <td>{line.usedInAggregate ? '●' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="result-slip__aggregate">
        <div>
          <p className="result-slip__agg-label">Aggregate</p>
          <p className="result-slip__agg-value">
            {slip.aggregate != null ? slip.aggregate : '—'}
          </p>
        </div>
        <p className="result-slip__agg-detail">
          {slip.aggregate != null
            ? slip.aggregateComplete
              ? `Core four + best electives${
                  slip.electiveNames.length
                    ? ` (${slip.electiveNames.join(', ')})`
                    : ''
                }. Lower aggregate is better.`
              : 'Core four graded; fewer than two elective grades available.'
            : 'Aggregate needs grades in English, Mathematics, Science, and Social Studies.'}
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
          <span>Parent / guardian</span>
          <strong>________________</strong>
        </div>
      </footer>

      <p className="progress-report__footer-note">
        Official BMI assessment result
      </p>
    </article>
  )
}

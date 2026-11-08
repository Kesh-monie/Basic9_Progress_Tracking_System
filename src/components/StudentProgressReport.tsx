import type { RefObject } from 'react'
import favicon from '../assets/image/favicon.png'
import schoolBadge from '../assets/image/school-badge.jpg'
import { PASS_MARK } from '../data/overviewStats.ts'
import type { LiveStudent } from '../data/loadOverview.ts'
import {
  formatResitNeededItem,
  formatResitsNeededStatus,
  formatScore,
  hasScore,
  resolveStudentProgress,
  studentNeedsAnyResit,
} from '../lib/marks.ts'
import './StudentProgressReport.css'

export type ProgressReportProps = {
  student: LiveStudent
  subjectName: string
  yearLabel: string
  teacherName: string
  testLabels: string[]
  classAverage: number | null
  rank: number
  rankedCount: number
  reportRef?: RefObject<HTMLElement | null>
}

const formatDelta = (delta: number) => {
  if (delta > 0) return `+${delta}%`
  if (delta < 0) return `${delta}%`
  return '0%'
}

const rankLabel = (rank: number) => {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  if (rank === 3) return '3rd'
  return `${rank}th`
}

const todayLabel = () =>
  new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export default function StudentProgressReport({
  student,
  subjectName,
  yearLabel,
  teacherName,
  testLabels,
  classAverage,
  rank,
  rankedCount,
  reportRef,
}: ProgressReportProps) {
  const progress = resolveStudentProgress(student, testLabels)
  const canDelta = progress != null
  const delta = progress?.delta ?? 0
  const canResitDelta = progress?.isResit ?? false
  const trend =
    !canDelta ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const needsResit = studentNeedsAnyResit(student)
  const vsAverage =
    hasScore(student.test2) && classAverage != null
      ? student.test2 - classAverage
      : null

  const statusText = needsResit
    ? formatResitsNeededStatus(student)
    : !hasScore(student.test2)
      ? 'No mark recorded yet'
      : `Target met (${PASS_MARK}%+)`

  const statusTone = needsResit
    ? 'resit'
    : !hasScore(student.test2)
      ? 'empty'
      : 'pass'

  return (
    <article
      className="progress-report"
      ref={reportRef}
      id="student-progress-report"
    >
      <div className="progress-report__watermark" aria-hidden="true">
        <img src={schoolBadge} alt="" />
      </div>

      <header className="progress-report__letterhead">
        <div className="progress-report__brand">
          <img
            className="progress-report__favicon"
            src={favicon}
            alt=""
          />
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
          <p className="progress-report__doc-title">Subject Progress Report</p>
          <p>
            <strong>Subject:</strong> {subjectName}
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
          <img src={student.photo} alt="" />
        </div>
        <div className="progress-report__student-grid">
          <div>
            <span>Student name</span>
            <strong>{student.name}</strong>
          </div>
          <div>
            <span>Student ID</span>
            <strong>{student.studentId}</strong>
          </div>
          <div>
            <span>Section</span>
            <strong>{student.section}</strong>
          </div>
          <div>
            <span>Subject teacher</span>
            <strong>{teacherName}</strong>
          </div>
        </div>
      </section>

      <section className="progress-report__summary">
        <div className="progress-report__kpi">
          <span>Latest score</span>
          <strong>{formatScore(student.test2)}</strong>
          <small>
            {progress
              ? `${formatScore(progress.from)} → ${formatScore(progress.to)}`
              : `From Test 1: ${formatScore(student.test1)}`}
          </small>
        </div>
        <div className="progress-report__kpi">
          <span>{progress?.label ?? 'Progress'}</span>
          <strong className={`is-${trend}`}>
            {canDelta ? formatDelta(delta) : '—'}
          </strong>
          <small>
            {canResitDelta
              ? trend === 'up'
                ? 'Improved after resit'
                : trend === 'down'
                  ? 'Lower after resit'
                  : 'Same after resit'
              : trend === 'up'
                ? 'Improving'
                : trend === 'down'
                  ? 'Declining'
                  : canDelta
                    ? 'Unchanged'
                    : 'Not enough scores'}
          </small>
        </div>
        <div className="progress-report__kpi">
          <span>Class position</span>
          <strong>{rank > 0 ? rankLabel(rank) : '—'}</strong>
          <small>
            {rank > 0
              ? `Out of ${rankedCount} students with marks`
              : 'No scored mark yet'}
          </small>
        </div>
        <div className="progress-report__kpi">
          <span>Vs class average</span>
          <strong
            className={
              vsAverage == null
                ? 'is-flat'
                : vsAverage > 0
                  ? 'is-up'
                  : vsAverage < 0
                    ? 'is-down'
                    : 'is-flat'
            }
          >
            {vsAverage == null ? '—' : formatDelta(vsAverage)}
          </strong>
          <small>
            Class average:{' '}
            {classAverage != null ? `${classAverage}%` : '—'}
          </small>
        </div>
      </section>

      <section className="progress-report__block">
        <h2>Assessment record — {subjectName}</h2>
        <table className="progress-report__table">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Score</th>
              <th>Change</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {student.scores.length === 0 ? (
              <tr>
                <td colSpan={4}>No assessments recorded for this year.</td>
              </tr>
            ) : (
              student.scores.map((score, i) => {
                const attempt = student.attempts[i]
                const prev = i > 0 ? student.scores[i - 1] : null
                const canStep = hasScore(score) && hasScore(prev)
                const step = canStep ? (score as number) - (prev as number) : null
                const canResitStep =
                  attempt?.hasResit &&
                  hasScore(attempt.firstSit) &&
                  hasScore(attempt.bestResit)
                const resitStep = canResitStep
                  ? (attempt.bestResit as number) -
                    (attempt.firstSit as number)
                  : null
                const shownStep = canResitStep ? resitStep : step
                const stepTone =
                  shownStep == null
                    ? 'flat'
                    : shownStep > 0
                      ? 'up'
                      : shownStep < 0
                        ? 'down'
                        : 'flat'
                const label =
                  testLabels[i] ??
                  (i === student.scores.length - 1 && i > 0
                    ? 'Latest'
                    : `Test ${i + 1}`)
                const isLatest = i === student.scores.length - 1
                const owed = student.resitsNeeded.find(
                  (item) => item.assessmentIndex === i,
                )
                const remark = owed
                  ? owed.reason === 'did_not_write'
                    ? 'Resit required · DNW'
                    : `Resit required · ${formatScore(owed.bestScore)}`
                  : attempt?.hasResit
                    ? `Resit ${formatScore(attempt.bestResit)} (from ${formatScore(attempt.firstSit)})`
                    : !hasScore(score)
                      ? 'Not recorded'
                      : 'Target met'
                return (
                  <tr key={`${label}-${i}`} className={isLatest ? 'is-latest' : undefined}>
                    <td>{label}</td>
                    <td>
                      <strong>{formatScore(score)}</strong>
                      {attempt?.hasResit ? (
                        <small style={{ display: 'block', color: '#5b5278' }}>
                          Sit {formatScore(attempt.firstSit)}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <span className={`progress-report__delta is-${stepTone}`}>
                        {shownStep == null ? '—' : formatDelta(shownStep)}
                      </span>
                    </td>
                    <td>{remark}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </section>

      <section className="progress-report__status-row">
        <div className={`progress-report__status is-${statusTone}`}>
          <span>Status</span>
          <strong>{statusText}</strong>
        </div>
        <div className="progress-report__status is-info">
          <span>Resits written</span>
          <strong>{student.resitsWritten}</strong>
        </div>
        <div className="progress-report__status is-info">
          <span>Pass mark</span>
          <strong>{PASS_MARK}%</strong>
        </div>
      </section>

      {needsResit ? (
        <section className="progress-report__block">
          <h2>Tests requiring a resit</h2>
          <ul className="progress-report__resit-tests">
            {student.resitsNeeded.map((item) => (
              <li key={item.assessmentIndex}>
                {formatResitNeededItem(item)}
                {item.reason === 'did_not_write'
                  ? ' — did not write'
                  : ` — below ${PASS_MARK}%`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="progress-report__notes">
        <h2>Teacher remark</h2>
        <p>
          {needsResit
            ? `${student.name} must write a resit for: ${student.resitsNeeded
                .map((item) => formatResitNeededItem(item))
                .join('; ')}.`
            : !hasScore(student.test2)
              ? `No latest mark has been recorded yet for ${student.name} in ${subjectName}.`
              : trend === 'up'
                ? `${student.name} is improving in ${subjectName}. Continue the current support and practice.`
                : trend === 'down'
                  ? `${student.name} is declining in ${subjectName}. Extra support and a focused revision plan are recommended.`
                  : `${student.name} has met the ${PASS_MARK}% target in ${subjectName}.`}
        </p>
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
          <span>Parent / guardian</span>
          <strong>________________</strong>
        </div>
      </footer>

      <p className="progress-report__footer-note">
        Official BMI subject progress report · Generated for {subjectName}
      </p>
    </article>
  )
}

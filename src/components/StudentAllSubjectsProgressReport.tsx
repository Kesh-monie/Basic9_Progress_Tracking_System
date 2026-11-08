import type { RefObject } from 'react'
import favicon from '../assets/image/favicon.png'
import schoolBadge from '../assets/image/school-badge.jpg'
import { PASS_MARK } from '../data/overviewStats.ts'
import type {
  AssessmentOption,
  DepartmentStudent,
  SubjectProgressLine,
} from '../data/loadStudentResults.ts'
import { resolveSubjectProgress } from '../data/loadStudentResults.ts'
import { formatScore, hasScore } from '../lib/marks.ts'
import './StudentProgressReport.css'
import './OverviewReports.css'
import './StudentAllSubjectsProgressReport.css'

export type StudentAllSubjectsProgressReportProps = {
  student: DepartmentStudent
  assessments: AssessmentOption[]
  yearLabel: string
  supervisorName: string
  reportRef?: RefObject<HTMLElement | null>
  pageBreakAfter?: boolean
}

const todayLabel = () =>
  new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

const formatDelta = (delta: number | null) => {
  if (delta == null) return '—'
  if (delta > 0) return `+${delta}%`
  if (delta < 0) return `${delta}%`
  return '0%'
}

const sittingDisplay = (
  score: number | null,
  status: 'scored' | 'did_not_write',
) => {
  if (status === 'did_not_write') return 'DNW'
  return formatScore(score)
}

function firstMarkedIndex(subject: SubjectProgressLine) {
  return subject.scores.findIndex((n) => n != null)
}

function latestMarkedIndex(subject: SubjectProgressLine) {
  return [...subject.scores]
    .map((n, i) => ({ n, i }))
    .reverse()
    .find((row) => row.n != null)?.i
}

function SittingColumn({
  subject,
  index,
}: {
  subject: SubjectProgressLine
  index: number | undefined
}) {
  if (index == null || index < 0) {
    return <span className="overview-report__empty-sit">—</span>
  }

  const sittings = subject.attempts[index]?.sittings ?? []
  if (sittings.length === 0) {
    return <span className="overview-report__empty-sit">—</span>
  }

  let prevScore: number | null = null
  return (
    <ul className="overview-report__sit-list">
      {sittings.map((sitting) => {
        const currentScore =
          sitting.status === 'scored' && sitting.score != null
            ? sitting.score
            : null
        const step =
          currentScore != null && prevScore != null
            ? currentScore - prevScore
            : null
        if (currentScore != null) prevScore = currentScore
        const stepTone =
          step == null
            ? undefined
            : step > 0
              ? 'up'
              : step < 0
                ? 'down'
                : 'flat'
        return (
          <li key={`${subject.subjectId}-${index}-${sitting.attemptNo}`}>
            <span className="overview-report__sit-label">{sitting.label}</span>
            <strong
              className={
                sitting.status === 'did_not_write' ? 'is-dnw' : undefined
              }
            >
              {sittingDisplay(sitting.score, sitting.status)}
            </strong>
            <em className={stepTone ? `is-${stepTone}` : undefined}>
              {step != null ? formatDelta(step) : ''}
            </em>
          </li>
        )
      })}
    </ul>
  )
}

export default function StudentAllSubjectsProgressReport({
  student,
  assessments,
  yearLabel,
  supervisorName,
  reportRef,
  pageBreakAfter = false,
}: StudentAllSubjectsProgressReportProps) {
  const assessmentLabels = assessments.map((a) => a.name)
  const scoredSubjects = student.subjects.filter((s) => s.latest != null)
  const onTarget = scoredSubjects.filter(
    (s) => hasScore(s.latest) && (s.latest as number) >= PASS_MARK,
  ).length
  const needsAttention = scoredSubjects.filter(
    (s) => hasScore(s.latest) && (s.latest as number) < PASS_MARK,
  ).length
  const improving = student.subjects.filter((subject) => {
    const progress = resolveSubjectProgress(subject, assessmentLabels)
    return progress != null && progress.delta > 0
  }).length

  return (
    <article
      className={`progress-report all-subjects-progress${
        pageBreakAfter ? ' all-subjects-progress--break' : ''
      }`}
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
          <p className="progress-report__doc-title">
            Student Progress Report
          </p>
          <p>
            <strong>Scope:</strong> All subjects
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
            <span>Supervisor</span>
            <strong>{supervisorName}</strong>
          </div>
        </div>
      </section>

      <section className="overview-report__summary overview-report__summary--four all-subjects-progress__summary">
        <div>
          <span>Overall average</span>
          <strong>
            {student.overallLatest != null
              ? `${student.overallLatest}%`
              : '—'}
          </strong>
        </div>
        <div>
          <span>Subjects scored</span>
          <strong>
            {scoredSubjects.length}/{student.subjects.length}
          </strong>
        </div>
        <div>
          <span>On target</span>
          <strong>
            {onTarget}/{scoredSubjects.length || 0}
          </strong>
        </div>
        <div>
          <span>Improving</span>
          <strong>{improving}</strong>
        </div>
      </section>

      <p className="all-subjects-progress__legend">
        Progress compares Test 1 with the student’s latest written test. If the
        latest work is a resit, that sitting is shown. Target is {PASS_MARK}%+.
        {needsAttention > 0
          ? ` ${needsAttention} subject${needsAttention === 1 ? '' : 's'} below target.`
          : ''}
      </p>

      <section className="progress-report__block all-subjects-progress__block">
        <h2>Subject progress</h2>
        <div className="all-subjects-progress__table-wrap">
          <table className="all-subjects-progress__table all-subjects-progress__table--sittings">
            <thead>
              <tr>
                <th>Subject</th>
                <th>
                  Test 1
                  <small>First sitting</small>
                </th>
                <th>
                  Latest test
                  <small>Incl. resit if written</small>
                </th>
                <th>
                  Progress
                  <small>Test 1 → latest</small>
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {student.subjects.length === 0 ? (
                <tr>
                  <td colSpan={5}>No subjects configured.</td>
                </tr>
              ) : (
                student.subjects.map((subject) => {
                  const progress = resolveSubjectProgress(
                    subject,
                    assessmentLabels,
                  )
                  const tone =
                    progress == null
                      ? 'flat'
                      : progress.delta > 0
                        ? 'up'
                        : progress.delta < 0
                          ? 'down'
                          : 'flat'
                  const status =
                    subject.latest == null
                      ? 'No marks'
                      : (subject.latest as number) >= PASS_MARK
                        ? 'On target'
                        : 'Needs resit'
                  const statusTone =
                    subject.latest == null
                      ? 'empty'
                      : (subject.latest as number) >= PASS_MARK
                        ? 'pass'
                        : 'resit'
                  const firstIndex = firstMarkedIndex(subject)
                  const latestIndex = latestMarkedIndex(subject)

                  return (
                    <tr key={subject.subjectId}>
                      <td>
                        <strong>{subject.subjectName}</strong>
                        {subject.isCore ? (
                          <span className="all-subjects-progress__core">
                            Core
                          </span>
                        ) : null}
                      </td>
                      <td className="all-subjects-progress__sit-cell">
                        <SittingColumn
                          subject={subject}
                          index={firstIndex >= 0 ? firstIndex : undefined}
                        />
                      </td>
                      <td className="all-subjects-progress__sit-cell">
                        <SittingColumn
                          subject={subject}
                          index={latestIndex}
                        />
                      </td>
                      <td className="all-subjects-progress__progress-cell">
                        {progress ? (
                          <>
                            <strong className={`is-${tone}`}>
                              {formatDelta(progress.delta)}
                            </strong>
                            <small>
                              {formatScore(progress.from)} →{' '}
                              {formatScore(progress.to)}
                            </small>
                            <small className="all-subjects-progress__progress-label">
                              {progress.label}
                            </small>
                          </>
                        ) : (
                          <strong className="is-flat">—</strong>
                        )}
                      </td>
                      <td>
                        <span
                          className={`all-subjects-progress__status is-${statusTone}`}
                        >
                          {status}
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
          <span>Pass mark</span>
          <strong>{PASS_MARK}%</strong>
        </div>
      </footer>

      <p className="progress-report__footer-note">
        Official BMI multi-subject progress report · Generated for parent /
        guardian review
      </p>
    </article>
  )
}

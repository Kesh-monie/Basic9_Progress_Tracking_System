import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import schoolBadge from './assets/image/school-badge.jpg'
import { useAuth } from './auth/AuthContext.tsx'
import { useYear } from './auth/YearContext.tsx'
import StudentProgressReport from './components/StudentProgressReport.tsx'
import { PASS_MARK } from './data/overviewStats.ts'
import {
  getCachedSectionMates,
  getCachedStudentById,
  getCachedStudents,
  getCachedSubjectId,
  getCachedSubjectName,
  getCachedTestLabels,
} from './data/loadOverview.ts'
import { fetchSubjectTeacherName } from './lib/subjectTeacher.ts'
import {
  averageOf,
  formatResitsNeededStatus,
  formatScore,
  hasScore,
  resolveStudentProgress,
  studentNeedsAnyResit,
} from './lib/marks.ts'
import { printReport } from './lib/printReport.ts'
import {
  downloadReport,
  type ReportDownloadFormat,
} from './lib/reportDownload.ts'
import { supabase } from './lib/supabase.ts'
import reportCss from './components/StudentProgressReport.css?raw'
import './student_info.css'

const RING_R = 42
const RING_C = 2 * Math.PI * RING_R
const HISTORY_MAX = 100

const ringFillFromDelta = (delta: number) =>
  Math.max(0, Math.min(100, 50 + delta))

const ringOffset = (fillPercent: number) => RING_C * (1 - fillPercent / 100)

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

export default function StudentInfo() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { year } = useYear()
  const roster = getCachedStudents()
  const student = getCachedStudentById(id ?? '')
  const reportRef = useRef<HTMLElement | null>(null)
  const [showMates, setShowMates] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadFormat, setDownloadFormat] =
    useState<ReportDownloadFormat>('pdf')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [subjectName, setSubjectName] = useState(
    () => getCachedSubjectName() ?? 'Subject',
  )
  const [testLabels, setTestLabels] = useState(() => getCachedTestLabels())
  const [subjectTeacherName, setSubjectTeacherName] = useState<string | null>(
    null,
  )

  const canEditMarks =
    user?.role === 'teacher' &&
    user.subjectId != null &&
    user.canEnterMarks !== false

  useEffect(() => {
    setShowMates(false)
    setDownloadOpen(false)
    setDownloadError(null)
  }, [id])

  useEffect(() => {
    if (user?.role === 'teacher') {
      setSubjectTeacherName(user.displayName ?? user.fullName ?? null)
      return
    }
    const subjectId = getCachedSubjectId()
    if (subjectId == null) {
      setSubjectTeacherName(null)
      return
    }
    let cancelled = false
    void fetchSubjectTeacherName(subjectId).then((name) => {
      if (!cancelled) setSubjectTeacherName(name)
    })
    return () => {
      cancelled = true
    }
  }, [user?.role, user?.displayName, user?.fullName, subjectName])

  useEffect(() => {
    const cached = getCachedSubjectName()
    if (cached) setSubjectName(cached)
    const labels = getCachedTestLabels()
    if (labels.length > 0) setTestLabels(labels)

    let cancelled = false
    const loadSubject = async () => {
      if (user?.role === 'teacher' && user.subjectId != null) {
        const { data } = await supabase
          .from('subjects')
          .select('name')
          .eq('id', user.subjectId)
          .maybeSingle()
        if (!cancelled && data?.name) setSubjectName(String(data.name))
      }
      if (year?.id != null && labels.length === 0) {
        const { data } = await supabase
          .from('assessments')
          .select('name, sequence_no')
          .eq('academic_year_id', year.id)
          .order('sequence_no')
        if (!cancelled && data) {
          setTestLabels(data.map((row) => String(row.name)))
        }
      }
    }
    void loadSubject()
    return () => {
      cancelled = true
    }
  }, [user?.role, user?.subjectId, year?.id])

  if (!student) {
    return (
      <main className="student-info">
        <div className="student-info__content">
          <Link to="/overview" className="student-info__back">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Overview
          </Link>
          <div className="student-info__missing">
            <h1>Student not found</h1>
            <p>No record matches this student.</p>
          </div>
        </div>
      </main>
    )
  }

  const progress = resolveStudentProgress(student, testLabels)
  const canDelta = progress != null
  const delta = progress?.delta ?? 0
  const progressLabel = progress?.label ?? 'Test 1 → Latest'
  const canResitDelta = progress?.isResit ?? false
  const resitDelta = canResitDelta ? delta : 0
  const studentNeedsResit = studentNeedsAnyResit(student)
  const deltaClass = !canDelta
    ? 'is-flat'
    : delta > 0
      ? 'is-up'
      : delta < 0
        ? 'is-down'
        : 'is-flat'
  const ringFill = canDelta ? ringFillFromDelta(delta) : 50
  const latestLabel =
    testLabels[testLabels.length - 1] ??
    (student.scores.length > 0 ? `Test ${student.scores.length}` : 'Latest')
  const progressFrom = progress?.from ?? null
  const progressTo = progress?.to ?? null
  /** Assessment used for the resit timeline (most recent with a resit). */
  const resitAttemptIndex = [...student.attempts]
    .map((attempt, index) => ({ attempt, index }))
    .reverse()
    .find(
      ({ attempt }) =>
        attempt?.hasResit &&
        hasScore(attempt.firstSit) &&
        hasScore(attempt.bestResit),
    )?.index
  const resitAttempt =
    resitAttemptIndex != null ? student.attempts[resitAttemptIndex] : null
  const resitTestLabel =
    resitAttemptIndex != null
      ? (testLabels[resitAttemptIndex] ?? `Test ${resitAttemptIndex + 1}`)
      : latestLabel

  const ranked = [...roster]
    .filter((s) => hasScore(s.test2))
    .sort((a, b) => (b.test2 as number) - (a.test2 as number) || a.id - b.id)
  const rankIndex = ranked.findIndex((s) => s.id === student.id)
  const rank = rankIndex >= 0 ? rankIndex + 1 : 0
  const above = rankIndex > 0 ? ranked[rankIndex - 1] : null
  const below =
    rankIndex >= 0 && rankIndex < ranked.length - 1
      ? ranked[rankIndex + 1]
      : null
  const gapAbove =
    above && hasScore(above.test2) && hasScore(student.test2)
      ? above.test2 - student.test2
      : 0
  const gapBelow =
    below && hasScore(below.test2) && hasScore(student.test2)
      ? student.test2 - below.test2
      : 0

  const classAverage = averageOf(roster.map((s) => s.test2))
  const vsAverage =
    hasScore(student.test2) && classAverage != null
      ? student.test2 - classAverage
      : 0
  const vsAverageClass =
    !hasScore(student.test2) || classAverage == null
      ? 'is-flat'
      : vsAverage > 0
        ? 'is-up'
        : vsAverage < 0
          ? 'is-down'
          : 'is-flat'

  const sectionMates = getCachedSectionMates(student.section, student.id)
  const currentIndex = roster.findIndex((s) => s.id === student.id)
  const prev = currentIndex > 0 ? roster[currentIndex - 1] : null
  const next =
    currentIndex >= 0 && currentIndex < roster.length - 1
      ? roster[currentIndex + 1]
      : null

  const teacherName =
    user?.role === 'teacher'
      ? (user.displayName ?? user.fullName ?? 'Not assigned')
      : (subjectTeacherName?.trim() || 'Not assigned')
  const yearLabel = year?.label ?? 'Current year'
  const fileBase = `BMI-${subjectName.replace(/\s+/g, '-')}-${student.studentId}-${student.name.replace(/\s+/g, '-')}-progress`

  const runDownload = async () => {
    const node = reportRef.current
    const sheet = node?.parentElement
    if (!node || !sheet) {
      setDownloadError('Report is not ready.')
      return
    }
    setDownloading(true)
    setDownloadError(null)
    setDownloadOpen(false)
    sheet.classList.add('is-capturing')
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 120))
      await downloadReport(node, fileBase, downloadFormat, reportCss)
    } catch {
      setDownloadError(
        'Could not prepare the download. Try PDF format, then try again.',
      )
      setDownloadOpen(true)
    } finally {
      sheet.classList.remove('is-capturing')
      setDownloading(false)
    }
  }

  return (
    <main className="student-info">
      <div className="student-info__content">
        <div className="student-info__toolbar no-print">
          <Link to="/overview" className="student-info__back">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Overview
          </Link>
          <div className="student-info__toolbar-actions">
            <button
              type="button"
              className="student-info__tool-btn"
              onClick={() => {
                const sheet = reportRef.current?.closest(
                  '.student-info__print-sheet',
                ) as HTMLElement | null
                void printReport(0, sheet ?? reportRef.current)
              }}
            >
              Print
            </button>
            <button
              type="button"
              className="student-info__tool-btn"
              onClick={() => {
                setDownloadError(null)
                setDownloadOpen(true)
              }}
            >
              Download report
            </button>
          </div>
        </div>

        <section className="student-info__hero no-print">
          <div className="student-info__photo" aria-hidden="true">
            <img src={student.photo} alt="" />
          </div>

          <div className="student-info__hero-main">
            <div className="student-info__hero-top">
              <span className="student-info__section">{student.section}</span>
              <span className="student-info__subject-tag">{subjectName}</span>
            </div>
            <h1 className="student-info__name">{student.name}</h1>
            <p className="student-info__id">ID {student.studentId}</p>

            <div className="student-info__hero-meta">
              <div className="student-info__meta-item">
                <span>Class position</span>
                <strong>
                  {rank > 0
                    ? `${rankLabel(rank)} of ${ranked.length}`
                    : 'Unranked'}
                </strong>
                <small>
                  {rank > 0
                    ? `Among students with a recorded ${subjectName} mark`
                    : 'No recorded mark yet for ranking'}
                </small>
              </div>
              <div className="student-info__meta-item">
                <span>Latest score</span>
                <strong>{formatScore(student.test2)}</strong>
                <small>Target {PASS_MARK}%</small>
              </div>
              <div
                className={`student-info__status-pill${
                  studentNeedsResit
                    ? ' is-resit'
                    : !hasScore(student.test2)
                      ? ' is-empty'
                      : ' is-pass'
                }`}
              >
                {studentNeedsResit
                  ? formatResitsNeededStatus(student)
                  : !hasScore(student.test2)
                    ? 'No mark yet'
                    : 'Target met'}
              </div>
            </div>

            <div className="student-info__hero-actions">
              {canEditMarks ? (
                <Link
                  to={`/manage/marks?edit=1&student=${student.id}`}
                  className="student-info__action-btn"
                >
                  Edit marks
                </Link>
              ) : null}
              <button
                type="button"
                className={`student-info__action-btn is-secondary${
                  showMates ? ' is-mates-active' : ''
                }`}
                onClick={() => setShowMates((value) => !value)}
              >
                {showMates ? 'Hide section mates' : 'Section mates'}
              </button>
            </div>
          </div>

          <div
            className={`student-info__ring ${deltaClass}`}
            role="img"
            aria-label={`Progress ${formatDelta(delta)} (${progressLabel})`}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle
                className="student-info__ring-track"
                cx="50"
                cy="50"
                r={RING_R}
              />
              <circle
                className={`student-info__ring-fill ${deltaClass}`}
                cx="50"
                cy="50"
                r={RING_R}
                strokeDasharray={RING_C}
                strokeDashoffset={ringOffset(ringFill)}
              />
            </svg>
            <span className={`student-info__ring-value ${deltaClass}`}>
              {canDelta ? formatDelta(delta) : '—'}
            </span>
            <small>{canResitDelta ? 'Resit gain' : 'Progress'}</small>
          </div>
        </section>

        {showMates ? (
          <section className="student-info__mates-panel no-print">
            <h2>Other students in {student.section}</h2>
            {sectionMates.length === 0 ? (
              <p>No other students in this section.</p>
            ) : (
              <div className="student-info__mates">
                {sectionMates.map((mate) => (
                  <button
                    key={mate.id}
                    type="button"
                    className="student-info__mate"
                    onClick={() => navigate(`/student-info/${mate.id}`)}
                  >
                    <img src={mate.photo} alt="" />
                    <span>
                      <strong>{mate.name}</strong>
                      <small>
                        {formatScore(mate.test2)} · ID {mate.studentId}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="student-info__panel no-print">
          <header className="student-info__panel-head">
            <div>
              <p className="student-info__report-eyebrow">{subjectName}</p>
              <h2 className="student-info__report-title">Performance</h2>
            </div>
          </header>

          <div className="student-info__stats">
            <div className="student-info__stat">
              <span className="student-info__stat-label">Class position</span>
              <span className="student-info__stat-value">
                {rank > 0 ? rankLabel(rank) : '—'}
              </span>
              <small>
                {rank === 0
                  ? 'No mark recorded yet'
                  : `Out of ${ranked.length} students with marks`}
                {rank > 0 && above ? ` · ${gapAbove}% behind ${above.name}` : ''}
                {rank > 0 && !above ? ' · Highest score' : ''}
                {below ? ` · ${gapBelow}% ahead of ${below.name}` : ''}
              </small>
            </div>
            <div className="student-info__stat">
              <span className="student-info__stat-label">Vs class average</span>
              <span className={`student-info__stat-value ${vsAverageClass}`}>
                {hasScore(student.test2) && classAverage != null
                  ? formatDelta(vsAverage)
                  : '—'}
              </span>
              <small>
                Class average{' '}
                {classAverage != null ? `${classAverage}%` : '—'}
              </small>
            </div>
            <div className="student-info__stat">
              <span className="student-info__stat-label">{progressLabel}</span>
              <span className={`student-info__stat-value ${deltaClass}`}>
                {canDelta ? formatDelta(delta) : '—'}
              </span>
              <small>
                {canDelta
                  ? `${formatScore(progressFrom)} to ${formatScore(progressTo)}`
                  : '—'}
              </small>
            </div>
            <div className="student-info__stat">
              <span className="student-info__stat-label">Resits written</span>
              <span className="student-info__stat-value">
                {student.resitsWritten}
              </span>
              <small>This assessment cycle</small>
            </div>
          </div>
        </section>

        {studentNeedsResit ? (
          <section className="student-info__panel no-print">
            <h3 className="student-info__block-title">Resits required</h3>
            <p className="student-info__report-note">
              This student must write a resit for each test listed below.
            </p>
            <ul className="student-info__resit-tests">
              {student.resitsNeeded.map((item) => (
                <li key={item.assessmentIndex}>
                  <strong>{item.assessmentName}</strong>
                  <span>
                    {item.reason === 'did_not_write'
                      ? 'Did not write (DNW)'
                      : `Best so far ${formatScore(item.bestScore)} · below ${PASS_MARK}%`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="student-info__panel no-print">
          <h3 className="student-info__block-title">Assessment history</h3>
          <div
            className="student-info__history"
            role="img"
            aria-label="Bar chart of assessment scores"
          >
            {student.scores.length === 0 ? (
              <p>No tests created for this year yet.</p>
            ) : (
              student.scores.map((score, i) => {
                const attempt = student.attempts[i]
                return (
                  <div
                    className="student-info__history-col"
                    key={`test-${i + 1}`}
                  >
                    <span className="student-info__history-value">
                      {formatScore(score)}
                    </span>
                    <div className="student-info__history-track">
                      <div
                        className={`student-info__history-bar${
                          i === student.scores.length - 1 ? ' is-latest' : ''
                        }`}
                        style={{
                          height: `${
                            hasScore(score) ? (score / HISTORY_MAX) * 100 : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="student-info__history-label">
                      {testLabels[i] ?? `T${i + 1}`}
                    </span>
                    {attempt?.hasResit ? (
                      <small className="student-info__history-resit">
                        Sit {formatScore(attempt.firstSit)} → Resit{' '}
                        {formatScore(attempt.bestResit)}
                      </small>
                    ) : null}
                    {student.resitsNeeded.some(
                      (item) => item.assessmentIndex === i,
                    ) ? (
                      <small className="student-info__history-resit-needed">
                        Resit required
                      </small>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>

          <div className="student-info__divider" />

          {resitAttempt ? (
            <>
              <h3 className="student-info__block-title">
                {resitTestLabel}: test vs resit
              </h3>
              <p className="student-info__report-note">
                This student wrote a resit for {resitTestLabel}. Progress below
                is first sitting compared with the best resit score.
              </p>
              <div
                className="student-info__timeline"
                aria-label="Test versus resit progress"
              >
                <div className="student-info__timeline-row">
                  <span>First sit</span>
                  <div className="student-info__timeline-track">
                    <div
                      className="student-info__timeline-bar"
                      style={{
                        width: `${
                          hasScore(resitAttempt.firstSit)
                            ? resitAttempt.firstSit
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <strong>{formatScore(resitAttempt.firstSit)}</strong>
                </div>
                <div className="student-info__timeline-row">
                  <span>Resit</span>
                  <div className="student-info__timeline-track">
                    <div
                      className="student-info__timeline-bar is-latest"
                      style={{
                        width: `${
                          hasScore(resitAttempt.bestResit)
                            ? resitAttempt.bestResit
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <strong>{formatScore(resitAttempt.bestResit)}</strong>
                </div>
              </div>
              <p className={`student-info__resit-delta ${deltaClass}`}>
                {canResitDelta
                  ? `Resit change: ${formatDelta(resitDelta)}`
                  : 'Resit recorded, but first-sit score is missing.'}
              </p>
              <div className="student-info__divider" />
            </>
          ) : null}

          <h3 className="student-info__block-title">
            Assessment comparison
          </h3>
          <div className="student-info__timeline" aria-label="Score progress">
            <div className="student-info__timeline-row">
              <span>{progress?.isResit ? 'First sit' : 'Test 1'}</span>
              <div className="student-info__timeline-track">
                <div
                  className="student-info__timeline-bar"
                  style={{
                    width: `${
                      hasScore(progressFrom)
                        ? progressFrom
                        : hasScore(student.test1)
                          ? student.test1
                          : 0
                    }%`,
                  }}
                />
              </div>
              <strong>
                {formatScore(
                  progressFrom ?? student.test1,
                )}
              </strong>
            </div>
            <div className="student-info__timeline-row">
              <span>{progress?.isResit ? 'Resit / best' : 'Latest'}</span>
              <div className="student-info__timeline-track">
                <div
                  className="student-info__timeline-bar is-latest"
                  style={{
                    width: `${
                      hasScore(progressTo)
                        ? progressTo
                        : hasScore(student.test2)
                          ? student.test2
                          : 0
                    }%`,
                  }}
                />
              </div>
              <strong>
                {formatScore(progressTo ?? student.test2)}
              </strong>
            </div>
          </div>
        </section>

        <div className="student-info__nav no-print">
          {prev ? (
            <Link
              className="student-info__nav-link"
              to={`/student-info/${prev.id}`}
            >
              ← {prev.name}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              className="student-info__nav-link"
              to={`/student-info/${next.id}`}
            >
              {next.name} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="student-info__print-sheet" aria-hidden="true">
        <div className="report-print-underlay" aria-hidden="true">
          <img src={schoolBadge} alt="" />
        </div>
        <StudentProgressReport
          reportRef={reportRef}
          student={student}
          subjectName={subjectName}
          yearLabel={yearLabel}
          teacherName={teacherName}
          testLabels={testLabels}
          classAverage={classAverage}
          rank={rank}
          rankedCount={ranked.length}
        />
      </div>

      {downloadOpen ? (
        <div
          className="student-info__download-modal no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-report-title"
        >
          <div className="student-info__download-card">
            <h2 id="download-report-title">Save progress report</h2>
            <p>
              Choose the file type for this {subjectName} progress report.
            </p>
            <div className="student-info__download-options">
              {(
                [
                  ['pdf', 'PDF document'],
                  ['png', 'PNG image'],
                  ['html', 'HTML file'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="student-info__download-option">
                  <input
                    type="radio"
                    name="download-format"
                    value={value}
                    checked={downloadFormat === value}
                    onChange={() => setDownloadFormat(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {downloadError ? (
              <p className="student-info__download-error">{downloadError}</p>
            ) : null}
            <div className="student-info__download-actions">
              <button
                type="button"
                className="student-info__tool-btn is-ghost"
                onClick={() => setDownloadOpen(false)}
                disabled={downloading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="student-info__tool-btn"
                onClick={() => void runDownload()}
                disabled={downloading}
              >
                {downloading ? 'Preparing…' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

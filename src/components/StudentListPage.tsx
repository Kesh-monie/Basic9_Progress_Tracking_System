import { useState } from 'react'
import { Link } from 'react-router-dom'
import schoolBadge from '../assets/image/school-badge.jpg'
import { PASS_MARK, SECTIONS } from '../data/overviewStats.ts'
import type { LiveStudent } from '../data/loadOverview.ts'
import {
  averageOf,
  formatResitNeededItem,
  formatScore,
  hasScore,
  maxOf,
  studentNeedsAnyResit,
} from '../lib/marks.ts'
import { printReport } from '../lib/printReport.ts'
import './StudentListPage.css'

export type StudentRecord = LiveStudent

type Tone = 'blue' | 'green' | 'orange' | 'red'
type ListMode = 'total' | 'best' | 'resit'
type SortKey = 'name' | 'id' | 'score' | 'progress'
type SectionFilter = 'all' | (typeof SECTIONS)[number]
type ResitAction = 'notified' | 'scheduled' | 'written'

type StudentListPageProps = {
  title: string
  subtitle: string
  tone: Tone
  icon: string
  students: StudentRecord[]
  headlineValue: string | number
  mode: ListMode
  emptyHint?: string
}

const RING_R = 18
const RING_C = 2 * Math.PI * RING_R

const ringFillFromDelta = (delta: number) =>
  Math.max(0, Math.min(100, 50 + delta))

const ringOffset = (fill: number) => RING_C * (1 - fill / 100)

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

const priorityFor = (score: number | null) => {
  if (score == null) return { key: 'almost', label: 'Almost there' }
  const gap = PASS_MARK - score
  if (gap >= 20) return { key: 'critical', label: 'Critical' }
  if (gap >= 10) return { key: 'close', label: 'Close' }
  return { key: 'almost', label: 'Almost there' }
}

type ResitChecklist = Record<number, Partial<Record<ResitAction, boolean>>>

export default function StudentListPage({
  title,
  subtitle,
  tone,
  icon,
  students,
  headlineValue,
  mode,
  emptyHint = 'Try another filter or go back to overview.',
}: StudentListPageProps) {
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<SectionFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [checklist, setChecklist] = useState<ResitChecklist>({})

  const bestScore = maxOf(students.map((s) => s.test2)) ?? 0

  const sectionCounts = Object.fromEntries(
    SECTIONS.map((name) => [name, 0]),
  ) as Record<(typeof SECTIONS)[number], number>
  for (const s of students) {
    if (s.section in sectionCounts) {
      sectionCounts[s.section as (typeof SECTIONS)[number]] += 1
    }
  }

  const classAverage = averageOf(students.map((s) => s.test2))

  const needsResitInList = students.filter((s) => studentNeedsAnyResit(s)).length

  const q = query.trim().toLowerCase()
  let visibleStudents = [...students]

  if (mode === 'total') {
    if (section !== 'all') {
      visibleStudents = visibleStudents.filter(
        (s) => String(s.section) === section,
      )
    }
    if (q) {
      visibleStudents = visibleStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.studentId.includes(q) ||
          String(s.id).includes(q),
      )
    }

    visibleStudents.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      if (sortKey === 'score') return (b.test2 ?? -1) - (a.test2 ?? -1)
      if (sortKey === 'progress') {
        const da =
          hasScore(a.test1) && hasScore(a.test2) ? a.test2 - a.test1 : 0
        const db =
          hasScore(b.test1) && hasScore(b.test2) ? b.test2 - b.test1 : 0
        return db - da || (b.test2 ?? -1) - (a.test2 ?? -1)
      }
      return a.id - b.id
    })
  }

  const toggleAction = (studentId: number, action: ResitAction) => {
    setChecklist((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [action]: !prev[studentId]?.[action],
      },
    }))
  }

  const exportClassList = () => {
    const header = 'ID,Student ID,Name,Section,Test 1,Test 2,Progress,Resits'
    const rows = visibleStudents.map((s) => {
      const delta =
        hasScore(s.test1) && hasScore(s.test2) ? s.test2 - s.test1 : 0
      return [
        s.id,
        s.studentId,
        `"${s.name}"`,
        s.section,
        s.test1 ?? '',
        s.test2 ?? '',
        hasScore(s.test1) && hasScore(s.test2) ? formatDelta(delta) : '',
        s.resitsWritten,
      ].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'class-list.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className={`student-list-page student-list-page--${mode}`}>
      <div className="student-list-page__watermark" aria-hidden="true">
        <img src={schoolBadge} alt="" />
      </div>
      <div className="student-list-page__content">
        <div className="student-list-page__top">
          <Link to="/overview" className="student-list-page__back">
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

          <div
            className={`student-list-page__hero student-list-page__hero--${tone}`}
          >
            <div className="student-list-page__hero-text">
              <h1 className="student-list-page__title">{title}</h1>
              <p className="student-list-page__subtitle">{subtitle}</p>
              <p className="student-list-page__headline">{headlineValue}</p>
            </div>
            <img className="student-list-page__hero-icon" src={icon} alt="" />
          </div>
        </div>

        {mode === 'best' ? (
          <div className="student-list-page__celebrate">
            <strong>{students.length}</strong> student
            {students.length === 1 ? '' : 's'} hit {PASS_MARK}%+ this assessment
          </div>
        ) : null}

        {mode === 'total' ? (
          <>
            <div className="student-list-page__stats">
              {SECTIONS.map((name) => (
                <div className="student-list-page__stat" key={name}>
                  <span>{name}</span>
                  <strong>{sectionCounts[name]}</strong>
                </div>
              ))}
              <div className="student-list-page__stat">
                <span>Average</span>
                <strong>
                  {classAverage != null ? `${classAverage}%` : '—'}
                </strong>
              </div>
              <div className="student-list-page__stat">
                <span>Need resit</span>
                <strong>{needsResitInList}</strong>
              </div>
            </div>

            <div className="student-list-page__tools">
              <label className="student-list-page__search">
                <span className="visually-hidden">Search students</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by ID or name"
                  autoComplete="off"
                />
              </label>

              <label className="student-list-page__select">
                <span className="visually-hidden">Filter by section</span>
                <select
                  value={section}
                  onChange={(e) =>
                    setSection(e.target.value as SectionFilter)
                  }
                >
                  <option value="all">All sections</option>
                  {SECTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="student-list-page__select">
                <span className="visually-hidden">Sort students</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="id">Sort by ID</option>
                  <option value="name">Sort by name</option>
                  <option value="score">Sort by score</option>
                  <option value="progress">Sort by progress</option>
                </select>
              </label>

              <div className="student-list-page__actions">
                <button
                  type="button"
                  className="student-list-page__tool-btn"
                  onClick={exportClassList}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="student-list-page__tool-btn"
                  onClick={() => printReport(0)}
                >
                  Print
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="student-list-page__count">
          {visibleStudents.length === 0
            ? 'No students to show'
            : `${visibleStudents.length} student${
                visibleStudents.length === 1 ? '' : 's'
              }`}
        </div>

        {visibleStudents.length === 0 ? (
          <div className="student-list-page__empty">
            <p>Nothing matches this view.</p>
            <p>{emptyHint}</p>
            <Link to="/overview" className="student-list-page__back">
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
          </div>
        ) : (
          <ul className="student-list-page__list">
            {visibleStudents.map((student, index) => {
              const studentNeedsResit = studentNeedsAnyResit(student)
              const canDelta =
                hasScore(student.test1) && hasScore(student.test2)
              const delta = canDelta
                ? (student.test2 as number) - (student.test1 as number)
                : 0
              const deltaClass = !canDelta
                ? 'is-flat'
                : delta > 0
                  ? 'is-up'
                  : delta < 0
                    ? 'is-down'
                    : 'is-flat'
              const ringFill = canDelta ? ringFillFromDelta(delta) : 50
              const gapToBest = hasScore(student.test2)
                ? bestScore - student.test2
                : 0
              const pathLabel =
                delta > 0
                  ? 'Improved to top'
                  : delta === 0
                    ? 'Steady high score'
                    : 'Still strong after drop'
              const priority = priorityFor(student.test2)
              const pointsNeeded = hasScore(student.test2)
                ? Math.max(0, PASS_MARK - student.test2)
                : 0
              const actions = checklist[student.id] ?? {}

              return (
                <li key={student.id}>
                  <div
                    className={`student-list-page__item${
                      mode === 'best' && index < 3
                        ? ` is-rank-${index + 1}`
                        : ''
                    }${
                      mode === 'resit' ? ` is-priority-${priority.key}` : ''
                    }`}
                  >
                    <Link
                      className="student-list-page__main"
                      to={`/student-info/${student.id}`}
                    >
                      <div className="student-list-page__identity">
                        {mode === 'best' ? (
                          <span
                            className={`student-list-page__rank student-list-page__rank--${
                              index + 1
                            }`}
                          >
                            {rankLabel(index + 1)}
                          </span>
                        ) : (
                          <span
                            className="student-list-page__avatar"
                            aria-hidden="true"
                          >
                            {student.id}
                          </span>
                        )}

                        <div className="student-list-page__text">
                          <p className="student-list-page__name">
                            {student.name}
                          </p>
                          <p className="student-list-page__meta">
                            ID {student.studentId} · {student.section} · Test 1 ·{' '}
                            {formatScore(student.test1)} → Latest ·{' '}
                            {formatScore(student.test2)}
                            {canDelta ? ` · ${formatDelta(delta)}` : ''}
                            {student.absent ? ' · Absent' : ''}
                          </p>

                          {mode === 'best' ? (
                            <p className="student-list-page__extra">
                              {gapToBest === 0
                                ? 'Leading the class'
                                : `${gapToBest}% behind the top score`}{' '}
                              · {pathLabel}
                            </p>
                          ) : null}

                          {mode === 'resit' ? (
                            <div className="student-list-page__extra">
                              <p>
                                <span
                                  className={`student-list-page__priority is-${priority.key}`}
                                >
                                  {priority.label}
                                </span>
                                {' · '}
                                {student.resitsNeeded.length} test
                                {student.resitsNeeded.length === 1 ? '' : 's'}{' '}
                                need
                                {student.resitsNeeded.length === 1 ? 's' : ''} a
                                resit
                                {pointsNeeded > 0
                                  ? ` · latest needs +${pointsNeeded}% to pass`
                                  : ''}
                              </p>
                              <ul className="student-list-page__resit-tests">
                                {student.resitsNeeded.map((item) => (
                                  <li key={item.assessmentIndex}>
                                    {formatResitNeededItem(item)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="student-list-page__side">
                        <div
                          className={`student-list-page__ring ${deltaClass}`}
                          aria-hidden="true"
                        >
                          <svg viewBox="0 0 44 44">
                            <circle
                              className="student-list-page__ring-track"
                              cx="22"
                              cy="22"
                              r={RING_R}
                            />
                            <circle
                              className={`student-list-page__ring-fill ${deltaClass}`}
                              cx="22"
                              cy="22"
                              r={RING_R}
                              strokeDasharray={RING_C}
                              strokeDashoffset={ringOffset(ringFill)}
                            />
                          </svg>
                          <span className={deltaClass}>
                            {formatDelta(delta)}
                          </span>
                        </div>

                        <span className="student-list-page__score">
                          {student.test2}%
                        </span>
                        <span
                          className={`student-list-page__badge${
                            studentNeedsResit ? ' is-resit' : ' is-pass'
                          }`}
                        >
                          {studentNeedsResit
                            ? `${student.resitsNeeded.length} resit${
                                student.resitsNeeded.length === 1 ? '' : 's'
                              }`
                            : !hasScore(student.test2)
                              ? 'No mark'
                              : 'Target met'}
                        </span>
                        {mode !== 'resit' ? (
                          <span className="student-list-page__resits">
                            {student.resitsWritten}{' '}
                            {student.resitsWritten === 1
                              ? 'resit'
                              : 'resits'}{' '}
                            written
                          </span>
                        ) : null}
                      </div>
                    </Link>

                    {mode === 'resit' ? (
                      <div className="student-list-page__checklist">
                        {(
                          [
                            ['notified', 'Notified'],
                            ['scheduled', 'Scheduled'],
                            ['written', 'Written'],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key}>
                            <input
                              type="checkbox"
                              checked={Boolean(actions[key])}
                              onChange={() => toggleAction(student.id, key)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}

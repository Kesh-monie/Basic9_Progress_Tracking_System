import { useEffect, useMemo, useState } from 'react'
import logo from './assets/image/bmi_logo2.png'
import footerLogo from './assets/image/bmi_logo3.png'
import admissionImg from './assets/image/bmi_admission2.jpg'
import hoursIcon from './assets/image/hours.svg'
import locationIcon from './assets/image/location.svg'
import facebookIcon from './assets/image/facebook.svg'
import img1 from './assets/image/111.jpg'
import img2 from './assets/image/222.jpg'
import img3 from './assets/image/333.jpg'
import img4 from './assets/image/444.jpg'
import img5 from './assets/image/555.jpg'
import img6 from './assets/image/666.jpg'
import {
  loadHomeStats,
  type HomeBecePoint,
  type HomeProgressPoint,
  type HomeQuickStat,
  type HomeSubjectPoint,
} from './data/loadHomeStats.ts'
import { sortSubjectDisplay } from './lib/subjects.ts'
import './home.css'

const slides = [img1, img2, img3, img4, img5, img6]

const Y_MIN = 40
const Y_MAX = 80
const yTicks = [40, 50, 60, 70, 80]
const toY = (value: number) => ((Y_MAX - value) / (Y_MAX - Y_MIN)) * 100

export default function Home() {
  const [quickStats, setQuickStats] = useState<HomeQuickStat[]>([])
  const [beceResults, setBeceResults] = useState<HomeBecePoint[]>([])
  const [classProgress, setClassProgress] = useState<HomeProgressPoint[]>([])
  const [subjectAverages, setSubjectAverages] = useState<HomeSubjectPoint[]>(
    [],
  )

  useEffect(() => {
    void loadHomeStats().then((bundle) => {
      setQuickStats(bundle.quickStats)
      setBeceResults(bundle.beceResults)
      setClassProgress(bundle.classProgress)
      setSubjectAverages(bundle.subjectAverages)
    })
  }, [])

  const firstResult = beceResults[0]
  const lastResult = beceResults[beceResults.length - 1]
  const improvement =
    firstResult && lastResult
      ? lastResult.passRate - firstResult.passRate
      : 0

  const chart = useMemo(() => {
    if (classProgress.length === 0) {
      return {
        progressPoints: [] as Array<
          HomeProgressPoint & { x: number; y: number }
        >,
        linePoints: '',
        firstPoint: undefined as
          | (HomeProgressPoint & { x: number; y: number })
          | undefined,
        lastPoint: undefined as
          | (HomeProgressPoint & { x: number; y: number })
          | undefined,
        areaPoints: '',
        classGain: 0,
      }
    }
    const n = Math.max(classProgress.length, 2)
    const toX = (i: number) => 8 + (i * 84) / (n - 1)
    const progressPoints = classProgress.map((p, i) => ({
      ...p,
      x: toX(i),
      y: toY(Math.min(Y_MAX, Math.max(Y_MIN, p.average))),
    }))
    const linePoints = progressPoints.map((p) => `${p.x},${p.y}`).join(' ')
    const firstPoint = progressPoints[0]
    const lastPoint = progressPoints[progressPoints.length - 1]
    const areaPoints = firstPoint
      ? `${firstPoint.x},100 ${linePoints} ${lastPoint.x},100`
      : ''
    const classGain = firstPoint && lastPoint
      ? lastPoint.average - firstPoint.average
      : 0
    return { progressPoints, linePoints, firstPoint, lastPoint, areaPoints, classGain }
  }, [classProgress])

  const orderedSubjects = sortSubjectDisplay(subjectAverages)
  const topAverage =
    orderedSubjects.length > 0
      ? Math.max(...orderedSubjects.map((s) => s.average))
      : 0
  const lowAverage =
    orderedSubjects.length > 0
      ? Math.min(...orderedSubjects.map((s) => s.average))
      : 0

  return (
    <main className="home">
      <section className="hero">
        <div className="hero__intro">
          <img
            className="hero__logo"
            src={logo}
            alt="Bediako Memorial Institute"
          />
          <h1 className="hero__tagline">
            The school of <span>“Excellence”</span> and{' '}
            <span>“Integrity”</span>
          </h1>
          <p className="hero__message">
            At Bediako Memorial Institute, every student is nurtured to grow in
            knowledge, skills and values. We build confident, disciplined
            learners who lead with honesty and strive for the very best in all
            they do.
          </p>
        </div>

        <div className="hero__slider">
          <div className="hero__track">
            {[...slides, ...slides].map((src, i) => (
              <div
                className="hero__slide"
                key={i}
                aria-hidden={i >= slides.length}
              >
                <img src={src} alt="" draggable={false} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section__title">JHS3 at a Glance</h2>
        <div className="stats">
          {quickStats.length === 0 ? (
            <p className="chart-card__subtitle">Loading school figures…</p>
          ) : (
            quickStats.map((stat) => (
              <div className="stats__card" key={stat.label}>
                <span className="stats__value">{stat.value}</span>
                <span className="stats__label">{stat.label}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="home-section">
        <div className="chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="home-section__title">
                BECE Results Improve Every Year
              </h2>
              <p className="chart-card__subtitle">
                Percentage of JHS3 students who passed the BECE
              </p>
            </div>
            {firstResult && beceResults.length > 1 ? (
              <span className="chart-card__badge">
                {improvement >= 0 ? '+' : ''}
                {improvement}% since {firstResult.year}
              </span>
            ) : null}
          </div>

          <div className="bar-chart">
            {beceResults.length === 0 ? (
              <p className="chart-card__subtitle">
                No BECE figures saved yet. A supervisor can add them under BECE
                results.
              </p>
            ) : (
              beceResults.map((result, i) => (
                <div className="bar-chart__col" key={result.year}>
                  <span className="bar-chart__value">{result.passRate}%</span>
                  <div className="bar-chart__track">
                    <div
                      className={`bar-chart__bar${
                        i === beceResults.length - 1 ? ' is-latest' : ''
                      }`}
                      style={{
                        height: `${result.passRate}%`,
                        animationDelay: `${i * 0.12}s`,
                      }}
                    />
                  </div>
                  <span className="bar-chart__year">{result.year}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="home-section home-section--grid">
        <div className="chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="home-section__title">JHS3 Class Progress</h2>
              <p className="chart-card__subtitle">
                Class average (%) by test · active academic year
              </p>
            </div>
            {chart.firstPoint ? (
              <span className="chart-card__badge">
                {chart.classGain >= 0 ? '+' : ''}
                {chart.classGain}% since {chart.firstPoint.label}
              </span>
            ) : null}
          </div>

          {classProgress.length === 0 ? (
            <p className="chart-card__subtitle">
              No test marks recorded yet for the active year.
            </p>
          ) : (
            <div className="line-chart">
              <div className="line-chart__plot">
                {yTicks.map((tick) => (
                  <div
                    className="line-chart__grid"
                    key={tick}
                    style={{ top: `${toY(tick)}%` }}
                  >
                    <span>{tick}</span>
                  </div>
                ))}
                <svg
                  className="line-chart__svg"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="progress-fill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#00dbff"
                        stopOpacity="0.35"
                      />
                      <stop
                        offset="100%"
                        stopColor="#00dbff"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  {chart.areaPoints ? (
                    <polygon
                      points={chart.areaPoints}
                      fill="url(#progress-fill)"
                    />
                  ) : null}
                  {chart.linePoints ? (
                    <polyline
                      points={chart.linePoints}
                      fill="none"
                      stroke="#1e0058"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </svg>
                {chart.progressPoints.map((p) => (
                  <div
                    className="line-chart__point"
                    key={p.label}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  >
                    <span className="line-chart__value">{p.average}%</span>
                  </div>
                ))}
              </div>
              <div className="line-chart__labels">
                {chart.progressPoints.map((p) => (
                  <span key={p.label} style={{ left: `${p.x}%` }}>
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="home-section__title">Subject Performance</h2>
              <p className="chart-card__subtitle">
                JHS3 class average (%) per subject · active year
              </p>
            </div>
          </div>

          {orderedSubjects.length === 0 ? (
            <p className="chart-card__subtitle">
              No subject marks recorded yet for the active year.
            </p>
          ) : (
          <ul className="subject-chart">
            {orderedSubjects.map((s, i) => {
              const tone =
                s.average === topAverage && orderedSubjects.length > 1
                  ? ' is-top'
                  : s.average === lowAverage && orderedSubjects.length > 1
                    ? ' is-low'
                    : ''
              return (
                <li className="subject-chart__row" key={s.subject}>
                  <span className="subject-chart__name">{s.subject}</span>
                  <div className="subject-chart__track">
                    <div
                      className={`subject-chart__bar${tone}`}
                      style={{
                        width: `${Math.max(0, Math.min(100, s.average))}%`,
                        animationDelay: `${i * 0.08}s`,
                      }}
                    />
                  </div>
                  <span className="subject-chart__value">{s.average}%</span>
                </li>
              )
            })}
          </ul>
          )}

          <div className="subject-chart__legend">
            <span>
              <i className="is-top" /> Strongest subject
            </span>
            <span>
              <i className="is-low" /> Needs more attention
            </span>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer__inner">
          <div className="home-footer__about">
            <img
              className="home-footer__logo"
              src={footerLogo}
              alt="Bediako Memorial Institute"
            />
            <p className="home-footer__text">
              Embark on a thrilling educational voyage with BMI, a vibrant
              school offering a spectrum of learning from kindergarten to junior
              high, at BMI, education is not just a journey, it is an
              exhilarating adventure waiting to be explored.
            </p>
            <div className="home-footer__meta">
              <div className="home-footer__meta-item">
                <img src={hoursIcon} alt="" />
                <div>
                  <span className="home-footer__meta-label">Opening Hours</span>
                  <span>Monday - Friday</span>
                  <span>7:30 am - 4:00 pm</span>
                </div>
              </div>
              <div className="home-footer__meta-item">
                <img src={locationIcon} alt="" />
                <div>
                  <span className="home-footer__meta-label">Location</span>
                  <span>Windy Hills, Kasoa CP</span>
                </div>
              </div>
              <a
                className="home-footer__meta-item home-footer__social"
                href="https://web.facebook.com/people/Bediako-Memorial-Institute/100084450854855/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={facebookIcon} alt="" />
                <div>
                  <span className="home-footer__meta-label">Follow Us</span>
                  <span>Facebook</span>
                </div>
              </a>
            </div>
          </div>
          <div className="home-footer__admission">
            <img
              src={admissionImg}
              alt="BMI admission in progress — Preschool to JHS 2"
            />
          </div>
        </div>
        <div className="home-footer__credit">
          <a
            href="https://bmi.edu.gh"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bediako Memorial Institute
          </a>
        </div>
      </footer>
    </main>
  )
}

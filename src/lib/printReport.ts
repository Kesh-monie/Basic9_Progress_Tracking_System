import schoolBadge from '../assets/image/school-badge.jpg'
import { prepareReportImages } from './reportImages.ts'
import './printUnderlay.css'

const UNDERLAY_CLASS = 'report-print-underlay-live'

/**
 * Print with a body-level fixed badge on every page (including page 1).
 * Watermarks inside the report tree are unreliable across page breaks in Chrome.
 * Pass the print-sheet root so student photos are inlined before printing.
 */
export async function printReport(
  delayMs = 50,
  reportRoot?: HTMLElement | null,
) {
  if (reportRoot) {
    await prepareReportImages(reportRoot)
  }

  const previousTitle = document.title
  // Browser "Save as PDF" uses document.title as the default filename.
  document.title = 'BMI'

  document.querySelectorAll(`.${UNDERLAY_CLASS}`).forEach((node) => node.remove())

  const underlay = document.createElement('div')
  underlay.className = UNDERLAY_CLASS
  underlay.setAttribute('aria-hidden', 'true')
  const img = document.createElement('img')
  img.src = schoolBadge
  img.alt = ''
  underlay.appendChild(img)
  document.body.appendChild(underlay)

  const restore = () => {
    document.title = previousTitle
    underlay.remove()
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)

  window.setTimeout(() => {
    window.print()
    window.setTimeout(restore, 1500)
  }, delayMs)
}

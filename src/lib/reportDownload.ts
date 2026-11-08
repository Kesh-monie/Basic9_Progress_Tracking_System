import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import schoolBadge from '../assets/image/school-badge.jpg'
import { prepareReportImages } from './reportImages.ts'

export type ReportDownloadFormat = 'pdf' | 'png' | 'html'

type CaptureOptions = {
  /** Hide DOM watermarks (PDF stamps its own badge on every page). */
  hideWatermarks?: boolean
  scale?: number
}

const MAX_CANVAS_EDGE = 8192

let badgeDataUrlPromise: Promise<string | null> | null = null

async function getBadgeDataUrl() {
  if (!badgeDataUrlPromise) {
    badgeDataUrlPromise = (async () => {
      try {
        const response = await fetch(schoolBadge)
        if (!response.ok) return null
        const blob = await response.blob()
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })
      } catch {
        return null
      }
    })()
  }
  return badgeDataUrlPromise
}

/** Draw the school badge as a visible overlay on the current PDF page. */
export function stampBadgeOverlay(pdf: jsPDF, badgeDataUrl: string) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const size = Math.min(pageWidth, pageHeight) * 0.5
  const x = (pageWidth - size) / 2
  const y = (pageHeight - size) / 2

  pdf.saveGraphicsState()
  pdf.setGState(pdf.GState({ opacity: 0.16 }))
  pdf.addImage(badgeDataUrl, 'JPEG', x, y, size, size)
  pdf.restoreGraphicsState()
}

/** Stamp the school badge on every page of an already-built PDF. */
export async function stampSchoolBadgeOnEveryPage(pdf: jsPDF) {
  const badgeDataUrl = await getBadgeDataUrl()
  if (!badgeDataUrl) return
  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    stampBadgeOverlay(pdf, badgeDataUrl)
  }
}

async function waitForLayout() {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* ignore */
    }
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
  await new Promise((resolve) => window.setTimeout(resolve, 50))
}

function reportPages(root: HTMLElement): HTMLElement[] {
  if (root.classList.contains('progress-report')) return [root]
  const children = [
    ...root.querySelectorAll<HTMLElement>(':scope > .progress-report'),
  ]
  return children.length > 0 ? children : [root]
}

function forceReportPaintStyles(clonedRoot: HTMLElement) {
  clonedRoot.querySelectorAll('.progress-report').forEach((report) => {
    const el = report as HTMLElement
    el.style.background = '#fffef9'
    el.style.color = '#1a1240'
    el.style.boxShadow = 'none'
    el.style.transform = 'none'
    el.style.filter = 'none'
    el.style.backdropFilter = 'none'
    el.style.setProperty('-webkit-print-color-adjust', 'exact')
    el.style.setProperty('print-color-adjust', 'exact')
    el.style.overflow = 'visible'
    el.style.opacity = '1'
    el.style.visibility = 'visible'
  })

  clonedRoot.querySelectorAll('.progress-report *').forEach((node) => {
    const el = node as HTMLElement
    if (!el.style) return
    el.style.filter = 'none'
    el.style.backdropFilter = 'none'
  })
}

export async function captureNode(
  node: HTMLElement,
  options: CaptureOptions = {},
) {
  await prepareReportImages(node)
  await waitForLayout()

  const rect = node.getBoundingClientRect()
  const width = Math.max(node.scrollWidth, Math.ceil(rect.width), 1)
  const height = Math.max(node.scrollHeight, Math.ceil(rect.height), 1)
  if (width < 2 || height < 2) {
    throw new Error('Report layout is empty. Try again.')
  }

  const scale = options.scale ?? (height * 2 > MAX_CANVAS_EDGE ? 1.25 : 2)

  const canvas = await html2canvas(node, {
    scale,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#fffef9',
    logging: false,
    imageTimeout: 15000,
    onclone: (_document, cloned) => {
      forceReportPaintStyles(cloned)

      if (options.hideWatermarks) {
        cloned
          .querySelectorAll(
            '.progress-report__watermark, .report-print-underlay, .report-print-underlay-live',
          )
          .forEach((mark) => {
            ;(mark as HTMLElement).style.display = 'none'
          })
        return
      }

      cloned
        .querySelectorAll('.progress-report__watermark img')
        .forEach((img) => {
          const el = img as HTMLElement
          el.style.opacity = '0.14'
          el.style.visibility = 'visible'
          el.style.display = 'block'
        })
      cloned
        .querySelectorAll('.progress-report__watermark')
        .forEach((mark) => {
          const el = mark as HTMLElement
          el.style.display = 'grid'
          el.style.opacity = '1'
          el.style.visibility = 'visible'
        })
    },
  })

  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('Could not capture the report image.')
  }

  return canvas
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadHtmlReport(
  node: HTMLElement,
  filename: string,
  cssText: string,
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${filename}</title>
  <style>
    body { margin: 0; background: #f1f6fe; }
    .wrap { padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
    ${cssText}
  </style>
</head>
<body>
  <div class="wrap">${node.outerHTML}</div>
</body>
</html>`
  downloadBlob(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    `${filename}.html`,
  )
}

export async function downloadPngReport(node: HTMLElement, filename: string) {
  const pages = reportPages(node)
  // Multi-page PNG is unreliable online — use PDF instead.
  if (pages.length > 1) {
    await downloadPdfReport(node, filename)
    return
  }
  const canvas = await captureNode(pages[0])
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `${filename}.png`
  link.click()
}

export async function downloadPdfReport(node: HTMLElement, filename: string) {
  const pages = reportPages(node)
  const badgeDataUrl = await getBadgeDataUrl()
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  pdf.setProperties({
    title: filename,
    subject: 'BMI Progress System report',
    creator: 'BMI Progress System',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  for (let i = 0; i < pages.length; i += 1) {
    const canvas = await captureNode(pages[i], {
      hideWatermarks: true,
      scale: 1.75,
    })
    const img = canvas.toDataURL('image/jpeg', 0.92)
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    if (i > 0) pdf.addPage()

    // One A4 page per report sheet when it roughly fits; otherwise slice.
    if (imgHeight <= pageHeight + 0.8) {
      pdf.addImage(img, 'JPEG', 0, 0, imgWidth, imgHeight)
      if (badgeDataUrl) stampBadgeOverlay(pdf, badgeDataUrl)
      continue
    }

    const pageCount = Math.max(1, Math.ceil(imgHeight / pageHeight - 0.001))
    for (let page = 0; page < pageCount; page += 1) {
      if (page > 0) pdf.addPage()
      const position = -page * pageHeight
      pdf.addImage(img, 'JPEG', 0, position, imgWidth, imgHeight)
      if (badgeDataUrl) stampBadgeOverlay(pdf, badgeDataUrl)
    }
  }

  pdf.save(`${filename}.pdf`)
}

export async function downloadReport(
  node: HTMLElement,
  filename: string,
  format: ReportDownloadFormat,
  cssText = '',
) {
  if (format === 'html') {
    await prepareReportImages(node)
    downloadHtmlReport(node, filename, cssText)
    return
  }
  if (format === 'png') {
    await downloadPngReport(node, filename)
    return
  }
  await downloadPdfReport(node, filename)
}

import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import schoolBadge from '../assets/image/school-badge.jpg'
import { prepareReportImages } from './reportImages.ts'

export type ReportDownloadFormat = 'pdf' | 'png' | 'html'

type CaptureOptions = {
  /** Hide DOM watermarks (PDF stamps its own badge on every page). */
  hideWatermarks?: boolean
}

let badgeDataUrlPromise: Promise<string> | null = null

async function getBadgeDataUrl() {
  if (!badgeDataUrlPromise) {
    badgeDataUrlPromise = (async () => {
      const response = await fetch(schoolBadge)
      const blob = await response.blob()
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
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
  // On top of content so page 1 (dense letterhead) still shows the stamp.
  pdf.setGState(pdf.GState({ opacity: 0.16 }))
  pdf.addImage(badgeDataUrl, 'JPEG', x, y, size, size)
  pdf.restoreGraphicsState()
}

/** Stamp the school badge on every page of an already-built PDF. */
export async function stampSchoolBadgeOnEveryPage(pdf: jsPDF) {
  const badgeDataUrl = await getBadgeDataUrl()
  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    stampBadgeOverlay(pdf, badgeDataUrl)
  }
}

export async function captureNode(
  node: HTMLElement,
  options: CaptureOptions = {},
) {
  await prepareReportImages(node)
  return html2canvas(node, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#fffef9',
    logging: false,
    onclone: (_document, cloned) => {
      cloned.querySelectorAll('.progress-report').forEach((report) => {
        const el = report as HTMLElement
        el.style.background = '#fffef9'
        el.style.setProperty('-webkit-print-color-adjust', 'exact')
        el.style.setProperty('print-color-adjust', 'exact')
        el.style.overflow = 'visible'
      })

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
    .wrap { padding: 24px; display: flex; justify-content: center; }
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
  const canvas = await captureNode(node)
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `${filename}.png`
  link.click()
}

export async function downloadPdfReport(node: HTMLElement, filename: string) {
  const [canvas, badgeDataUrl] = await Promise.all([
    captureNode(node, { hideWatermarks: true }),
    getBadgeDataUrl(),
  ])
  const img = canvas.toDataURL('image/jpeg', 0.92)
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
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  const pageCount = Math.max(1, Math.ceil(imgHeight / pageHeight - 0.001))

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) pdf.addPage()
    const position = -page * pageHeight
    pdf.addImage(img, 'JPEG', 0, position, imgWidth, imgHeight)
    // Overlay after content so dense page 1 still shows the badge.
    stampBadgeOverlay(pdf, badgeDataUrl)
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
    downloadHtmlReport(node, filename, cssText)
    return
  }
  if (format === 'png') {
    await downloadPngReport(node, filename)
    return
  }
  await downloadPdfReport(node, filename)
}

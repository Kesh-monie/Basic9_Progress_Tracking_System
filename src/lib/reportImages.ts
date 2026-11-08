import { STUDENT_PHOTO_BUCKET } from './studentPhoto.ts'
import { supabase } from './supabase.ts'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function storagePathFromPublicUrl(src: string): string | null {
  const marker = `/storage/v1/object/public/${STUDENT_PHOTO_BUCKET}/`
  const index = src.indexOf(marker)
  if (index < 0) return null
  return decodeURIComponent(src.slice(index + marker.length).split('?')[0])
}

async function srcToDataUrl(src: string): Promise<string | null> {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src || null

  const storagePath = storagePathFromPublicUrl(src)
  if (storagePath) {
    const { data, error } = await supabase.storage
      .from(STUDENT_PHOTO_BUCKET)
      .download(storagePath)
    if (!error && data) return await blobToDataUrl(data)
  }

  try {
    const response = await fetch(src, { mode: 'cors' })
    if (!response.ok) return null
    return await blobToDataUrl(await response.blob())
  } catch {
    return null
  }
}

/**
 * Convert report <img> sources to data URLs so print + html2canvas keep
 * student photos (especially Supabase storage URLs) visible.
 */
export async function prepareReportImages(root: HTMLElement) {
  const images = [...root.querySelectorAll('img')]
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) return
      const dataUrl = await srcToDataUrl(src)
      if (!dataUrl) return
      img.removeAttribute('crossorigin')
      img.src = dataUrl
      try {
        await img.decode()
      } catch {
        /* ignore decode errors; browser may still paint */
      }
    }),
  )
}

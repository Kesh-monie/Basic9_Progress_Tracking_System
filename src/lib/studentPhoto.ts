import passportFemale from '../assets/image/passport-female.svg'
import passportMale from '../assets/image/passport-male.svg'
import { friendlyError } from './friendlyError.ts'
import type { Gender } from './person.ts'
import { supabase } from './supabase.ts'

export const STUDENT_PHOTO_BUCKET = 'student-photos'
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function defaultPassportPhoto(gender: Gender | null | undefined): string {
  return gender === 'female' ? passportFemale : passportMale
}

export function resolveStudentPhoto(
  photoUrl: string | null | undefined,
  gender: Gender | null | undefined,
): string {
  const url = photoUrl?.trim()
  if (url) return url
  return defaultPassportPhoto(gender)
}

export function validateStudentPhoto(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return 'Photo must be JPG, PNG, or WebP.'
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Photo must be 2 MB or smaller.'
  }
  return null
}

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

/** Upload a passport photo; returns public URL or throws with message. */
export async function uploadStudentPhoto(
  file: File,
  identityCode: string,
): Promise<string> {
  const validation = validateStudentPhoto(file)
  if (validation) throw new Error(validation)

  const code = identityCode.trim() || 'unknown'
  const path = `${code}/${Date.now()}.${extensionFor(file)}`

  const { error } = await supabase.storage
    .from(STUDENT_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })

  if (error) {
    const message = friendlyError(
      error,
      'Could not upload the photo. Please try again.',
    )
    // Storage RLS often returns a generic status; keep the hint explicit.
    if (message === 'Access was blocked by the database.') {
      throw new Error(
        'Photo upload was blocked. Create the student-photos storage bucket and allow uploads (SQL in chat).',
      )
    }
    throw new Error(message)
  }

  const { data } = supabase.storage.from(STUDENT_PHOTO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

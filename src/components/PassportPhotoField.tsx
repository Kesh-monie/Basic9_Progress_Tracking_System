import { useEffect, useId, useRef, useState } from 'react'
import type { Gender } from '../lib/person.ts'
import { defaultPassportPhoto } from '../lib/studentPhoto.ts'

type PassportPhotoFieldProps = {
  gender: Gender | ''
  /** Existing saved URL (edit mode) */
  savedUrl?: string | null
  file: File | null
  onFileChange: (file: File | null) => void
  clearSaved?: boolean
  onClearSaved?: () => void
  label?: string
  compact?: boolean
}

export default function PassportPhotoField({
  gender,
  savedUrl,
  file,
  onFileChange,
  clearSaved = false,
  onClearSaved,
  label = 'Passport photo (optional)',
  compact = false,
}: PassportPhotoFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const placeholder = defaultPassportPhoto(gender || 'male')
  const shown =
    preview ??
    (!clearSaved && savedUrl?.trim() ? savedUrl : null) ??
    placeholder

  const clear = () => {
    onFileChange(null)
    if (inputRef.current) inputRef.current.value = ''
    onClearSaved?.()
  }

  return (
    <div className={`passport-field${compact ? ' passport-field--compact' : ''}`}>
      {!compact ? <span className="passport-field__label">{label}</span> : null}
      <div className="passport-field__row">
        <label className="passport-frame" htmlFor={inputId} title="Upload passport photo">
          <img src={shown} alt="" className="passport-frame__img" />
          <span className="passport-frame__hint">
            {file || (savedUrl && !clearSaved) ? 'Change' : 'Upload'}
          </span>
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="passport-field__input"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null
            onFileChange(next)
          }}
        />
        <div className="passport-field__meta">
          {compact ? null : (
            <p className="manage-page__lead" style={{ margin: 0 }}>
              Passport size · JPG/PNG/WebP · max 2 MB. Optional — gender
              silhouette used if empty.
            </p>
          )}
          {(file || (savedUrl && !clearSaved)) && (
            <button type="button" className="btn-ghost" onClick={clear}>
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

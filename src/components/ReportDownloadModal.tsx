import type { ReportDownloadFormat } from '../lib/reportDownload.ts'

export type ReportSectionOption = {
  value: string
  label: string
}

export type ReportAssessmentOption = {
  value: string
  label: string
}

type Props = {
  title: string
  description: string
  format: ReportDownloadFormat
  onFormatChange: (format: ReportDownloadFormat) => void
  onCancel: () => void
  onConfirm: () => void
  downloading: boolean
  error: string | null
  confirmLabel?: string
  showFormat?: boolean
  sectionOptions?: ReportSectionOption[]
  section?: string
  onSectionChange?: (section: string) => void
  assessmentOptions?: ReportAssessmentOption[]
  assessment?: string
  onAssessmentChange?: (assessment: string) => void
}

export default function ReportDownloadModal({
  title,
  description,
  format,
  onFormatChange,
  onCancel,
  onConfirm,
  downloading,
  error,
  confirmLabel = 'Download',
  showFormat = true,
  sectionOptions,
  section,
  onSectionChange,
  assessmentOptions,
  assessment,
  onAssessmentChange,
}: Props) {
  return (
    <div
      className="report-download-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-download-title"
    >
      <div className="report-download-modal__card">
        <h2 id="report-download-title">{title}</h2>
        <p>{description}</p>

        {assessmentOptions && assessment != null && onAssessmentChange ? (
          <div className="report-download-modal__section">
            <span className="report-download-modal__label">Test / assessment</span>
            <div className="report-download-modal__options">
              {assessmentOptions.map((option) => (
                <label
                  key={option.value}
                  className="report-download-modal__option"
                >
                  <input
                    type="radio"
                    name="report-assessment"
                    value={option.value}
                    checked={assessment === option.value}
                    onChange={() => onAssessmentChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {sectionOptions && section != null && onSectionChange ? (
          <div className="report-download-modal__section">
            <span className="report-download-modal__label">Section</span>
            <div className="report-download-modal__options">
              {sectionOptions.map((option) => (
                <label
                  key={option.value}
                  className="report-download-modal__option"
                >
                  <input
                    type="radio"
                    name="report-section"
                    value={option.value}
                    checked={section === option.value}
                    onChange={() => onSectionChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {showFormat ? (
          <div className="report-download-modal__section">
            <span className="report-download-modal__label">File type</span>
            <div className="report-download-modal__options">
              {(
                [
                  ['pdf', 'PDF document'],
                  ['png', 'PNG image'],
                  ['html', 'HTML file'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="report-download-modal__option">
                  <input
                    type="radio"
                    name="report-download-format"
                    value={value}
                    checked={format === value}
                    onChange={() => onFormatChange(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="report-download-modal__error">{error}</p> : null}
        <div className="report-download-modal__actions">
          <button
            type="button"
            className="report-download-modal__btn is-ghost"
            onClick={onCancel}
            disabled={downloading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="report-download-modal__btn"
            onClick={onConfirm}
            disabled={
              downloading ||
              (assessmentOptions != null &&
                assessmentOptions.length === 0)
            }
          >
            {downloading ? 'Preparing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

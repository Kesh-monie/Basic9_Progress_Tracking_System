/** Escape a value for CSV (Excel / Google Sheets friendly). */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function rowsToCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csvText: string) {
  // BOM helps Excel open UTF-8 correctly (names with accents, etc.).
  const blob = new Blob([`\uFEFF${csvText}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

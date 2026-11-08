/** Turn Supabase / Postgres errors into short user-facing messages. */
export function friendlyError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error
          ? err.message
          : ''

  const text = raw.trim()
  if (!text) return fallback

  const lower = text.toLowerCase()

  if (
    lower.includes('academic_year_id') &&
    (lower.includes('schema cache') || lower.includes('column'))
  ) {
    return 'Student year link is missing in the database.'
  }

  if (
    lower.includes('photo_url') &&
    (lower.includes('schema cache') || lower.includes('column'))
  ) {
    return 'Photo column is missing in the database.'
  }

  if (
    lower.includes('assessment_sittings') ||
    ((lower.includes('status') ||
      lower.includes('attempt_no') ||
      lower.includes('did_not_write')) &&
      (lower.includes('schema cache') ||
        lower.includes('column') ||
        lower.includes('could not find') ||
        lower.includes('does not exist')))
  ) {
    return 'Marks tables need a database update.'
  }

  if (
    lower.includes('bucket') ||
    (lower.includes('storage') && lower.includes('not found'))
  ) {
    return 'Photo storage is not set up yet.'
  }

  if (
    (lower.includes('storage') ||
      lower.includes('object') ||
      lower.includes('bucket')) &&
    (lower.includes('row-level security') ||
      lower.includes('rls') ||
      lower.includes('not authorized') ||
      lower.includes('permission') ||
      lower.includes('policy'))
  ) {
    return 'Photo upload was blocked. Create the student-photos storage bucket and allow uploads (SQL in chat).'
  }

  if (
    lower.includes('duplicate') ||
    lower.includes('unique') ||
    lower.includes('already exists')
  ) {
    return 'That ID is already in use. Choose a different one.'
  }

  if (
    lower.includes('foreign key') ||
    lower.includes('violates foreign key')
  ) {
    return 'Linked data is missing or invalid. Check the academic year and try again.'
  }

  if (
    lower.includes('null value') ||
    lower.includes('not-null') ||
    lower.includes('not null')
  ) {
    return 'A required field is missing. Check the form and try again.'
  }

  if (
    lower.includes('permission') ||
    lower.includes('row-level security') ||
    lower.includes('rls') ||
    lower.includes('jwt') ||
    lower.includes('not authorized') ||
    lower.includes('unauthorized') ||
    lower.includes('403')
  ) {
    return 'Access was blocked by the database.'
  }

  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network problem. Check your connection and try again.'
  }

  if (
    lower.includes('schema cache') ||
    lower.includes('could not find') ||
    lower.includes('does not exist') ||
    lower.includes('undefined column') ||
    lower.includes('pgrst') ||
    lower.includes('postgres') ||
    lower.includes('violates') ||
    lower.includes('syntax error') ||
    /column ['"`]?\w+['"`]?\s+of/i.test(text) ||
    /relation ['"`]?\w+/i.test(text)
  ) {
    return 'The database needs an update.'
  }

  // Already a short, human message (validation etc.)
  if (
    text.length <= 120 &&
    !/[_{}]/.test(text) &&
    !lower.includes('select ') &&
    !lower.includes('insert ')
  ) {
    return text
  }

  return fallback
}

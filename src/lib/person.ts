export type Gender = 'male' | 'female'

export function titleForGender(gender: Gender | string | null | undefined) {
  if (gender === 'male') return 'Mr'
  if (gender === 'female') return 'Miss'
  return null
}

/** Display name with Mr / Miss when gender is known. */
export function displayName(
  fullName: string,
  gender?: Gender | string | null,
) {
  const name = fullName.trim()
  const title = titleForGender(gender)
  if (!title || !name) return name
  // Avoid double-prefix if already stored with a title
  if (/^(mr|miss|mrs|ms)\b/i.test(name)) return name
  return `${title} ${name}`
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored) return false
  if (stored === password) return true
  const hashed = await hashPassword(password)
  if (stored === hashed) return true
  // Default seed placeholder from SQL install
  if (stored === 'change_this_password_hash' && password === 'admin123') {
    return true
  }
  return false
}

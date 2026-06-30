/**
 * Privacy utility functions
 * Used to mask personal data displayed in public-facing pages and QR codes.
 * Admin dashboards should NOT use these -- admins see full data.
 */

/**
 * Masks a full name.
 * - First name is shown in full.
 * - Subsequent words (last names) show only the first 2-3 chars + "***".
 *
 * Examples:
 *   maskName("Nelson Marin Garcia") => "Nelson Ma*** Ga***"
 *   maskName("Ana Lopez")           => "Ana Lo***"
 *   maskName("Juan")                => "Juan"
 */
export function maskName(fullName: string): string {
  if (!fullName) return "N/A"
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return parts[0]

  const [firstName, ...lastNames] = parts
  const maskedLast = lastNames.map((part) => {
    const keep = Math.min(3, Math.max(2, Math.floor(part.length / 2)))
    return part.slice(0, keep) + "***"
  })
  return [firstName, ...maskedLast].join(" ")
}

/**
 * Masks an email address.
 * - Local part: first 2 chars visible, rest replaced with "***".
 * - Domain: first 2 chars visible, rest replaced with "***".
 *
 * Examples:
 *   maskEmail("nelson@gmail.com")  => "ne***@gm***.com"
 *   maskEmail("a@b.co")            => "a***@b***.co"
 */
export function maskEmail(email: string): string {
  if (!email) return "N/A"
  const [local, domain] = email.split("@")
  if (!domain) return email

  const localMasked = local.slice(0, Math.min(2, local.length)) + "***"

  const domainParts = domain.split(".")
  const tld = domainParts.slice(-1)[0]
  const domainName = domainParts.slice(0, -1).join(".")
  const domainMasked = domainName.slice(0, Math.min(2, domainName.length)) + "***"

  return `${localMasked}@${domainMasked}.${tld}`
}

/**
 * Masks a phone number.
 * - Keeps prefix and last 4 digits; middle replaced with "***".
 *
 * Examples:
 *   maskPhone("+573001234567") => "+5730***4567"
 *   maskPhone("3001234567")    => "300***4567"
 */
export function maskPhone(phone: string): string {
  if (!phone) return "N/A"
  const clean = phone.trim()
  if (clean.length <= 6) return clean
  const prefixLen = clean.startsWith("+") ? 5 : 3
  const prefix = clean.slice(0, prefixLen)
  const suffix = clean.slice(-4)
  return `${prefix}***${suffix}`
}
const joinCodePattern = /^ARKA-(?:[A-Z0-9]{4}|[A-F0-9]{8})$/i
const publicTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseInviteReference(value: string) {
  const candidate = value.trim()
  if (!candidate) return null

  let directReference: string
  try {
    directReference = decodeURIComponent(candidate)
  } catch {
    return null
  }
  if (joinCodePattern.test(directReference) || publicTokenPattern.test(directReference)) {
    return directReference
  }

  try {
    const url = new URL(candidate, window.location.origin)
    const segments = url.pathname.split('/').filter(Boolean)
    const joinIndex = segments.lastIndexOf('join')
    const reference = joinIndex >= 0 ? decodeURIComponent(segments[joinIndex + 1] ?? '') : ''

    if (joinCodePattern.test(reference) || publicTokenPattern.test(reference)) {
      return reference
    }
  } catch {
    return null
  }

  return null
}

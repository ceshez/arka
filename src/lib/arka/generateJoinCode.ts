export function generateJoinCode() {
  const segment = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 4).toUpperCase()
  return `ARKA-${segment.padEnd(4, '8')}`
}

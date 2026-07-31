const roundToTwo = (value: number) => Math.round(value * 100) / 100

export function distributePercentage(total: number, count: number): number[] {
  if (count <= 0) return []

  const base = Math.floor((total * 100) / count) / 100
  const values = Array.from({ length: count }, () => base)
  values[count - 1] = roundToTwo(total - base * (count - 1))
  return values
}

export function createEqualPercentages(memberCount: number): number[] {
  return distributePercentage(100, Math.max(memberCount, 1))
}

export function redistributeManualPercentages(
  percentages: number[],
  changedIndex: number,
  requestedValue: number,
  manualIndexes: number[],
): number[] {
  if (percentages.length <= 1) return [100]
  if (changedIndex < 0 || changedIndex >= percentages.length) return percentages

  const safeRequestedValue = Number.isFinite(requestedValue) ? requestedValue : 0
  const manual = new Set(manualIndexes.filter((index) => index >= 0 && index < percentages.length))
  manual.add(changedIndex)
  const otherManualTotal = Array.from(manual)
    .filter((index) => index !== changedIndex)
    .reduce((total, index) => total + Math.max(0, percentages[index] ?? 0), 0)
  const maxForChanged = Math.max(0, roundToTwo(100 - otherManualTotal))
  const unlockedIndexes = percentages.map((_, index) => index).filter((index) => !manual.has(index))
  const nextValue = unlockedIndexes.length === 0
    ? maxForChanged
    : Math.min(maxForChanged, Math.max(0, roundToTwo(safeRequestedValue)))
  const unlockedPercentages = distributePercentage(
    Math.max(0, roundToTwo(100 - otherManualTotal - nextValue)),
    unlockedIndexes.length,
  )
  let unlockedCursor = 0

  return percentages.map((percentage, index) => {
    if (index === changedIndex) return nextValue
    if (manual.has(index)) return roundToTwo(Math.max(0, percentage))
    const nextPercentage = unlockedPercentages[unlockedCursor] ?? 0
    unlockedCursor += 1
    return nextPercentage
  })
}

export function calculatePercentageAmounts(total: number, percentages: number[], fractionDigits = 2): number[] {
  const factor = 10 ** fractionDigits
  const roundAmount = (value: number) => Math.round(value * factor) / factor
  let allocated = 0

  return percentages.map((percentage, index) => {
    if (index === percentages.length - 1) return roundAmount(total - allocated)

    const amount = roundAmount((total * percentage) / 100)
    allocated = roundAmount(allocated + amount)
    return amount
  })
}

import type { Arka } from '../../types/arka'

export function selectArkaById(
  arkas: readonly Arka[],
  arkaId: string | undefined,
  currentArkaId: string,
) {
  const targetId = arkaId ?? currentArkaId
  return arkas.find((arka) => arka.id === targetId)
}

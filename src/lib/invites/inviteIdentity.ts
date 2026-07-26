const guestKeyStorageKey = 'arka-invite-guest-key'

export function getOrCreateInviteGuestKey() {
  const existingKey = window.localStorage.getItem(guestKeyStorageKey)
  if (existingKey) return existingKey

  const guestKey = `${createRandomId()}-${createRandomId()}`
  window.localStorage.setItem(guestKeyStorageKey, guestKey)
  return guestKey
}
import { createRandomId } from '../utils/createRandomId'

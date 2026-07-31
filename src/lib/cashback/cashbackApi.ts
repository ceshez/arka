import { getOrCreateInviteGuestKey } from '../invites/inviteIdentity'
import type { WalletActivationSignature } from '../nimiq/sharedWalletActivation'

const installationStorageKey = 'arka-cashback-installation-v1'

export type CashbackClaim = {
  id: string
  arka_id: string
  arka_code: string
  member_id: string
  recipient_wallet_address: string
  contribution_fiat: number
  contribution_nim: number
  reward_fiat: number
  reward_nim: number
  status: 'pending' | 'confirmed' | 'rejected'
  claimed_at: string
}

export type TreasuryAuthorization = WalletActivationSignature & {
  address: string
  expiresAt: string
}

function getOrCreateInstallationKey() {
  const existing = window.localStorage.getItem(installationStorageKey)
  if (existing) return existing
  const key = `${crypto.randomUUID()}:${crypto.randomUUID()}`
  window.localStorage.setItem(installationStorageKey, key)
  return key
}

async function cashbackRequest<T>(body: Record<string, unknown>) {
  const response = await fetch('/api/cashback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Cashback request failed.')
  return payload
}

export function claimCashback(input: { reference: string; transactionHash: string }) {
  return cashbackRequest<{ claim: CashbackClaim; alreadyClaimed: boolean; message: string }>({
    action: 'claim',
    reference: input.reference,
    transactionHash: input.transactionHash,
    guestKey: getOrCreateInviteGuestKey(),
    installationKey: getOrCreateInstallationKey(),
  })
}

export function listPendingCashback(authorization: TreasuryAuthorization) {
  return cashbackRequest<{ claims: CashbackClaim[] }>({
    action: 'list',
    authorization,
  })
}

export function confirmCashback(input: {
  authorization: TreasuryAuthorization
  claimId: string
  transactionHash: string
}) {
  return cashbackRequest<{ claim: CashbackClaim }>({
    action: 'confirm',
    authorization: input.authorization,
    claimId: input.claimId,
    transactionHash: input.transactionHash,
  })
}

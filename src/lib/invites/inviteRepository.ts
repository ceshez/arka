import type { SupabaseClient } from '@supabase/supabase-js'
import type { Arka } from '../../types/arka'
import { getSupabaseClient, getSupabaseConfiguration } from '../supabase/client'
import { createRandomId } from '../utils/createRandomId'

type InviteResponse = {
  arka: Arka
  memberId?: string
}

export class InviteRepositoryError extends Error {
  readonly code: 'not-configured' | 'not-found' | 'expired' | 'locked' | 'request-failed'

  constructor(
    message: string,
    code: 'not-configured' | 'not-found' | 'expired' | 'locked' | 'request-failed',
  ) {
    super(message)
    this.name = 'InviteRepositoryError'
    this.code = code
  }
}

function getConfiguration() {
  const configuration = getSupabaseConfiguration()
  if (!configuration) {
    throw new InviteRepositoryError(
      'Shared invites are not configured yet. Add the Supabase URL and publishable key, then try again.',
      'not-configured',
    )
  }

  return configuration
}

async function callInviteRpc<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const configuration = getConfiguration()
  let result: Awaited<ReturnType<SupabaseClient['rpc']>>

  try {
    const client = await getSupabaseClient(configuration)
    result = await client.rpc(functionName, body)
  } catch {
    throw new InviteRepositoryError(
      'Arka could not reach the invite service. Check your connection and try again.',
      'request-failed',
    )
  }

  if (result.error) {
    const message = result.error.message || 'The invite request could not be completed.'
    const normalizedMessage = message.toLowerCase()
    const code = normalizedMessage.includes('expired')
      ? 'expired'
      : normalizedMessage.includes('locked')
        ? 'locked'
        : normalizedMessage.includes('not found')
          ? 'not-found'
          : 'request-failed'

    throw new InviteRepositoryError(message, code)
  }

  return result.data as T
}

export async function createSharedInvite(draft: Arka) {
  const hostSecret = `${createRandomId()}-${createRandomId()}`
  const result = await callInviteRpc<InviteResponse>('create_arka_invite', {
    p_arka: draft,
    p_host_secret: hostSecret,
    p_expires_at: draft.expiresAt,
  })

  return { arka: result.arka, hostSecret }
}

export async function loadSharedInvite(reference: string) {
  const result = await callInviteRpc<InviteResponse | null>('get_arka_invite', {
    p_reference: reference.trim(),
  })
  return result?.arka ?? null
}

export async function joinSharedInvite(
  reference: string,
  guest: { guestKey: string; displayName: string; walletAddress?: string },
) {
  const result = await callInviteRpc<InviteResponse>('join_arka_invite', {
    p_reference: reference.trim(),
    p_guest_key: guest.guestKey,
    p_display_name: guest.displayName,
    p_wallet_address: guest.walletAddress ?? null,
  })

  if (!result.memberId) {
    throw new InviteRepositoryError('The joined member could not be loaded.', 'request-failed')
  }

  return { arka: result.arka, memberId: result.memberId }
}

export async function updateSharedInvite(arka: Arka, hostSecret: string) {
  if (!arka.invite.publicToken) return arka

  const result = await callInviteRpc<InviteResponse>('update_arka_invite', {
    p_public_token: arka.invite.publicToken,
    p_host_secret: hostSecret,
    p_arka: arka,
  })
  return result.arka
}

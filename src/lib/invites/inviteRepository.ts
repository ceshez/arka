import type { SupabaseClient } from '@supabase/supabase-js'
import type { Arka, AssetSymbol } from '../../types/arka'
import { getSupabaseClient, getSupabaseConfiguration } from '../supabase/client'
import { createRandomId } from '../utils/createRandomId'

type InviteResponse = {
  arka: Arka
  memberId?: string
}

type SharedFundResponse = {
  arka: Arka
  memberId?: string
  verified?: boolean
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

async function callSharedFundFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const configuration = getConfiguration()
  try {
    const client = await getSupabaseClient(configuration)
    const result = await client.functions.invoke(functionName, { body })
    if (result.error) {
      const context = 'context' in result.error ? result.error.context : undefined
      if (context instanceof Response) {
        try {
          const payload = await context.clone().json() as { error?: unknown }
          if (typeof payload.error === 'string' && payload.error.trim()) {
            throw new InviteRepositoryError(payload.error, 'request-failed')
          }
        } catch (contextError) {
          if (contextError instanceof InviteRepositoryError) throw contextError
        }
      }

      const normalizedMessage = result.error.message.toLowerCase()
      const message = normalizedMessage.includes('failed to send')
        ? 'Arka could not reach shared fund setup. Check your connection and try again.'
        : normalizedMessage.includes('non-2xx')
          ? 'The shared fund request could not be completed. Review the details and try again.'
          : result.error.message || 'The shared fund request failed.'
      throw new InviteRepositoryError(message, 'request-failed')
    }
    if (result.data && typeof result.data === 'object' && 'error' in result.data) {
      const message = (result.data as { error?: unknown }).error
      throw new InviteRepositoryError(
        typeof message === 'string' ? message : 'The shared fund request failed.',
        'request-failed',
      )
    }
    return result.data as T
  } catch (error) {
    if (error instanceof InviteRepositoryError) throw error
    throw new InviteRepositoryError(
      error instanceof Error && !error.message.toLowerCase().includes('failed to send')
        ? error.message
        : 'Arka could not reach shared fund setup. Check your connection and try again.',
      'request-failed',
    )
  }
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

export async function respondToSponsorModeRequest(input: {
  reference: string
  guestKey: string
  requestId: string
  accepted: boolean
}) {
  const result = await callInviteRpc<InviteResponse>('respond_arka_sponsor_request', {
    p_reference: input.reference.trim(),
    p_guest_key: input.guestKey,
    p_request_id: input.requestId,
    p_accepted: input.accepted,
  })
  return result.arka
}

export async function confirmSharedMemberPayment(input: {
  reference: string
  guestKey: string
  asset: AssetSymbol
}) {
  const result = await callInviteRpc<InviteResponse>('confirm_arka_member_payment', {
    p_reference: input.reference.trim(),
    p_guest_key: input.guestKey,
    p_asset: input.asset,
  })

  if (!result.memberId) {
    throw new InviteRepositoryError('The paid member could not be loaded.', 'request-failed')
  }

  return { arka: result.arka, memberId: result.memberId }
}

export async function activateSharedFundMember(input: {
  reference: string
  memberId: string
  guestKey?: string
  hostSecret?: string
  walletAddress: string
  message: string
  publicKey: string
  signature: string
}) {
  const result = await callSharedFundFunction<SharedFundResponse>('activate-shared-member', input)
  return result.arka
}

export async function verifySharedFundWallet(input: {
  reference: string
  hostSecret: string
  sharedWalletAddress: string
}) {
  const result = await callSharedFundFunction<SharedFundResponse>('verify-shared-wallet', input)
  return result.arka
}

export async function verifySharedFundContribution(input: {
  reference: string
  guestKey?: string
  hostSecret?: string
  memberId: string
  transactionHash: string
}) {
  const result = await callSharedFundFunction<SharedFundResponse>('verify-contribution', input)
  return result.arka
}

export async function prepareSharedFundSettlement(input: {
  reference: string
  hostSecret: string
  recipientWalletAddress: string
  recipientLabel?: string
}) {
  const result = await callSharedFundFunction<SharedFundResponse>('prepare-settlement', input)
  return result.arka
}

export async function verifySharedFundSettlement(input: {
  reference: string
  hostSecret: string
}) {
  const result = await callSharedFundFunction<SharedFundResponse>('verify-settlement', input)
  return result.arka
}

export async function requestSharedFundRefund(input: {
  reference: string
  hostSecret: string
}) {
  const result = await callSharedFundFunction<SharedFundResponse>('request-refund', input)
  return result.arka
}

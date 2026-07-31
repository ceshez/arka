import { createHash } from 'node:crypto'
import { Address, Hash, PublicKey, Signature } from '@nimiq/core'
import { createClient } from '@supabase/supabase-js'
import { checkBotId } from 'botid/server'

const LUNAS_PER_NIM = 100_000
const SIGNED_MESSAGE_PREFIX = '\x16Nimiq Signed Message:\n'
const NIMIQ_RPC_URL = process.env.NIMIQ_RPC_URL?.trim() || 'https://rpc.nimiqwatch.com'

type JsonRecord = Record<string, unknown>

type CashbackClaim = {
  id: string
  arka_id: string
  arka_code: string
  member_id: string
  recipient_wallet_address: string
  contribution_tx_hash: string
  contribution_fiat: number
  contribution_nim: number
  reward_fiat: number
  reward_nim: number
  status: 'pending' | 'confirmed' | 'rejected'
  payout_tx_hash?: string | null
  payout_block_number?: number | null
  claimed_at: string
  confirmed_at?: string | null
}

function json(body: JsonRecord, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

function normalizeAddress(value: unknown) {
  if (typeof value !== 'string') return ''
  try {
    return Address.fromString(value.trim()).toUserFriendlyAddress().replace(/\s+/g, '').toUpperCase()
  } catch {
    return value.replace(/\s+/g, '').toUpperCase()
  }
}

function transactionMemo(transaction: JsonRecord) {
  const value = transaction.data ?? transaction.recipientData ?? ''
  if (typeof value !== 'string') return ''
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return value
  try {
    const bytes = Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
    return new TextDecoder().decode(bytes).replace(/\0+$/g, '')
  } catch {
    return ''
  }
}

async function nimiqTransaction(hash: string) {
  const response = await fetch(NIMIQ_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransactionByHash',
      params: [hash],
    }),
  })
  if (!response.ok) throw new Error('Nimiq mainnet verification is unavailable.')
  const payload = await response.json() as { result?: { data?: JsonRecord } }
  return payload.result?.data
}

function treasuryAuthorizationMessage(address: string, expiresAt: string) {
  return [
    'Authorize Arka cashback treasury payouts',
    `Address: ${address}`,
    `Expires: ${expiresAt}`,
    'This signature does not move NIM. Each payout still requires Nimiq Pay confirmation.',
  ].join('\n')
}

function verifyTreasuryAuthorization(input: unknown) {
  const treasuryAddress = process.env.CASHBACK_TREASURY_ADDRESS?.trim()
  if (!treasuryAddress) throw new Error('Cashback treasury is not configured.')
  if (!input || typeof input !== 'object') throw new Error('Treasury authorization is required.')

  const authorization = input as JsonRecord
  const address = String(authorization.address ?? '')
  const expiresAt = String(authorization.expiresAt ?? '')
  const publicKeyHex = String(authorization.publicKey ?? '')
  const signatureHex = String(authorization.signature ?? '')
  const expiresMs = Date.parse(expiresAt)
  const now = Date.now()
  if (!Number.isFinite(expiresMs) || expiresMs <= now || expiresMs > now + 10 * 60_000) {
    throw new Error('Treasury authorization expired.')
  }
  if (normalizeAddress(address) !== normalizeAddress(treasuryAddress)) {
    throw new Error('Connect the configured cashback treasury wallet.')
  }

  const message = treasuryAuthorizationMessage(address, expiresAt)
  const publicKey = PublicKey.fromHex(publicKeyHex)
  const signature = Signature.fromHex(signatureHex)
  const signedMessage = `${SIGNED_MESSAGE_PREFIX}${message.length}${message}`
  const hash = Hash.computeSha256(new TextEncoder().encode(signedMessage))
  if (!publicKey.verify(signature, hash)
      || normalizeAddress(publicKey.toAddress().toUserFriendlyAddress()) !== normalizeAddress(treasuryAddress)) {
    throw new Error('Treasury authorization is invalid.')
  }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRoleKey) throw new Error('Cashback storage is not configured.')
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function loadInvite(reference: string) {
  const client = getSupabaseAdmin()
  const normalized = reference.trim()
  const query = client
    .from('arka_invites')
    .select('id, public_token, join_code, arka')
    .limit(1)
  const result = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await query.eq('public_token', normalized.toLowerCase()).maybeSingle()
    : await query.eq('join_code', normalized.toUpperCase().startsWith('ARKA-')
      ? normalized.toUpperCase()
      : `ARKA-${normalized.toUpperCase()}`).maybeSingle()
  if (result.error) throw result.error
  if (!result.data) throw new Error('Arka not found.')
  return { client, row: result.data }
}

function guestMember(arka: JsonRecord, guestKey: string) {
  const guestHash = createHash('sha256').update(guestKey).digest('hex')
  const memberId = `member-guest-${guestHash.slice(0, 20)}`
  const members = Array.isArray(arka.members) ? arka.members as JsonRecord[] : []
  const member = members.find((candidate) => candidate.id === memberId && candidate.role === 'guest')
  if (!member) throw new Error('Arka member not found.')
  return member
}

async function claimCashback(body: JsonRecord) {
  const reference = String(body.reference ?? '')
  const guestKey = String(body.guestKey ?? '')
  const installationKey = String(body.installationKey ?? '')
  const transactionHash = String(body.transactionHash ?? '').trim().toLowerCase()
  if (guestKey.length < 64 || installationKey.length < 32 || !/^[a-f0-9]{64}$/.test(transactionHash)) {
    throw new Error('Cashback claim details are invalid.')
  }

  const { client, row } = await loadInvite(reference)
  const arka = row.arka as JsonRecord
  const member = guestMember(arka, guestKey)
  const transaction = await nimiqTransaction(transactionHash)
  const usesSharedWallet = arka.fundingMode === 'shared-wallet'
  const expectedRecipient = usesSharedWallet ? arka.sharedWalletAddress : arka.hostWalletAddress
  const expectedMemo = usesSharedWallet
    ? `ARKA:${String(arka.id)}:${String(member.id)}`
    : `Arka ${String(arka.code ?? row.join_code)}`
  const expectedValue = Math.round(Number(member.amountDueNim ?? 0) * LUNAS_PER_NIM)

  if (!transaction
      || typeof transaction.blockNumber !== 'number'
      || transaction.networkId !== 24
      || transaction.executionResult === false
      || normalizeAddress(transaction.from) !== normalizeAddress(member.walletAddress)
      || normalizeAddress(transaction.to) !== normalizeAddress(expectedRecipient)
      || Number(transaction.value) !== expectedValue
      || transactionMemo(transaction) !== expectedMemo) {
    throw new Error('The mainnet transaction does not match this contribution.')
  }

  const result = await client.rpc('claim_arka_cashback', {
    p_reference: reference,
    p_guest_key: guestKey,
    p_installation_key: installationKey,
    p_transaction_hash: transactionHash,
  })
  if (result.error) throw result.error
  const payload = result.data as { claim: CashbackClaim; alreadyClaimed: boolean }
  return json({
    claim: payload.claim,
    alreadyClaimed: payload.alreadyClaimed,
    message: payload.alreadyClaimed
      ? 'Your cashback was already requested.'
      : 'Cashback reserved. The treasury payout is pending.',
  })
}

async function listCashback(body: JsonRecord) {
  verifyTreasuryAuthorization(body.authorization)
  const client = getSupabaseAdmin()
  const result = await client
    .from('cashback_claims')
    .select('id, arka_id, arka_code, member_id, recipient_wallet_address, contribution_tx_hash, contribution_fiat, contribution_nim, reward_fiat, reward_nim, status, payout_tx_hash, payout_block_number, claimed_at, confirmed_at')
    .eq('status', 'pending')
    .order('claimed_at', { ascending: true })
    .limit(100)
  if (result.error) throw result.error
  return json({ claims: result.data as CashbackClaim[] })
}

async function confirmCashback(body: JsonRecord) {
  verifyTreasuryAuthorization(body.authorization)
  const claimId = String(body.claimId ?? '')
  const transactionHash = String(body.transactionHash ?? '').trim().toLowerCase()
  if (!/^[0-9a-f-]{36}$/i.test(claimId) || !/^[a-f0-9]{64}$/.test(transactionHash)) {
    throw new Error('Payout confirmation details are invalid.')
  }

  const client = getSupabaseAdmin()
  const claimResult = await client
    .from('cashback_claims')
    .select('id, arka_code, recipient_wallet_address, reward_nim, status')
    .eq('id', claimId)
    .single()
  if (claimResult.error) throw claimResult.error
  const claim = claimResult.data as CashbackClaim
  if (claim.status === 'confirmed') return json({ claim, alreadyConfirmed: true })
  if (claim.status !== 'pending') throw new Error('Cashback claim is closed.')

  const treasuryAddress = process.env.CASHBACK_TREASURY_ADDRESS?.trim() ?? ''
  const transaction = await nimiqTransaction(transactionHash)
  const expectedValue = Math.round(Number(claim.reward_nim) * LUNAS_PER_NIM)
  if (!transaction
      || typeof transaction.blockNumber !== 'number'
      || transaction.networkId !== 24
      || transaction.executionResult === false
      || normalizeAddress(transaction.from) !== normalizeAddress(treasuryAddress)
      || normalizeAddress(transaction.to) !== normalizeAddress(claim.recipient_wallet_address)
      || Number(transaction.value) !== expectedValue
      || transactionMemo(transaction) !== `Arka ${claim.arka_code} cashback`) {
    throw new Error('The mainnet transaction does not match this cashback payout.')
  }

  const result = await client.rpc('confirm_arka_cashback', {
    p_claim_id: claimId,
    p_payout_tx_hash: transactionHash,
    p_block_number: transaction.blockNumber,
  })
  if (result.error) throw result.error
  return json(result.data as JsonRecord)
}

export async function POST(request: Request) {
  try {
    const verification = await checkBotId({
      developmentOptions: process.env.NODE_ENV === 'production'
        ? undefined
        : { isDevelopment: true, bypass: 'HUMAN' },
      advancedOptions: {
        checkLevel: 'basic',
        headers: Object.fromEntries(request.headers.entries()),
      },
    })
    if (!verification.isHuman) return json({ error: 'Human verification failed.' }, 403)

    const body = await request.json() as JsonRecord
    const action = String(body.action ?? '')
    if (action === 'claim') return await claimCashback(body)
    if (action === 'list') return await listCashback(body)
    if (action === 'confirm') return await confirmCashback(body)
    return json({ error: 'Unknown cashback action.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cashback request failed.'
    const status = /not found/i.test(message) ? 404 : /authorization|configured treasury/i.test(message) ? 403 : 400
    return json({ error: message }, status)
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Edge functions validate dynamic JSON snapshots at runtime. */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Address, Hash, PublicKey, Signature } from 'npm:@nimiq/core@2.7.2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export type InviteRow = {
  id: string
  public_token: string
  join_code: string
  arka: Record<string, any>
  host_secret_hash: string
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Shared fund service is not configured.')
  return createClient(url, key, { auth: { persistSession: false } })
}

export function normalizeAddress(address?: string) {
  return address?.replace(/\s+/g, '').toUpperCase() ?? ''
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function loadInvite(reference: string) {
  const client = serviceClient()
  const normalized = reference.trim()
  const byToken = /^[0-9a-f-]{36}$/i.test(normalized)
  const query = client.from('arka_invites').select('*')
  const result = byToken
    ? await query.eq('public_token', normalized.toLowerCase()).maybeSingle()
    : await query.eq('join_code', normalized.toUpperCase().startsWith('ARKA-')
      ? normalized.toUpperCase()
      : `ARKA-${normalized.toUpperCase()}`).maybeSingle()
  if (result.error) throw result.error
  if (!result.data) throw new Error('Arka not found.')
  return { client, row: result.data as InviteRow }
}

export async function assertHost(row: InviteRow, hostSecret?: string) {
  if (!hostSecret || await sha256Hex(hostSecret) !== row.host_secret_hash) {
    throw new Error('Host authorization is required.')
  }
}

export async function assertMember(
  row: InviteRow,
  memberId: string,
  guestKey?: string,
  hostSecret?: string,
) {
  const member = (row.arka.members ?? []).find((candidate: any) => candidate.id === memberId)
  if (!member) throw new Error('Arka member not found.')
  if (member.role === 'host') {
    await assertHost(row, hostSecret)
  } else {
    if (!guestKey || memberId !== `member-guest-${(await sha256Hex(guestKey)).slice(0, 20)}`) {
      throw new Error('Member authorization is required.')
    }
  }
  return member
}

export async function saveArka(client: ReturnType<typeof serviceClient>, row: InviteRow, arka: Record<string, any>) {
  const version = Number(arka.invite?.version ?? 1) + 1
  const updated = {
    ...arka,
    invite: { ...(arka.invite ?? {}), version },
    updatedAt: new Date().toISOString(),
  }
  const result = await client.from('arka_invites').update({
    arka: updated,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
  if (result.error) throw result.error
  return updated
}

export function activationMessage(arka: Record<string, any>, memberId: string) {
  return [
    'Activate Arka shared fund',
    `Arka: ${arka.id}`,
    `Member: ${memberId}`,
    'The signer group is finalized only when the shared wallet is verified.',
    'This signature does not move NIM or grant access to your wallet.',
  ].join('\n')
}

export function canonicalAddress(address: string) {
  return Address.fromString(address.trim()).toUserFriendlyAddress()
}

export function verifyActivation(
  message: string,
  walletAddress: string,
  publicKeyHex: string,
  signatureHex: string,
) {
  const publicKey = PublicKey.fromHex(publicKeyHex)
  const signature = Signature.fromHex(signatureHex)
  const prefixed = `\x16Nimiq Signed Message:\n${message.length}${message}`
  const hash = Hash.computeSha256(new TextEncoder().encode(prefixed))
  return publicKey.verify(signature, hash)
    && normalizeAddress(publicKey.toAddress().toUserFriendlyAddress()) === normalizeAddress(walletAddress)
}

export function computeSharedAddress(publicKeys: string[], approvals: number) {
  return Address.fromPublicKeys(publicKeys.map((key) => PublicKey.fromHex(key)), approvals)
    .toUserFriendlyAddress()
}

export async function nimiqRpc<T>(method: string, params: unknown[]) {
  const endpoint = Deno.env.get('NIMIQ_RPC_URL') || 'https://rpc.nimiqwatch.com'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!response.ok) throw new Error('Nimiq mainnet verification is unavailable.')
  const payload = await response.json()
  return payload?.result?.data as T
}

export function transactionMemo(transaction: Record<string, any>) {
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

export function event(input: {
  type: string
  status: string
  label: string
  memberId?: string
  amountNim?: number
}) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  }
}

export function withEvent(arka: Record<string, any>, nextEvent: Record<string, any>) {
  return {
    ...arka,
    fundEvents: [nextEvent, ...(arka.fundEvents ?? [])].slice(0, 100),
  }
}

export function handleOptions(request: Request) {
  return request.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null
}

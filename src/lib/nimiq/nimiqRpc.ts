import type { PaymentRequest } from './types'

const NIMIQ_RPC = import.meta.env?.VITE_NIMIQ_RPC_URL?.trim() || 'https://rpc.nimiqwatch.com'
const LUNAS_PER_NIM = 100_000

type RpcEnvelope<T> = {
  result?: {
    data?: T
  }
}

export type NimiqTransaction = {
  blockNumber?: number
  networkId?: number
  executionResult?: boolean
  from?: string
  to?: string
  value?: number
  data?: string
  recipientData?: string
}

export type NimiqPaymentMismatch =
  | 'unconfirmed'
  | 'network'
  | 'execution'
  | 'sender'
  | 'recipient'
  | 'amount'
  | 'memo'

export function normalizeNimiqAddress(value?: string) {
  return value?.replace(/\s+/g, '').toUpperCase() ?? ''
}

export function nimiqTransactionMemo(transaction: NimiqTransaction) {
  const value = transaction.data ?? transaction.recipientData ?? ''
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return value

  try {
    const bytes = Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
    return new TextDecoder().decode(bytes).replace(/\0+$/g, '')
  } catch {
    return ''
  }
}

export function getNimiqPaymentMismatch(
  transaction: NimiqTransaction,
  request: PaymentRequest,
): NimiqPaymentMismatch | null {
  if (typeof transaction.blockNumber !== 'number') return 'unconfirmed'
  if (transaction.networkId !== 24) return 'network'
  if (transaction.executionResult === false) return 'execution'
  if (
    request.senderWalletAddress
    && normalizeNimiqAddress(transaction.from) !== normalizeNimiqAddress(request.senderWalletAddress)
  ) return 'sender'
  if (normalizeNimiqAddress(transaction.to) !== normalizeNimiqAddress(request.recipientWalletAddress)) {
    return 'recipient'
  }
  if (Number(transaction.value) !== nimToLuna(request.amountNim ?? 0)) return 'amount'
  if (request.memo !== undefined && nimiqTransactionMemo(transaction) !== request.memo) return 'memo'
  return null
}

export async function callNimiqRpc<T>(method: string, params: unknown[], signal?: AbortSignal) {
  const response = await fetch(NIMIQ_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal,
  })
  if (!response.ok) throw new Error('Nimiq RPC request failed')
  const payload = await response.json() as RpcEnvelope<T>
  return payload.result?.data
}

export async function fetchNimBalance(address: string) {
  const account = await callNimiqRpc<{ balance?: number }>('getAccountByAddress', [address])
  if (typeof account?.balance !== 'number') throw new Error('Wallet balance missing')
  return account.balance / LUNAS_PER_NIM
}

export async function waitForNimiqTransaction(hash: string, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const transaction = await callNimiqRpc<NimiqTransaction>('getTransactionByHash', [hash])
      if (transaction && typeof transaction.blockNumber === 'number') return transaction
    } catch {
      // Public RPC nodes can briefly lag behind a just-broadcast transaction.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1_250))
  }

  return undefined
}

export async function waitForNimiqConfirmation(hash: string, timeoutMs = 25_000) {
  return Boolean(await waitForNimiqTransaction(hash, timeoutMs))
}

export function nimToLuna(nim: number) {
  return Math.round(nim * LUNAS_PER_NIM)
}

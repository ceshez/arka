const NIMIQ_RPC = import.meta.env.VITE_NIMIQ_RPC_URL?.trim() || 'https://rpc.nimiqwatch.com'
const LUNAS_PER_NIM = 100_000

type RpcEnvelope<T> = {
  result?: {
    data?: T
  }
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

export async function waitForNimiqConfirmation(hash: string, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const transaction = await callNimiqRpc<{ blockNumber?: number }>('getTransactionByHash', [hash])
      if (transaction && typeof transaction.blockNumber === 'number') return true
    } catch {
      // Public RPC nodes can briefly lag behind a just-broadcast transaction.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1_250))
  }

  return false
}

export function nimToLuna(nim: number) {
  return Math.round(nim * LUNAS_PER_NIM)
}

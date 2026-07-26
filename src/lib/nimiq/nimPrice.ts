const PRICE_ENDPOINT = 'https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd'
const FALLBACK_NIM_USD = 0.00052

export type NimPriceSnapshot = {
  usd: number
  updatedAt: string
  isLive: boolean
}

export async function fetchNimPrice(signal?: AbortSignal): Promise<NimPriceSnapshot> {
  try {
    const response = await fetch(PRICE_ENDPOINT, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Price request failed: ${response.status}`)
    const payload = await response.json() as { 'nimiq-2'?: { usd?: number } }
    const usd = payload['nimiq-2']?.usd
    if (!usd || !Number.isFinite(usd)) throw new Error('NIM price missing')
    return { usd, updatedAt: new Date().toISOString(), isLive: true }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return { usd: FALLBACK_NIM_USD, updatedAt: new Date().toISOString(), isLive: false }
  }
}


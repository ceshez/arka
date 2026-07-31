const PRICE_ENDPOINT = 'https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd&include_last_updated_at=true'
const FALLBACK_NIM_USD = 0.000461
const CACHED_PRICE_KEY = 'arka:nim-usd-price:v1'
const MAX_CACHED_PRICE_AGE_MS = 30 * 60_000

export type NimPriceSource = 'coingecko' | 'cached' | 'fallback'

export type NimPriceSnapshot = {
  usd: number
  updatedAt: string
  isLive: boolean
  source: NimPriceSource
}

function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function readCachedPrice(): NimPriceSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHED_PRICE_KEY) ?? '') as {
      usd?: unknown
      updatedAt?: unknown
    }
    if (!isValidPrice(cached.usd) || typeof cached.updatedAt !== 'string') return null
    if (Date.now() - Date.parse(cached.updatedAt) > MAX_CACHED_PRICE_AGE_MS) return null
    return { usd: cached.usd, updatedAt: cached.updatedAt, isLive: false, source: 'cached' }
  } catch {
    return null
  }
}

function cachePrice(snapshot: NimPriceSnapshot) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHED_PRICE_KEY, JSON.stringify({
      usd: snapshot.usd,
      updatedAt: snapshot.updatedAt,
    }))
  } catch {
    // Price caching is an optimization; a blocked storage API must not break creation.
  }
}

export async function fetchNimPrice(signal?: AbortSignal): Promise<NimPriceSnapshot> {
  try {
    const response = await fetch(PRICE_ENDPOINT, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Price request failed: ${response.status}`)
    const payload = await response.json() as { 'nimiq-2'?: { usd?: number; last_updated_at?: number } }
    const usd = payload['nimiq-2']?.usd
    if (!isValidPrice(usd)) throw new Error('NIM price missing')
    const providerTimestamp = payload['nimiq-2']?.last_updated_at
    const snapshot: NimPriceSnapshot = {
      usd,
      updatedAt: providerTimestamp
        ? new Date(providerTimestamp * 1_000).toISOString()
        : new Date().toISOString(),
      isLive: true,
      source: 'coingecko',
    }
    cachePrice(snapshot)
    return snapshot
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return readCachedPrice() ?? {
      usd: FALLBACK_NIM_USD,
      updatedAt: new Date().toISOString(),
      isLive: false,
      source: 'fallback',
    }
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchNimPrice } from '../src/lib/nimiq/nimPrice.ts'

test('reads the CoinGecko NIM/USD price and provider timestamp', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    'nimiq-2': {
      usd: 0.00046095,
      last_updated_at: 1_785_467_920,
    },
  }), { status: 200 })

  try {
    const snapshot = await fetchNimPrice()
    assert.equal(snapshot.usd, 0.00046095)
    assert.equal(snapshot.source, 'coingecko')
    assert.equal(snapshot.isLive, true)
    assert.equal(snapshot.updatedAt, '2026-07-31T03:18:40.000Z')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uses the reviewed fallback when the live price is unavailable', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('offline')
  }

  try {
    const snapshot = await fetchNimPrice()
    assert.equal(snapshot.usd, 0.000461)
    assert.equal(snapshot.source, 'fallback')
    assert.equal(snapshot.isLive, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

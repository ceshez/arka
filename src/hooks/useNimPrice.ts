import { useEffect, useState } from 'react'
import { fetchNimPrice, type NimPriceSnapshot } from '../lib/nimiq/nimPrice'

const initialPrice: NimPriceSnapshot = { usd: 0.00052, updatedAt: '', isLive: false }

export function useNimPrice() {
  const [price, setPrice] = useState(initialPrice)

  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => fetchNimPrice(controller.signal).then(setPrice).catch(() => undefined)
    void refresh()
    const timer = window.setInterval(refresh, 5 * 60_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [])

  return price
}


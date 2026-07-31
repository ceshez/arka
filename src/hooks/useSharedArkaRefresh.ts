import { useEffect, useRef } from 'react'

type SharedArkaRefreshOptions = {
  arkaId?: string
  enabled: boolean
  refresh: (arkaId: string) => Promise<unknown>
  onError?: () => void
}

export function useSharedArkaRefresh({ arkaId, enabled, refresh, onError }: SharedArkaRefreshOptions) {
  const refreshingRef = useRef(false)
  const failedRef = useRef(false)

  useEffect(() => {
    if (!arkaId || !enabled) return
    failedRef.current = false

    const refreshNow = async () => {
      if (refreshingRef.current) return
      refreshingRef.current = true
      try {
        await refresh(arkaId)
        failedRef.current = false
      } catch {
        if (!failedRef.current) onError?.()
        failedRef.current = true
      } finally {
        refreshingRef.current = false
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshNow()
    }

    void refreshNow()
    const interval = window.setInterval(() => void refreshNow(), 3_000)
    window.addEventListener('focus', refreshNow)
    window.addEventListener('online', refreshNow)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshNow)
      window.removeEventListener('online', refreshNow)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [arkaId, enabled, onError, refresh])
}

export function useSharedArkasRefresh({
  arkaIds,
  refresh,
}: {
  arkaIds: string[]
  refresh: (arkaId: string) => Promise<unknown>
}) {
  const refreshingRef = useRef(false)
  const arkaIdsKey = arkaIds.join('|')

  useEffect(() => {
    if (!arkaIdsKey) return

    const refreshAll = async () => {
      if (refreshingRef.current) return
      refreshingRef.current = true
      try {
        await Promise.allSettled(arkaIdsKey.split('|').map((arkaId) => refresh(arkaId)))
      } finally {
        refreshingRef.current = false
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshAll()
    }

    void refreshAll()
    const interval = window.setInterval(() => void refreshAll(), 3_000)
    window.addEventListener('focus', refreshAll)
    window.addEventListener('online', refreshAll)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshAll)
      window.removeEventListener('online', refreshAll)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [arkaIdsKey, refresh])
}

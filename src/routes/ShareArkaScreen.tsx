import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ShareQrCard } from '../components/arka/ShareQrCard'
import { MobileScreen } from '../components/ui/MobileScreen'
import { useSharedArkaRefresh } from '../hooks/useSharedArkaRefresh'
import { useArkaStore } from '../store/arkaStore'
import { getHostName } from './routeUtils'

export function ShareArkaScreen() {
  const { arkaId } = useParams()
  const [searchParams] = useSearchParams()
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const refreshSharedArka = useArkaStore((state) => state.refreshSharedArka)

  useSharedArkaRefresh({
    arkaId,
    enabled: Boolean(arka?.invite.publicToken),
    refresh: refreshSharedArka,
  })

  if (!arka) return <Navigate to="/error/arka-not-found" replace />
  const returnTo = searchParams.get('return') === 'guest'
    ? `/arka/${arka.id}/guest`
    : `/arka/${arka.id}/host/summary`

  return (
    <MobileScreen showBottomNav={false} className="flex justify-end !bg-arka-bg sm:items-center sm:justify-center">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="px-5 pt-8 opacity-55 blur-[3px]">
          <div className="h-12 w-36 rounded-2xl bg-white" />
          <div className="mt-8 h-7 w-24 rounded-lg bg-[#c9c5ba]" />
          <div className="mt-5 h-40 rounded-[1.75rem] bg-[#1b1c19]" />
        </div>
        <div className="absolute inset-0 bg-[#171814]/45 backdrop-blur-[4px]" />
      </div>
      <motion.section
        className="relative z-10 max-h-full w-full overflow-y-auto rounded-t-[2rem] bg-arka-bg px-5 pb-[calc(0.75rem+var(--arka-safe-bottom))] pt-2 shadow-[0_-14px_34px_rgba(0,0,0,0.2)] sm:mx-4 sm:max-h-[calc(100%-2rem)] sm:w-[calc(100%-2rem)] sm:rounded-[2rem] sm:shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 330 }}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-[#cbc8bf]" />
        <header className="mt-3 flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold text-arka-muted">Share Arka</p><h1 className="arka-page-title mt-1">Bring everyone in</h1></div>
          <Link to={returnTo} aria-label="Close invite" className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#e2dcd2] bg-white active:scale-95"><X size={20} /></Link>
        </header>
        <div className="mt-5"><ShareQrCard arka={arka} hostName={getHostName(arka)} returnTo={returnTo} /></div>
      </motion.section>
    </MobileScreen>
  )
}

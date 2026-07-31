import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { ShareQrCard } from '../components/arka/ShareQrCard'
import { ScreenContainer } from '../components/layout/ScreenContainer'
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
  const guestReturn = searchParams.get('return') === 'guest'
  const returnTo = guestReturn
    ? `/arka/${arka.id}/guest`
    : `/arka/${arka.id}/host/summary`
  const returnLabel = guestReturn ? 'Back to Arka' : 'Go to Arka'

  return (
    <MobileScreen showBottomNav={false}>
      <ScreenContainer className="gap-6 pb-[calc(1.5rem+var(--arka-safe-bottom))]">
        <ArkaHeader title="Share Arka" subtitle="Bring everyone in" backTo={returnTo} />
        <ShareQrCard arka={arka} hostName={getHostName(arka)} returnTo={returnTo} returnLabel={returnLabel} />
      </ScreenContainer>
    </MobileScreen>
  )
}

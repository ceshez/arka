import { lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { WalletReconnectNotice } from './components/arka/WalletReconnectNotice'
import { WalletConnectionGate } from './components/arka/WalletConnectionGate'
import { ArkaWalkthroughProvider } from './components/arka/ArkaWalkthrough'
import { useSharedArkasRefresh } from './hooks/useSharedArkaRefresh'
import { sanitizeAnalyticsRoute, trackAnalyticsEvent } from './lib/analytics/analytics'
import { formatWalletAddress } from './lib/arka/formatWalletAddress'
import { normalizeNimiqAddress } from './lib/nimiq/sharedWalletCrypto'
import { useArkaStore } from './store/arkaStore'
import { useProfileStore } from './store/profileStore'
import { useWalletStore } from './store/walletStore'
import { getCurrentArkaMember } from './routes/routeUtils'

const ActivityScreen = lazy(async () => ({ default: (await import('./routes/ActivityScreen')).ActivityScreen }))
const ArkaPreviewGuestScreen = lazy(async () => ({ default: (await import('./routes/ArkaPreviewGuestScreen')).ArkaPreviewGuestScreen }))
const CompletedArkaSummaryScreen = lazy(async () => ({ default: (await import('./routes/CompletedArkaSummaryScreen')).CompletedArkaSummaryScreen }))
const CompletedArkasHistoryScreen = lazy(async () => ({ default: (await import('./routes/CompletedArkasHistoryScreen')).CompletedArkasHistoryScreen }))
const CreateArkaScreen = lazy(async () => ({ default: (await import('./routes/CreateArkaScreen')).CreateArkaScreen }))
const CashbackTreasuryScreen = lazy(async () => ({ default: (await import('./routes/CashbackTreasuryScreen')).CashbackTreasuryScreen }))
const DualChainLabScreen = lazy(async () => ({ default: (await import('./routes/DualChainLabScreen')).DualChainLabScreen }))
const GuestArkaViewScreen = lazy(async () => ({ default: (await import('./routes/GuestArkaViewScreen')).GuestArkaViewScreen }))
const HomeScreen = lazy(async () => ({ default: (await import('./routes/HomeScreen')).HomeScreen }))
const HostCollectedFundsSummaryScreen = lazy(async () => ({ default: (await import('./routes/HostCollectedFundsSummaryScreen')).HostCollectedFundsSummaryScreen }))
const JoinArkaScreen = lazy(async () => ({ default: (await import('./routes/JoinArkaScreen')).JoinArkaScreen }))
const PaymentSuccessScreen = lazy(async () => ({ default: (await import('./routes/PaymentSuccessScreen')).PaymentSuccessScreen }))
const PrePaymentSummaryScreen = lazy(async () => ({ default: (await import('./routes/PrePaymentSummaryScreen')).PrePaymentSummaryScreen }))
const ProfileScreen = lazy(async () => ({ default: (await import('./routes/ProfileScreen')).ProfileScreen }))
const SettlePaymentScreen = lazy(async () => ({ default: (await import('./routes/SettlePaymentScreen')).SettlePaymentScreen }))
const ShareArkaScreen = lazy(async () => ({ default: (await import('./routes/ShareArkaScreen')).ShareArkaScreen }))
const ArkaNotFoundErrorScreen = lazy(async () => ({ default: (await import('./routes/ErrorScreens')).ArkaNotFoundErrorScreen }))
const InsufficientBalanceErrorScreen = lazy(async () => ({ default: (await import('./routes/ErrorScreens')).InsufficientBalanceErrorScreen }))
const PaymentFailedErrorScreen = lazy(async () => ({ default: (await import('./routes/ErrorScreens')).PaymentFailedErrorScreen }))

function RouteFallback() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-arka-bg" role="status" aria-label="Loading Arka">
      <span className="arka-hex grid size-14 animate-pulse place-items-center bg-linear-to-b from-[#f8d66c] to-[#e9b213] shadow-[0_8px_18px_rgba(125,87,0,0.16)] motion-reduce:animate-none">
        <span className="size-3 rounded-full bg-white" />
      </span>
    </main>
  )
}

let appOpenedTracked = false

function AnalyticsRouteTracker() {
  const location = useLocation()

  useEffect(() => {
    if (!appOpenedTracked) {
      appOpenedTracked = true
      void trackAnalyticsEvent('app_opened')
    }

    void trackAnalyticsEvent('screen_viewed', {
      route: sanitizeAnalyticsRoute(location.pathname),
    })
  }, [location.pathname])

  return null
}

function SharedArkaSync() {
  const arkas = useArkaStore((state) => state.arkas)
  const refreshSharedArka = useArkaStore((state) => state.refreshSharedArka)
  const walletConnected = useWalletStore((state) => Boolean(state.wallet))
  const sharedArkaIds = useMemo(
    () => walletConnected
      ? arkas
        .filter((arka) => arka.invite.publicToken && arka.status !== 'completed' && arka.status !== 'expired')
        .map((arka) => arka.id)
      : [],
    [arkas, walletConnected],
  )

  useSharedArkasRefresh({
    arkaIds: sharedArkaIds,
    refresh: refreshSharedArka,
  })

  return null
}

function ProfileIdentitySync() {
  const arkas = useArkaStore((state) => state.arkas)
  const walletAddress = useWalletStore((state) => state.wallet?.address)
  const displayName = useProfileStore((state) => state.displayName)
  const setDisplayName = useProfileStore((state) => state.setDisplayName)

  useEffect(() => {
    if (!walletAddress || displayName) return

    const normalizedWallet = normalizeNimiqAddress(walletAddress)
    const walletLabel = formatWalletAddress(walletAddress)
    const sharedName = [...arkas]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .flatMap((arka) => arka.members)
      .find((member) => (
        member.walletAddress
        && normalizeNimiqAddress(member.walletAddress) === normalizedWallet
        && member.displayName.trim()
        && member.displayName.trim() !== walletLabel
      ))
      ?.displayName
      .trim()

    if (sharedName) setDisplayName(sharedName)
  }, [arkas, displayName, setDisplayName, walletAddress])

  return null
}

function ArkaRoleBoundary({
  requiredRole,
  children,
}: {
  requiredRole: 'host' | 'guest'
  children: ReactNode
}) {
  const { arkaId } = useParams()
  const arkas = useArkaStore((state) => state.arkas)
  const arka = arkas.find((candidate) => candidate.id === arkaId)
  const guestMemberId = useArkaStore((state) => (
    arkaId ? state.guestMemberIdsByArka[arkaId] : state.currentGuestMemberId
  ))
  const hasHostSecret = useArkaStore((state) => Boolean(arkaId && state.remoteHostSecrets[arkaId]))
  const walletAddress = useWalletStore((state) => state.wallet?.address)

  if (!arka) return <>{children}</>

  const member = getCurrentArkaMember(arka, {
    walletAddress,
    guestMemberId,
    hasHostSecret,
  })

  if (member?.role === requiredRole) return <>{children}</>
  if (member?.role === 'host') return <Navigate to={`/arka/${arka.id}/host/summary`} replace />
  if (member?.role === 'guest') return <Navigate to={`/arka/${arka.id}/guest`} replace />
  return <Navigate to="/join" replace />
}

export function App() {
  return (
    <BrowserRouter>
      <ArkaWalkthroughProvider>
        <AnalyticsRouteTracker />
        <SharedArkaSync />
        <ProfileIdentitySync />
        <WalletReconnectNotice />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/arkas" element={<WalletConnectionGate><CompletedArkasHistoryScreen /></WalletConnectionGate>} />
          <Route path="/activity" element={<WalletConnectionGate><ActivityScreen /></WalletConnectionGate>} />
          <Route path="/scan" element={<JoinArkaScreen />} />
          <Route path="/profile" element={<WalletConnectionGate><ProfileScreen /></WalletConnectionGate>} />
          <Route path="/wallet-lab" element={<DualChainLabScreen />} />
          <Route path="/people" element={<Navigate to="/profile" replace />} />
          <Route path="/create" element={<WalletConnectionGate><CreateArkaScreen /></WalletConnectionGate>} />
          <Route path="/cashback/treasury" element={<WalletConnectionGate><CashbackTreasuryScreen /></WalletConnectionGate>} />
          <Route path="/join" element={<JoinArkaScreen />} />
          <Route path="/join/:code/preview" element={<WalletConnectionGate><ArkaPreviewGuestScreen /></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/share" element={<WalletConnectionGate><ShareArkaScreen /></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/guest" element={<WalletConnectionGate><ArkaRoleBoundary requiredRole="guest"><GuestArkaViewScreen /></ArkaRoleBoundary></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/pay" element={<WalletConnectionGate><ArkaRoleBoundary requiredRole="guest"><PrePaymentSummaryScreen /></ArkaRoleBoundary></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/payment-success" element={<WalletConnectionGate><ArkaRoleBoundary requiredRole="guest"><PaymentSuccessScreen /></ArkaRoleBoundary></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/host" element={<WalletConnectionGate><ArkaRoleBoundary requiredRole="host"><HostCollectedFundsSummaryScreen /></ArkaRoleBoundary></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/host/summary" element={<WalletConnectionGate><ArkaRoleBoundary requiredRole="host"><HostCollectedFundsSummaryScreen /></ArkaRoleBoundary></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/settle" element={<WalletConnectionGate><ArkaRoleBoundary requiredRole="host"><SettlePaymentScreen /></ArkaRoleBoundary></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/fund-setup" element={<WalletConnectionGate><ArkaRoleBoundary requiredRole="host"><HostCollectedFundsSummaryScreen /></ArkaRoleBoundary></WalletConnectionGate>} />
          <Route path="/arka/:arkaId/completed" element={<WalletConnectionGate><CompletedArkaSummaryScreen /></WalletConnectionGate>} />
          <Route path="/history" element={<WalletConnectionGate><CompletedArkasHistoryScreen /></WalletConnectionGate>} />
          <Route path="/error/insufficient-balance" element={<InsufficientBalanceErrorScreen />} />
          <Route path="/error/payment-failed" element={<PaymentFailedErrorScreen />} />
          <Route path="/error/arka-not-found" element={<ArkaNotFoundErrorScreen />} />
          <Route path="*" element={<Navigate to="/error/arka-not-found" replace />} />
          </Routes>
        </Suspense>
      </ArkaWalkthroughProvider>
    </BrowserRouter>
  )
}

import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { WalletReconnectNotice } from './components/arka/WalletReconnectNotice'
import { sanitizeAnalyticsRoute, trackAnalyticsEvent } from './lib/analytics/analytics'

const ActivityScreen = lazy(async () => ({ default: (await import('./routes/ActivityScreen')).ActivityScreen }))
const ArkaPreviewGuestScreen = lazy(async () => ({ default: (await import('./routes/ArkaPreviewGuestScreen')).ArkaPreviewGuestScreen }))
const CompletedArkaSummaryScreen = lazy(async () => ({ default: (await import('./routes/CompletedArkaSummaryScreen')).CompletedArkaSummaryScreen }))
const CompletedArkasHistoryScreen = lazy(async () => ({ default: (await import('./routes/CompletedArkasHistoryScreen')).CompletedArkasHistoryScreen }))
const CreateArkaScreen = lazy(async () => ({ default: (await import('./routes/CreateArkaScreen')).CreateArkaScreen }))
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

export function App() {
  return (
    <BrowserRouter>
      <AnalyticsRouteTracker />
      <WalletReconnectNotice />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/arkas" element={<CompletedArkasHistoryScreen />} />
          <Route path="/activity" element={<ActivityScreen />} />
          <Route path="/scan" element={<JoinArkaScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/wallet-lab" element={<DualChainLabScreen />} />
          <Route path="/people" element={<Navigate to="/profile" replace />} />
          <Route path="/create" element={<CreateArkaScreen />} />
          <Route path="/join" element={<JoinArkaScreen />} />
          <Route path="/join/:code/preview" element={<ArkaPreviewGuestScreen />} />
          <Route path="/arka/:arkaId/share" element={<ShareArkaScreen />} />
          <Route path="/arka/:arkaId/guest" element={<GuestArkaViewScreen />} />
          <Route path="/arka/:arkaId/pay" element={<PrePaymentSummaryScreen />} />
          <Route path="/arka/:arkaId/payment-success" element={<PaymentSuccessScreen />} />
          <Route path="/arka/:arkaId/host/pay" element={<PrePaymentSummaryScreen payerRole="host" />} />
          <Route path="/arka/:arkaId/host/payment-success" element={<PaymentSuccessScreen payerRole="host" />} />
          <Route path="/arka/:arkaId/host" element={<HostCollectedFundsSummaryScreen />} />
          <Route path="/arka/:arkaId/host/summary" element={<HostCollectedFundsSummaryScreen />} />
          <Route path="/arka/:arkaId/settle" element={<SettlePaymentScreen />} />
          <Route path="/arka/:arkaId/completed" element={<CompletedArkaSummaryScreen />} />
          <Route path="/history" element={<CompletedArkasHistoryScreen />} />
          <Route path="/error/insufficient-balance" element={<InsufficientBalanceErrorScreen />} />
          <Route path="/error/payment-failed" element={<PaymentFailedErrorScreen />} />
          <Route path="/error/arka-not-found" element={<ArkaNotFoundErrorScreen />} />
          <Route path="*" element={<Navigate to="/error/arka-not-found" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

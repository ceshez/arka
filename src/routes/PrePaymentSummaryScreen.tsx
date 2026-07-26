import { Gift, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { PaymentSummaryCard } from '../components/arka/PaymentSummaryCard'
import { AssetSelector } from '../components/arka/AssetSelector'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqArrowLeft, NimiqArrowRight } from '../components/ui/NimiqIcon'
import { formatUsd } from '../lib/arka/formatMoney'
import { getNimiqWalletSurfaceName } from '../lib/nimiq/detectNimiqEnvironment'
import { getRemainingPaymentAmounts } from '../lib/payments/getRemainingPaymentAmounts'
import { paymentAssetSelectionKey, useArkaStore } from '../store/arkaStore'
import { getGuestMember, getHostMember } from './routeUtils'

export function PrePaymentSummaryScreen({ payerRole = 'guest' }: { payerRole?: 'guest' | 'host' }) {
  const { arkaId } = useParams()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
  const simulateGuestPayment = useArkaStore((state) => state.simulateGuestPayment)
  const paymentAssetSelections = useArkaStore((state) => state.paymentAssetSelections)
  const setPaymentAsset = useArkaStore((state) => state.setPaymentAsset)

  if (!arka) return <Navigate to="/error/arka-not-found" replace />
  if (arka.status === 'expired') return <Navigate to="/error/arka-not-found" replace />

  const activeArka = arka
  const payer = payerRole === 'host' ? getHostMember(activeArka) : getGuestMember(activeArka, currentGuestMemberId)
  if (!payer) return <Navigate to="/join" replace />

  const usdtAvailable = Boolean(window.ethereum)
  const savedPaymentAsset = paymentAssetSelections[paymentAssetSelectionKey(activeArka.id, payer.id)]
    ?? activeArka.selectedAsset
  const paymentAsset = savedPaymentAsset === 'USDT' && !usdtAvailable ? 'NIM' : savedPaymentAsset
  const payerId = payer.id
  const remainingPayment = getRemainingPaymentAmounts(payer)
  const cashbackFiat = Math.min(remainingPayment.amountFiat, 10) * 0.01
  const returnTo = payerRole === 'host' ? `/arka/${activeArka.id}/host/summary` : `/arka/${activeArka.id}/guest`
  const paymentPath = payerRole === 'host' ? `/arka/${activeArka.id}/host/pay` : `/arka/${activeArka.id}/pay`
  const successPath = payerRole === 'host'
    ? `/arka/${activeArka.id}/host/payment-success`
    : `/arka/${activeArka.id}/payment-success`
  const walletSurfaceName = getNimiqWalletSurfaceName()

  async function handlePay() {
    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      const payment = await simulateGuestPayment(activeArka.id, payerId, paymentAsset)

      if (payment.status === 'confirmed') {
        navigate(successPath)
        return
      }

      const errorPath = payment.error?.code === 'insufficient-balance'
        ? '/error/insufficient-balance'
        : '/error/payment-failed'

      navigate(errorPath, {
        state: {
          returnTo,
          retryTo: paymentPath,
          arkaName: activeArka.name,
          amount: paymentAsset === 'NIM' ? remainingPayment.amountNim : remainingPayment.amountUsdt,
          asset: paymentAsset,
          errorCode: payment.error?.code,
        },
      })
    } catch {
      navigate('/error/payment-failed', {
        state: {
          returnTo,
          retryTo: paymentPath,
          arkaName: activeArka.name,
          amount: paymentAsset === 'NIM' ? remainingPayment.amountNim : remainingPayment.amountUsdt,
          asset: paymentAsset,
          errorCode: 'unknown-error',
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <MobileScreen withBottomAction>
      <ScreenContainer>
        <header className="flex min-h-12 items-center gap-3">
          <Link
            aria-label="Go back to Arka"
            className="grid size-12 place-items-center rounded-2xl border border-[#eadcc8] bg-white/90 text-arka-text shadow-[0_4px_8px_rgba(27,28,25,0.05)]"
            to={returnTo}
          >
            <NimiqArrowLeft size={21} />
          </Link>
          <div><p className="text-xs font-bold text-arka-muted">{payerRole === 'host' ? 'Your host share' : 'Your share'}</p><h1 className="arka-page-title">Confirm payment</h1></div>
        </header>

        <p className="text-sm font-semibold leading-6 text-arka-muted">Review the details and choose your payment asset before continuing to {walletSurfaceName}.</p>

        <PaymentSummaryCard arka={activeArka} member={payer} asset={paymentAsset} />

        <section aria-labelledby="payment-asset"><h2 id="payment-asset" className="text-base font-black">Choose how to pay</h2><p className="mt-1 text-sm font-semibold text-arka-muted">{usdtAvailable ? 'NIM is preferred and unlocks cashback. USDT is also available.' : 'NIM is available on this device. USDT requires the EVM wallet inside Nimiq Pay.'}</p><div className="mt-3"><AssetSelector value={paymentAsset} disabledAssets={usdtAvailable ? [] : ['USDT']} onChange={(asset) => setPaymentAsset(activeArka.id, payer.id, asset)} /></div></section>

        <section className={`rounded-[1.4rem] border p-4 shadow-[0_8px_20px_rgba(125,87,0,0.08)] ${paymentAsset === 'NIM' ? 'border-[#e7c95e] bg-[#fff3c7]' : 'border-[#e5ded4] bg-white'}`} aria-live="polite">
          <div className="flex items-start gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${paymentAsset === 'NIM' ? 'bg-[#1b1c19] text-[#f7c842]' : 'bg-[#f2efe8] text-arka-muted'}`}><Gift size={21} /></span><div><p className="text-base font-black">{paymentAsset === 'NIM' ? 'Your NIM cashback is ready' : 'NIM unlocks cashback'}</p><p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">{paymentAsset === 'NIM' ? `You are eligible for 1% back on the first $10 of this share — up to ${formatUsd(cashbackFiat)} in NIM value.` : 'Switch to NIM in your Arka to earn 1% cashback on the first $10 of your share.'}</p></div></div>
        </section>

        <p className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-arka-muted">
          <ShieldCheck aria-hidden="true" className="shrink-0 text-[#c88700]" size={20} strokeWidth={2} />
          Your payment will be confirmed in {walletSurfaceName}.
        </p>
      </ScreenContainer>

      <BottomActionBar aboveBottomNav>
        <Button
          aria-busy={isSubmitting}
          className="justify-between"
          type="button"
          onClick={handlePay}
          disabled={isSubmitting}
        >
          <span className="grid size-5 place-items-center" aria-hidden="true">
            {isSubmitting ? <Loader2 className="animate-spin" size={19} /> : null}
          </span>
          <span>{isSubmitting ? `Preparing ${walletSurfaceName}…` : `Continue in ${walletSurfaceName}`}</span>
          <NimiqArrowRight aria-hidden="true" size={20} />
        </Button>
      </BottomActionBar>
    </MobileScreen>
  )
}

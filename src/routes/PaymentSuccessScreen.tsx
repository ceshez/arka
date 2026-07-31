import { Check, Clock3, Gift, Share2, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { PaymentReceiptCard } from '../components/arka/PaymentReceiptCard'
import { SuccessCard } from '../components/arka/SuccessCard'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqArrowRight } from '../components/ui/NimiqIcon'
import { formatNim } from '../lib/arka/formatMoney'
import { buildPaymentReceiptShareText } from '../lib/arka/paymentReceipt'
import { calculateCashbackReward } from '../lib/payments/cashback'
import { paymentAssetSelectionKey, useArkaStore } from '../store/arkaStore'
import { getGuestMember, getHostMember } from './routeUtils'

export function PaymentSuccessScreen({ payerRole = 'guest' }: { payerRole?: 'guest' | 'host' }) {
  const { arkaId } = useParams()
  const [shareFeedback, setShareFeedback] = useState('Share payment')
  const [isShareCardOpen, setIsShareCardOpen] = useState(false)
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const currentGuestMemberId = useArkaStore((state) => (
    arkaId ? state.guestMemberIdsByArka[arkaId] : state.currentGuestMemberId
  ))
  const activePayment = useArkaStore((state) => state.activePayment)
  const payments = useArkaStore((state) => state.payments)
  const paymentAssetSelections = useArkaStore((state) => state.paymentAssetSelections)

  if (!arka) return <Navigate to="/error/arka-not-found" replace />

  const activeArka = arka
  const payer = payerRole === 'host' ? getHostMember(activeArka) : getGuestMember(activeArka, currentGuestMemberId)
  if (!payer) return <Navigate to="/join" replace />

  const returnTo = payerRole === 'host' ? `/arka/${activeArka.id}/host/summary` : `/arka/${activeArka.id}/guest`
  const confirmedPayment = activePayment?.arkaId === activeArka.id
    && activePayment.payerUserId === payer.userId
    && activePayment.status === 'confirmed'
    ? activePayment
    : payments.find((payment) => (
        payment.arkaId === activeArka.id
          && payment.payerUserId === payer.userId
          && payment.status === 'confirmed'
      ))
  const pendingVerification = activePayment?.arkaId === activeArka.id
    && activePayment.payerUserId === payer.userId
    && activePayment.status === 'submitted'
    ? activePayment
    : undefined
  const paymentAsset = confirmedPayment?.asset
    ?? pendingVerification?.asset
    ?? paymentAssetSelections[paymentAssetSelectionKey(activeArka.id, payer.id)]
    ?? activeArka.selectedAsset
  if (!confirmedPayment && !pendingVerification && payer.status !== 'paid') {
    return <Navigate to={returnTo} replace />
  }
  const confirmedPayer = payer
  const cashbackReward = payerRole === 'guest' && confirmedPayment?.asset === 'NIM' && payer.status === 'paid'
    ? calculateCashbackReward(payer)
    : undefined

  async function sharePayment() {
    const text = buildPaymentReceiptShareText({ arka: activeArka, member: confirmedPayer, asset: paymentAsset, payment: confirmedPayment })

    try {
      if (navigator.share) {
        await navigator.share({ title: `Payment receipt for ${activeArka.name}`, text })
        setShareFeedback('Payment shared')
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.append(textArea)
        textArea.select()
        const copied = document.execCommand('copy')
        textArea.remove()
        if (!copied) throw new Error('Copy unavailable')
      }
      setShareFeedback('Copied to clipboard')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareFeedback('Sharing unavailable')
    }
  }

  const shareFinished = shareFeedback === 'Payment shared' || shareFeedback === 'Copied to clipboard'

  return (
    <MobileScreen withBottomAction>
      <ScreenContainer>
        <ArkaHeader title="Payment received" subtitle={activeArka.name} backTo={returnTo} />

        {pendingVerification && payer.status !== 'paid' ? (
          <Card className="mt-6 border-[#ead28c] bg-[#fff9e9] p-6 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#f7d772] text-[#5f4100]"><Clock3 size={29} /></span>
            <h1 className="mt-5 text-2xl font-black">Contribution sent</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">Arka is verifying the mainnet transaction before adding it to the shared fund history. You will not be asked to pay again.</p>
            <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[#7d5700]">Verification retries automatically.</p>
          </Card>
        ) : (
          <>
            <SuccessCard arka={activeArka} member={payer} asset={paymentAsset} payment={confirmedPayment} />
            {cashbackReward && cashbackReward.amountNim > 0 ? (
              <Card className="flex items-start gap-3 border-[#e7c95e] bg-[#fff8e7] p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#1b1c19] text-[#f7c842]"><Gift size={20} /></span>
                <div>
                  <h2 className="text-sm font-black">3% NIM cashback eligible</h2>
                  <p className="mt-1 text-lg font-black text-[#6d4b00]">{formatNim(cashbackReward.amountNim)}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-arka-muted">The host sends this as a separate NIM payment. It appears in NIM Earn only after confirmation in Nimiq Pay.</p>
                </div>
              </Card>
            ) : null}
          </>
        )}
      </ScreenContainer>

      <BottomActionBar aboveBottomNav>
        <ButtonLink className="justify-between" to={returnTo}>
          <span className="size-5" aria-hidden="true" />
          <span>Back to Arka</span>
          <NimiqArrowRight aria-hidden="true" size={20} />
        </ButtonLink>
        <Button variant="secondary" type="button" disabled={Boolean(pendingVerification && payer.status !== 'paid')} onClick={() => setIsShareCardOpen(true)}>
          {shareFinished ? <Check aria-hidden="true" size={19} /> : <Share2 aria-hidden="true" size={19} />}
          <span aria-live="polite">{shareFeedback}</span>
        </Button>
      </BottomActionBar>

      {isShareCardOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#171814]/55 px-3 pb-3 pt-8 backdrop-blur-[3px] sm:items-center sm:py-6"
          role="presentation"
          onClick={() => setIsShareCardOpen(false)}
        >
          <section
            className="max-h-full w-full max-w-[390px] overflow-y-auto rounded-[2rem] bg-arka-bg p-4 pb-[calc(1rem+var(--arka-safe-bottom))] shadow-[0_24px_60px_rgba(27,28,25,0.28)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-receipt-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-4 flex items-center justify-between gap-4 px-1">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-arka-muted">Your receipt</p>
                <h2 id="share-receipt-title" className="mt-1 text-xl font-black tracking-[-0.03em] text-arka-text">Share your payment</h2>
              </div>
              <button
                type="button"
                aria-label="Close share receipt"
                className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#e2dcd2] bg-white text-arka-text active:scale-95"
                onClick={() => setIsShareCardOpen(false)}
              >
                <X size={19} />
              </button>
            </header>

            <PaymentReceiptCard arka={activeArka} member={payer} asset={paymentAsset} payment={confirmedPayment} />

            <div className="mt-4 space-y-2">
              <Button type="button" onClick={sharePayment}>
                {shareFinished ? <Check aria-hidden="true" size={19} /> : <Share2 aria-hidden="true" size={19} />}
                <span aria-live="polite">{shareFinished ? shareFeedback : 'Share receipt'}</span>
              </Button>
              <button
                type="button"
                className="flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-extrabold text-arka-muted active:bg-white/70"
                onClick={() => setIsShareCardOpen(false)}
              >
                Not now
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </MobileScreen>
  )
}

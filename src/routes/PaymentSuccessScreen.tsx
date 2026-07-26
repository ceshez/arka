import { Check, Share2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PaymentReceiptCard } from '../components/arka/PaymentReceiptCard'
import { SuccessCard } from '../components/arka/SuccessCard'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button, ButtonLink } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqArrowLeft, NimiqArrowRight } from '../components/ui/NimiqIcon'
import { buildPaymentReceiptShareText } from '../lib/arka/paymentReceipt'
import { paymentAssetSelectionKey, useArkaStore } from '../store/arkaStore'
import { getGuestMember, getHostMember } from './routeUtils'

export function PaymentSuccessScreen({ payerRole = 'guest' }: { payerRole?: 'guest' | 'host' }) {
  const { arkaId } = useParams()
  const [shareFeedback, setShareFeedback] = useState('Share payment')
  const [isShareCardOpen, setIsShareCardOpen] = useState(false)
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
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
  const paymentAsset = confirmedPayment?.asset
    ?? paymentAssetSelections[paymentAssetSelectionKey(activeArka.id, payer.id)]
    ?? activeArka.selectedAsset
  if (!confirmedPayment && payer.status !== 'paid') {
    return <Navigate to={returnTo} replace />
  }
  const confirmedPayer = payer

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
        <div className="flex min-h-12 items-center">
          <Link
            aria-label="Back to Arka"
            className="grid size-12 place-items-center rounded-2xl border border-[#eadcc8] bg-white/90 text-arka-text shadow-[0_4px_8px_rgba(27,28,25,0.05)]"
            to={returnTo}
          >
            <NimiqArrowLeft size={21} />
          </Link>
        </div>

        <SuccessCard arka={activeArka} member={payer} asset={paymentAsset} payment={confirmedPayment} />
      </ScreenContainer>

      <BottomActionBar aboveBottomNav>
        <ButtonLink className="justify-between" to={returnTo}>
          <span className="size-5" aria-hidden="true" />
          <span>Back to Arka</span>
          <NimiqArrowRight aria-hidden="true" size={20} />
        </ButtonLink>
        <Button variant="secondary" type="button" onClick={() => setIsShareCardOpen(true)}>
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

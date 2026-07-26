import { CircleX, SearchX, Wallet } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ErrorState } from '../components/arka/ErrorState'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { ButtonLink } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { formatNim, formatUsdt } from '../lib/arka/formatMoney'
import { paymentErrors } from '../lib/payments/paymentErrors'
import type { AssetSymbol } from '../types/arka'
import type { PaymentErrorCode } from '../types/payment'

type PaymentErrorContext = {
  returnTo?: string
  retryTo?: string
  arkaName?: string
  amount?: number
  asset?: AssetSymbol
  errorCode?: PaymentErrorCode
}

function usePaymentErrorContext() {
  const location = useLocation()
  return (location.state ?? {}) as PaymentErrorContext
}

export function InsufficientBalanceErrorScreen() {
  const context = usePaymentErrorContext()
  const returnTo = context.returnTo ?? '/'
  const selectedAsset = context.asset ?? 'NIM'

  return (
    <MobileScreen>
      <ScreenContainer className="justify-center py-8">
        <ErrorState
          tone="warning"
          icon={<Wallet size={42} strokeWidth={1.8} />}
          title={`Not enough ${selectedAsset}`}
          message={`You need more ${selectedAsset} to complete this payment. Your Arka is still here.`}
          details={(
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm font-semibold text-arka-muted">Amount needed</dt>
                <dd className="text-right font-extrabold text-arka-text">
                  {context.amount
                    ? selectedAsset === 'NIM' ? formatNim(context.amount) : formatUsdt(context.amount)
                    : `More ${selectedAsset}`}
                </dd>
              </div>
              <div className="h-px bg-[#eee3d1]" />
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm font-semibold text-arka-muted">Selected asset</dt>
                <dd className="font-extrabold text-[#7d5700]">{selectedAsset}</dd>
              </div>
            </dl>
          )}
          primary={<ButtonLink to={returnTo}>Change payment asset</ButtonLink>}
          secondary={<ButtonLink variant="ghost" to="/">Back home</ButtonLink>}
        />
      </ScreenContainer>
    </MobileScreen>
  )
}

export function PaymentFailedErrorScreen() {
  const context = usePaymentErrorContext()
  const returnTo = context.returnTo ?? '/'
  const retryTo = context.retryTo ?? returnTo
  const error = paymentErrors[context.errorCode ?? 'payment-failed']

  return (
    <MobileScreen>
      <ScreenContainer className="justify-center py-8">
        <ErrorState
          icon={<CircleX size={42} strokeWidth={1.8} />}
          title={error.title}
          message={error.message}
          details={(
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[#f5f2ec] text-arka-muted">
                <CircleX size={18} />
              </span>
              <div>
                <p className="font-extrabold text-arka-text">No payment was confirmed</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">
                  {context.arkaName ? `${context.arkaName} was not updated.` : 'Your Arka was not updated.'}
                </p>
              </div>
            </div>
          )}
          primary={<ButtonLink to={retryTo}>Try payment again</ButtonLink>}
          secondary={<ButtonLink variant="ghost" to={returnTo}>Back to Arka</ButtonLink>}
        />
      </ScreenContainer>
    </MobileScreen>
  )
}

export function ArkaNotFoundErrorScreen() {
  return (
    <MobileScreen>
      <ScreenContainer className="justify-center py-8">
        <ErrorState
          tone="neutral"
          icon={<SearchX size={42} strokeWidth={1.8} />}
          title="Arka not found"
          message="This invite may have expired, the code may be incorrect, or the Arka may be closed."
          primary={<ButtonLink to="/join">Try another code</ButtonLink>}
          secondary={<ButtonLink variant="ghost" to="/">Back home</ButtonLink>}
        />
      </ScreenContainer>
    </MobileScreen>
  )
}

import { Check, Gift, LoaderCircle, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'
import {
  confirmCashback,
  listPendingCashback,
  type CashbackClaim,
  type TreasuryAuthorization,
} from '../lib/cashback/cashbackApi'
import { formatNim, formatUsd } from '../lib/arka/formatMoney'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { getNimiqPaymentProvider } from '../lib/nimiq/nimiqClient'
import { requestSharedWalletActivation } from '../lib/nimiq/sharedWalletActivation'
import { normalizeNimiqAddress } from '../lib/nimiq/sharedWalletCrypto'
import { useWalletStore } from '../store/walletStore'

function authorizationMessage(address: string, expiresAt: string) {
  return [
    'Authorize Arka cashback treasury payouts',
    `Address: ${address}`,
    `Expires: ${expiresAt}`,
    'This signature does not move NIM. Each payout still requires Nimiq Pay confirmation.',
  ].join('\n')
}

export function CashbackTreasuryScreen() {
  const wallet = useWalletStore((state) => state.wallet)
  const configuredAddress = import.meta.env.VITE_CASHBACK_TREASURY_ADDRESS?.trim() ?? ''
  const isTreasuryWallet = Boolean(wallet && configuredAddress)
    && normalizeNimiqAddress(wallet?.address) === normalizeNimiqAddress(configuredAddress)
  const [authorization, setAuthorization] = useState<TreasuryAuthorization>()
  const [claims, setClaims] = useState<CashbackClaim[]>([])
  const [status, setStatus] = useState<'idle' | 'authorizing' | 'loading' | 'paying'>('idle')
  const [payingClaimId, setPayingClaimId] = useState<string>()
  const [notice, setNotice] = useState('')
  const pendingTotal = useMemo(
    () => claims.reduce((sum, claim) => sum + Number(claim.reward_nim), 0),
    [claims],
  )

  if (!configuredAddress) return <Navigate to="/" replace />

  async function authorizeAndLoad() {
    if (!wallet || !isTreasuryWallet) return
    setStatus('authorizing')
    setNotice('')
    try {
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
      const signature = await requestSharedWalletActivation(
        authorizationMessage(wallet.address, expiresAt),
        wallet.address,
      )
      const nextAuthorization: TreasuryAuthorization = {
        address: wallet.address,
        expiresAt,
        publicKey: signature.publicKey,
        signature: signature.signature,
        signer: signature.signer,
      }
      setAuthorization(nextAuthorization)
      setStatus('loading')
      const result = await listPendingCashback(nextAuthorization)
      setClaims(result.claims)
      setNotice(result.claims.length ? 'Treasury authorized. Confirm each payout in Nimiq Pay.' : 'No cashback payouts are pending.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Treasury authorization failed.')
    } finally {
      setStatus('idle')
    }
  }

  async function refreshClaims() {
    if (!authorization) return
    setStatus('loading')
    setNotice('')
    try {
      const result = await listPendingCashback(authorization)
      setClaims(result.claims)
      setNotice(result.claims.length ? 'Pending payouts refreshed.' : 'No cashback payouts are pending.')
    } catch (error) {
      setAuthorization(undefined)
      setClaims([])
      setNotice(error instanceof Error ? error.message : 'Treasury authorization expired.')
    } finally {
      setStatus('idle')
    }
  }

  async function payClaim(claim: CashbackClaim) {
    if (!authorization || !wallet || !isTreasuryWallet) return
    setStatus('paying')
    setPayingClaimId(claim.id)
    setNotice('')
    try {
      const provider = await getNimiqPaymentProvider()
      const payment = await provider.requestPayment({
        arkaId: claim.arka_id,
        payerUserId: 'cashback-treasury',
        senderWalletAddress: configuredAddress,
        recipientWalletAddress: claim.recipient_wallet_address,
        recipientLabel: `Arka ${claim.arka_code} cashback`,
        asset: 'NIM',
        amountFiat: Number(claim.reward_fiat),
        amountNim: Number(claim.reward_nim),
        memo: `Arka ${claim.arka_code} cashback`,
        isDemo: false,
      })
      if (payment.status !== 'confirmed' || !payment.transactionHash) {
        throw new Error(payment.status === 'cancelled'
          ? 'Cashback payout was cancelled.'
          : 'Cashback payout was not confirmed.')
      }
      await confirmCashback({
        authorization,
        claimId: claim.id,
        transactionHash: payment.transactionHash,
      })
      setClaims((current) => current.filter((candidate) => candidate.id !== claim.id))
      setNotice(`Cashback sent to ${formatWalletAddress(claim.recipient_wallet_address)}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Cashback payout failed.')
    } finally {
      setStatus('idle')
      setPayingClaimId(undefined)
    }
  }

  return (
    <MobileScreen showBottomNav={false}>
      <ScreenContainer>
        <ArkaHeader title="Cashback treasury" subtitle="Protected NIM payouts" backTo="/" />

        <Card className="border-[#e7c95e] bg-[#fff8e7]">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#1b1c19] text-[#f7c842]">
            <ShieldCheck size={22} />
          </span>
          <h2 className="mt-4 text-lg font-black">Human-verified rewards</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">
            Claims are limited to one per recipient and installation each day. Arka verifies the original payment and every treasury payout on Nimiq mainnet.
          </p>
        </Card>

        {!isTreasuryWallet ? (
          <Card>
            <WalletCards size={23} className="text-[#7d5700]" />
            <h2 className="mt-3 text-base font-black">Treasury wallet required</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-arka-muted">
              Connect {formatWalletAddress(configuredAddress)} to review and send cashback.
            </p>
          </Card>
        ) : !authorization ? (
          <Button type="button" disabled={status !== 'idle'} onClick={() => void authorizeAndLoad()}>
            {status === 'authorizing' ? <LoaderCircle className="animate-spin" size={19} /> : <ShieldCheck size={19} />}
            {status === 'authorizing' ? 'Authorizing…' : 'Authorize treasury'}
          </Button>
        ) : (
          <>
            <Card className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-arka-muted">Pending total</p>
                <p className="mt-1 text-2xl font-black">{formatNim(pendingTotal)}</p>
                <p className="mt-1 text-xs font-bold text-arka-muted">{claims.length} pending {claims.length === 1 ? 'reward' : 'rewards'}</p>
              </div>
              <button
                type="button"
                className="grid size-12 place-items-center rounded-2xl border border-[#eadcc8] bg-white text-[#7d5700]"
                aria-label="Refresh cashback claims"
                disabled={status !== 'idle'}
                onClick={() => void refreshClaims()}
              >
                <RefreshCw className={status === 'loading' ? 'animate-spin' : ''} size={20} />
              </button>
            </Card>

            <div className="space-y-3">
              {claims.map((claim) => (
                <Card key={claim.id}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff2ca] text-[#7d5700]"><Gift size={19} /></span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-black">{claim.arka_code}</h2>
                      <p className="mt-1 text-xs font-semibold text-arka-muted">{formatWalletAddress(claim.recipient_wallet_address)}</p>
                      <p className="mt-3 text-xl font-black">{formatNim(Number(claim.reward_nim))}</p>
                      <p className="text-xs font-bold text-arka-muted">{formatUsd(Number(claim.reward_fiat))} cashback</p>
                    </div>
                  </div>
                  <Button
                    className="mt-4"
                    type="button"
                    disabled={status !== 'idle'}
                    onClick={() => void payClaim(claim)}
                  >
                    {payingClaimId === claim.id ? <LoaderCircle className="animate-spin" size={18} /> : <Check size={18} />}
                    {payingClaimId === claim.id ? 'Confirming…' : 'Send from treasury'}
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}

        {notice ? <p className="text-center text-sm font-bold leading-6 text-arka-muted" role="status">{notice}</p> : null}
      </ScreenContainer>
    </MobileScreen>
  )
}

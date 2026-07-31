import { useEffect, useState } from 'react'
import { CircleCheck, Clock3, Copy, ExternalLink, LoaderCircle, RefreshCw, RotateCcw, ScanLine, ShieldCheck, StickyNote, Store, WalletCards } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { QrScannerView } from '../components/arka/InviteQrScannerSheet'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqHexagon, NimiqTransfer } from '../components/ui/NimiqIcon'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { formatNim, formatUsd, formatUsdt } from '../lib/arka/formatMoney'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { getSettlementReadiness } from '../lib/arka/getSettlementReadiness'
import { getNimiqWalletSurfaceName } from '../lib/nimiq/detectNimiqEnvironment'
import { parseNimiqPaymentQr } from '../lib/nimiq/parseNimiqPaymentQr'
import { isValidNimiqAddress } from '../lib/nimiq/sharedWalletCrypto'
import { useArkaStore } from '../store/arkaStore'
import type { Arka } from '../types/arka'

const MULTISIG_URL = 'https://multisig.nimiq.com'

function SharedSettlementScreen({ arka }: { arka: Arka }) {
  const navigate = useNavigate()
  const prepare = useArkaStore((state) => state.prepareSharedSettlement)
  const check = useArkaStore((state) => state.checkSharedSettlement)
  const requestRefund = useArkaStore((state) => state.requestSharedRefund)
  const [busy, setBusy] = useState<'prepare' | 'check' | 'refund' | null>(null)
  const [notice, setNotice] = useState('')
  const [recipientWallet, setRecipientWallet] = useState(arka.recipientWalletAddress ?? '')
  const [recipientLabel, setRecipientLabel] = useState(arka.recipientLabel ?? '')
  const [recipientTouched, setRecipientTouched] = useState(false)
  const proposal = arka.settlementProposal
  const recipientIsValid = isValidNimiqAddress(recipientWallet)

  useEffect(() => {
    if (!proposal || proposal.status === 'confirmed' || arka.status === 'completed') return
    const timer = window.setInterval(() => {
      void check(arka.id)
        .then((updated) => {
          if (updated.status === 'completed') navigate(`/arka/${updated.id}/completed`, { replace: true })
        })
        .catch(() => undefined)
    }, 12_000)
    return () => window.clearInterval(timer)
  }, [arka.id, arka.status, check, navigate, proposal])

  async function preparePayment() {
    setBusy('prepare')
    setNotice('')
    setRecipientTouched(true)
    if (!recipientIsValid) {
      setNotice('Enter a valid Nimiq recipient wallet.')
      setBusy(null)
      return
    }
    try {
      await prepare(arka.id, {
        recipientWalletAddress: recipientWallet.trim(),
        recipientLabel: recipientLabel.trim() || undefined,
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The final payment could not be prepared.')
    } finally {
      setBusy(null)
    }
  }

  async function checkMainnet() {
    setBusy('check')
    setNotice('')
    try {
      const updated = await check(arka.id)
      if (updated.status === 'completed') navigate(`/arka/${updated.id}/completed`, { replace: true })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The payment is not confirmed yet.')
    } finally {
      setBusy(null)
    }
  }

  async function startRefund() {
    setBusy('refund')
    setNotice('')
    try {
      await requestRefund(arka.id)
      setNotice('Refund instructions are ready. Each return must be created and approved in Nimiq Multisig.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The refund plan could not be prepared.')
    } finally {
      setBusy(null)
    }
  }

  async function copyValue(value: string, label: string) {
    await navigator.clipboard.writeText(value)
    setNotice(`${label} copied.`)
  }

  return (
    <MobileScreen>
      <ScreenContainer className="gap-4">
        <ArkaHeader title="Final payment" subtitle={arka.name} backTo={`/arka/${arka.id}/host/summary`} />
        <Card className="border-[#ead28c] bg-[#fff9e9] p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#f7d772] text-[#5f4100]"><ShieldCheck size={24} /></span>
          <h1 className="mt-4 text-2xl font-black">Fund complete</h1>
          <p className="mt-1 text-4xl font-black tracking-[-0.04em]">{formatUsd(arka.totalFiat)}</p>
          <p className="mt-1 text-sm font-bold text-arka-muted">≈ {formatNim(arka.totalNimEstimate)}</p>
          <p className="mt-3 text-sm font-semibold text-arka-muted">The shared wallet requires {arka.approvalThreshold} approvals for the final transfer.</p>
        </Card>

        {!proposal ? (
          <Card className="p-4">
            <h2 className="text-base font-black">Who will receive the fund?</h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">Choose the recipient now that collection is complete. It becomes locked when you prepare the final payment.</p>
            <label className="mt-4 grid gap-1.5 text-sm font-black" htmlFor="shared-recipient-wallet">
              Recipient wallet
              <input
                id="shared-recipient-wallet"
                value={recipientWallet}
                onChange={(event) => setRecipientWallet(event.target.value)}
                onBlur={() => setRecipientTouched(true)}
                placeholder="NQ…"
                aria-invalid={recipientTouched && !recipientIsValid}
                className={`min-h-12 rounded-xl border bg-[#fffdf8] px-3 font-mono text-sm outline-none focus:border-[#e9b213] ${recipientTouched && !recipientIsValid ? 'border-arka-error' : 'border-[#dfd5c4]'}`}
              />
            </label>
            {recipientTouched && !recipientIsValid ? <p className="mt-1 text-sm font-semibold text-arka-error">Enter a valid Nimiq wallet.</p> : null}
            <label className="mt-3 grid gap-1.5 text-sm font-black" htmlFor="shared-recipient-label">
              Recipient name <span className="font-semibold text-arka-muted">optional</span>
              <input
                id="shared-recipient-label"
                value={recipientLabel}
                onChange={(event) => setRecipientLabel(event.target.value)}
                placeholder="e.g. Café Central"
                maxLength={80}
                className="min-h-12 rounded-xl border border-[#dfd5c4] bg-[#fffdf8] px-3 text-sm font-semibold outline-none focus:border-[#e9b213]"
              />
            </label>
            <p className="mt-4 text-sm font-semibold leading-5 text-arka-muted">Arka locks the exact source, recipient, amount and memo. The official Multisig app collects the approvals and sends the NIM.</p>
            <Button type="button" className="mt-4" disabled={Boolean(busy) || !recipientIsValid} onClick={() => void preparePayment()}>
              {busy === 'prepare' ? <LoaderCircle className="animate-spin" size={19} /> : <NimiqTransfer size={19} />}
              {busy === 'prepare' ? 'Preparing…' : 'Prepare final payment'}
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-arka-muted">Send to</p>
              <p className="mt-2 text-lg font-black">{proposal.recipientLabel || 'Final recipient'}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-arka-muted">{formatWalletAddress(proposal.recipientWalletAddress)}</p>
            </Card>
            <Card className="p-4">
              <h2 className="text-base font-black">Payment instructions</h2>
              <div className="mt-3 grid gap-2">
                {[
                  ['Wallet', proposal.recipientWalletAddress],
                  ['Amount', `${proposal.amountNim} NIM`],
                  ['Message', proposal.memo],
                ].map(([label, value]) => (
                  <button key={label} type="button" onClick={() => void copyValue(value, label)} className="flex min-h-14 items-center gap-3 rounded-xl bg-[#f6f2e9] px-3 text-left">
                    <Copy size={17} className="shrink-0 text-[#7d5700]" />
                    <span className="min-w-0 flex-1"><small className="block font-bold text-arka-muted">{label}</small><strong className="block truncate text-sm">{value}</strong></span>
                  </button>
                ))}
              </div>
              <a href={MULTISIG_URL} target="_blank" rel="noreferrer" className="mt-4 flex min-h-13 items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#f8d66c] to-[#e9b213] text-sm font-black text-[#2f2305]">Open Nimiq Multisig <ExternalLink size={17} /></a>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-black">Waiting for approvals</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">Arka checks mainnet for the exact transfer. It completes only when source, recipient and amount match.</p>
              <Button type="button" variant="secondary" className="mt-3" disabled={Boolean(busy)} onClick={() => void checkMainnet()}>{busy === 'check' ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}Check mainnet</Button>
            </Card>
          </>
        )}

        {notice ? <p role="status" className="rounded-xl bg-[#f3efe6] p-3 text-sm font-semibold text-arka-muted">{notice}</p> : null}
        <button type="button" disabled={Boolean(busy) || Boolean(arka.refundPlan)} onClick={() => void startRefund()} className="min-h-11 text-sm font-black text-[#8b3a2d] disabled:text-arka-muted">
          <RotateCcw className="mr-2 inline" size={17} />{arka.refundPlan ? 'Refund plan requested' : 'Request assisted refunds'}
        </button>
        <p className="text-center text-xs font-semibold leading-5 text-arka-muted">Refunds are not automatic. The group must approve each return in Nimiq Multisig.</p>
      </ScreenContainer>
    </MobileScreen>
  )
}

export function SettlePaymentScreen() {
  const { arkaId } = useParams()
  const navigate = useNavigate()
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const simulateHostSettlement = useArkaStore((state) => state.simulateHostSettlement)
  const updateSettlementDetails = useArkaStore((state) => state.updateSettlementDetails)
  const [merchantName, setMerchantName] = useState(arka?.metadata?.locationName ?? '')
  const [merchantWallet, setMerchantWallet] = useState(arka?.merchantWalletAddress ?? '')
  const [note, setNote] = useState(arka?.metadata?.note ?? '')
  const [scanFeedback, setScanFeedback] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isSettling, setIsSettling] = useState(false)

  if (!arka) return <Navigate to="/error/arka-not-found" replace />
  if (arka.status === 'completed') return <Navigate to={`/arka/${arka.id}/completed`} replace />
  if (arka.fundingMode === 'shared-wallet') return <SharedSettlementScreen arka={arka} />
  const activeArka = arka

  const progress = calculateArkaProgress(arka)
  const readiness = getSettlementReadiness(arka)
  const asset = readiness.asset
  const hasRecipient = isValidNimiqAddress(merchantWallet)
  const amount = asset === 'USDT' ? readiness.usdtTarget : readiness.nimTarget
  const walletSurfaceName = getNimiqWalletSurfaceName()

  function handleRecipientScan(recipient: string) {
    setMerchantWallet(recipient)
    setScanFeedback('Recipient wallet scanned and verified.')
    setScannerOpen(false)
  }

  async function handleSettle() {
    if (!readiness.canSettle || !asset || !hasRecipient || isSettling) return
    updateSettlementDetails(activeArka.id, { merchantWalletAddress: merchantWallet.trim(), merchantName, note })
    setIsSettling(true)
    try {
      const payment = await simulateHostSettlement(activeArka.id, asset)
      navigate(payment.status === 'confirmed' ? `/arka/${activeArka.id}/completed` : '/error/payment-failed', {
        state: payment.status === 'confirmed' ? undefined : { returnTo: `/arka/${activeArka.id}/host/summary`, retryTo: `/arka/${activeArka.id}/settle`, arkaName: activeArka.name, amount, asset, errorCode: payment.error?.code },
      })
    } catch {
      navigate('/error/payment-failed', { state: { returnTo: `/arka/${activeArka.id}/host/summary`, retryTo: `/arka/${activeArka.id}/settle`, arkaName: activeArka.name, amount, asset, errorCode: 'unknown-error' } })
    } finally {
      setIsSettling(false)
    }
  }

  const collectedAssets = [progress.collectedNim > 0.01 ? formatNim(progress.collectedNim) : null, progress.collectedUsdt > 0.01 ? formatUsdt(progress.collectedUsdt) : null].filter(Boolean).join(' + ')

  return (
    <MobileScreen withBottomAction>
      <ScreenContainer className="gap-5">
        <ArkaHeader title="Pay merchant" subtitle="Final payment" backTo={`/arka/${arka.id}/host/summary`} />

        <Card className="grid grid-cols-3 divide-x divide-[#eee0c9] p-4 text-center">
          <div><p className="text-xs font-semibold text-arka-muted">Collected</p><strong className="mt-1 block">{formatUsd(progress.collectedFiat)}</strong><small className="text-[#8a640d]">{collectedAssets}</small></div>
          <div><p className="text-xs font-semibold text-arka-muted">Asset</p><strong className="mt-1 block">{asset ?? 'Review'}</strong><small className="text-[#8a640d]">Nimiq Pay</small></div>
          <div><p className="text-xs font-semibold text-arka-muted">Status</p><strong className={readiness.canSettle ? 'mt-1 flex items-center justify-center gap-1 text-[#197334]' : 'mt-1 flex items-center justify-center gap-1 text-[#8d5c00]'}>{readiness.canSettle ? <CircleCheck size={16} /> : <Clock3 size={16} />}{readiness.canSettle ? 'Ready' : 'Pending'}</strong><small className="text-arka-muted">{Math.round(progress.progressPercent)}%</small></div>
        </Card>

        <section aria-labelledby="recipient-title">
          <h2 id="recipient-title" className="text-lg font-black">Who are you paying?</h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">Scan the recipient’s Nimiq QR with the camera, choose a saved QR image, or enter the wallet address manually.</p>
          <Button type="button" className="mt-3" onClick={() => setScannerOpen(true)}><ScanLine size={19} /> Open camera scanner</Button>
          {scanFeedback ? <p className="mt-2 text-xs font-bold text-[#7d5700]" role="status">{scanFeedback}</p> : null}
        </section>

        <Card className="space-y-4 p-4" aria-label="Merchant details">
          <label className="grid gap-1.5 text-sm font-black"><span className="flex items-center gap-2"><Store size={17} />Merchant name <small className="font-semibold text-arka-muted">optional</small></span><input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} placeholder="e.g. Café Central" className="min-h-12 rounded-xl border border-[#dfd5c4] bg-[#fffdf8] px-3 font-semibold outline-none focus:border-[#e9b213]" /></label>
          <label className="grid gap-1.5 text-sm font-black">
            <span className="flex items-center gap-2"><WalletCards size={17} />Recipient wallet <small className="font-semibold text-arka-muted">QR or manual</small></span>
            <input
              value={merchantWallet}
              onChange={(event) => {
                setMerchantWallet(event.target.value.toUpperCase())
                setScanFeedback('')
              }}
              placeholder="NQXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={merchantWallet.trim().length > 0 && !hasRecipient}
              className={`min-h-14 rounded-xl border bg-[#fffdf8] px-3 font-mono text-sm font-semibold outline-none focus:border-[#e9b213] ${merchantWallet.trim().length > 0 && !hasRecipient ? 'border-arka-error' : hasRecipient ? 'border-[#7dc78d] text-[#155f2b]' : 'border-[#dfd5c4]'}`}
            />
            {merchantWallet.trim().length > 0 && !hasRecipient ? <span className="text-xs font-semibold text-arka-error">Enter a valid Nimiq wallet address.</span> : null}
          </label>
          <label className="grid gap-1.5 text-sm font-black"><span className="flex items-center gap-2"><StickyNote size={17} />Notes <small className="font-semibold text-arka-muted">optional</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={`Settlement for ${arka.name}`} rows={3} className="rounded-xl border border-[#dfd5c4] bg-[#fffdf8] px-3 py-2 text-sm font-semibold outline-none focus:border-[#e9b213]" /></label>
          <div className="flex items-center gap-3 rounded-xl bg-[#fff8e8] p-3"><NimiqHexagon className="shrink-0 text-[#a46f00]" size={22} /><p className="text-xs font-semibold leading-4"><strong className="block">Collected by the host, settled with {walletSurfaceName}.</strong>Your settlement will be confirmed in {walletSurfaceName}.</p></div>
        </Card>
      </ScreenContainer>

      <BottomActionBar aboveBottomNav>
        <Button type="button" onClick={handleSettle} disabled={!readiness.canSettle || !hasRecipient || isSettling}>{isSettling ? <><LoaderCircle className="animate-spin" size={19} />Confirming…</> : <><NimiqTransfer size={19} />{hasRecipient ? `Pay merchant with ${asset}` : 'Scan recipient to continue'}</>}</Button>
      </BottomActionBar>

      <BottomSheet open={scannerOpen} title="Scan recipient wallet" eyebrow="Final payment" onClose={() => setScannerOpen(false)}>
        <QrScannerView
          active={scannerOpen}
          onScan={handleRecipientScan}
          parseValue={parseNimiqPaymentQr}
          invalidQrMessage="That QR does not contain a valid Nimiq wallet address."
          activeMessage="Point your camera at the recipient wallet QR. The address fills in automatically."
          fallbackMessage="Choose a saved QR photo, or close the scanner and enter the address manually."
        />
        <Button className="mt-2" type="button" variant="ghost" onClick={() => setScannerOpen(false)}>Enter address manually</Button>
      </BottomSheet>
    </MobileScreen>
  )
}

import { useRef, useState } from 'react'
import { Camera, CircleCheck, Clock3, Image, LoaderCircle, ScanLine, StickyNote, Store, WalletCards } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqArrowLeft, NimiqHexagon, NimiqTransfer } from '../components/ui/NimiqIcon'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { formatNim, formatUsd, formatUsdt } from '../lib/arka/formatMoney'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { getSettlementReadiness } from '../lib/arka/getSettlementReadiness'
import { getNimiqWalletSurfaceName } from '../lib/nimiq/detectNimiqEnvironment'
import { useArkaStore } from '../store/arkaStore'

type BarcodeDetectorInstance = { detect: (source: ImageBitmap) => Promise<Array<{ rawValue: string }>> }
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance

function recipientFromQr(value: string) {
  const decoded = decodeURIComponent(value)
  const match = decoded.match(/NQ[0-9A-Z ]{20,}/i)
  return match?.[0].trim().toUpperCase()
}

export function SettlePaymentScreen() {
  const { arkaId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const simulateHostSettlement = useArkaStore((state) => state.simulateHostSettlement)
  const updateSettlementDetails = useArkaStore((state) => state.updateSettlementDetails)
  const [merchantName, setMerchantName] = useState(arka?.metadata?.locationName ?? '')
  const [merchantWallet, setMerchantWallet] = useState(arka?.merchantWalletAddress ?? '')
  const [note, setNote] = useState(arka?.metadata?.note ?? '')
  const [scanFeedback, setScanFeedback] = useState('')
  const [isSettling, setIsSettling] = useState(false)

  if (!arka) return <Navigate to="/error/arka-not-found" replace />
  if (arka.status === 'completed') return <Navigate to={`/arka/${arka.id}/completed`} replace />
  const activeArka = arka

  const progress = calculateArkaProgress(arka)
  const readiness = getSettlementReadiness(arka)
  const asset = readiness.asset
  const hasRecipient = merchantWallet.trim().toUpperCase().startsWith('NQ') && merchantWallet.trim().length > 10
  const amount = asset === 'USDT' ? readiness.usdtTarget : readiness.nimTarget
  const walletSurfaceName = getNimiqWalletSurfaceName()

  async function handleQrImage(file?: File) {
    if (!file) return
    try {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
      if (!Detector) throw new Error('QR scanning is not supported in this browser')
      const bitmap = await createImageBitmap(file)
      const [result] = await new Detector({ formats: ['qr_code'] }).detect(bitmap)
      bitmap.close()
      if (!result?.rawValue) throw new Error('No QR code found')
      const recipient = recipientFromQr(result.rawValue)
      if (!recipient) throw new Error('This QR does not contain a Nimiq wallet')
      setMerchantWallet(recipient)
      setScanFeedback('Recipient scanned')
    } catch (error) {
      setScanFeedback(error instanceof Error ? `${error.message}. Try another QR or use the demo scan.` : 'Could not scan this QR.')
    }
  }

  function useDemoRecipient() {
    setMerchantWallet('NQ76 DEMO MERCHANT WALLET 0000 0000')
    setScanFeedback('Demo QR scanned. Recipient ready.')
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
        <header className="flex items-center gap-3">
          <Link to={`/arka/${arka.id}/host/summary`} aria-label="Back to Arka" className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#e2dcd2] bg-white"><NimiqArrowLeft size={20} /></Link>
          <div><p className="text-xs font-bold text-arka-muted">Final payment</p><h1 className="arka-page-title">Pay merchant</h1></div>
        </header>

        <Card className="grid grid-cols-3 divide-x divide-[#eee0c9] p-4 text-center">
          <div><p className="text-xs font-semibold text-arka-muted">Collected</p><strong className="mt-1 block">{formatUsd(progress.collectedFiat)}</strong><small className="text-[#8a640d]">{collectedAssets}</small></div>
          <div><p className="text-xs font-semibold text-arka-muted">Asset</p><strong className="mt-1 block">{asset ?? 'Review'}</strong><small className="text-[#8a640d]">Nimiq Pay</small></div>
          <div><p className="text-xs font-semibold text-arka-muted">Status</p><strong className={readiness.canSettle ? 'mt-1 flex items-center justify-center gap-1 text-[#197334]' : 'mt-1 flex items-center justify-center gap-1 text-[#8d5c00]'}>{readiness.canSettle ? <CircleCheck size={16} /> : <Clock3 size={16} />}{readiness.canSettle ? 'Ready' : 'Pending'}</strong><small className="text-arka-muted">{Math.round(progress.progressPercent)}%</small></div>
        </Card>

        <section aria-labelledby="recipient-title">
          <h2 id="recipient-title" className="text-lg font-black">Who are you paying?</h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">Scan the merchant’s Nimiq QR now. Arka does not guess or store a recipient before this step.</p>
          <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void handleQrImage(event.target.files?.[0])} />
          <Button type="button" className="mt-3" onClick={() => fileInputRef.current?.click()}><ScanLine size={19} /> Scan merchant QR</Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="min-h-11 rounded-xl border border-[#e2dcd2] bg-white text-xs font-black"><Image className="mr-1 inline" size={15} />Choose QR image</button>
            <button type="button" onClick={useDemoRecipient} className="min-h-11 rounded-xl border border-[#e2dcd2] bg-white text-xs font-black"><Camera className="mr-1 inline" size={15} />Use demo scan</button>
          </div>
          {scanFeedback ? <p className="mt-2 text-xs font-bold text-[#7d5700]" role="status">{scanFeedback}</p> : null}
        </section>

        <Card className="space-y-4 p-4" aria-label="Merchant details">
          <label className="grid gap-1.5 text-sm font-black"><span className="flex items-center gap-2"><Store size={17} />Merchant name <small className="font-semibold text-arka-muted">optional</small></span><input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} placeholder="e.g. Café Central" className="min-h-12 rounded-xl border border-[#dfd5c4] bg-[#fffdf8] px-3 font-semibold outline-none focus:border-[#e9b213]" /></label>
          <div className="grid gap-1.5 text-sm font-black"><span className="flex items-center gap-2"><WalletCards size={17} />Merchant wallet <small className="font-semibold text-arka-muted">from QR</small></span><div className={`flex min-h-14 items-center rounded-xl px-3 ${hasRecipient ? 'bg-[#edf8ef] text-[#155f2b]' : 'bg-[#f3f0ea] text-arka-muted'}`}><span className="font-mono text-sm font-semibold">{hasRecipient ? formatWalletAddress(merchantWallet) : 'Scan a merchant QR to continue'}</span></div></div>
          <label className="grid gap-1.5 text-sm font-black"><span className="flex items-center gap-2"><StickyNote size={17} />Notes <small className="font-semibold text-arka-muted">optional</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={`Settlement for ${arka.name}`} rows={3} className="rounded-xl border border-[#dfd5c4] bg-[#fffdf8] px-3 py-2 text-sm font-semibold outline-none focus:border-[#e9b213]" /></label>
          <div className="flex items-center gap-3 rounded-xl bg-[#fff8e8] p-3"><NimiqHexagon className="shrink-0 text-[#a46f00]" size={22} /><p className="text-xs font-semibold leading-4"><strong className="block">Collected by the host, settled with {walletSurfaceName}.</strong>Your settlement will be confirmed in {walletSurfaceName}.</p></div>
        </Card>
      </ScreenContainer>

      <BottomActionBar aboveBottomNav>
        <Button type="button" onClick={handleSettle} disabled={!readiness.canSettle || !hasRecipient || isSettling}>{isSettling ? <><LoaderCircle className="animate-spin" size={19} />Confirming…</> : <><NimiqTransfer size={19} />{hasRecipient ? `Pay merchant with ${asset}` : 'Scan recipient to continue'}</>}</Button>
      </BottomActionBar>
    </MobileScreen>
  )
}

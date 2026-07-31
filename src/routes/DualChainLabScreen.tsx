import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { getNimiqPayLanguage } from '../lib/nimiq/detectNimiqEnvironment'
import {
  getEthereumProvider,
  getNimiqProviderPromise,
  getProviderErrorMessage,
  runEthereumFlow,
  runNimiqFlow,
  type EthereumFlowResult,
  type EthereumFlowStep,
  type NimiqFlowResult,
  type NimiqFlowStep,
} from '../lib/nimiq/dualChainClient'

type ActiveFlow = 'nimiq' | 'ethereum' | null

const nimiqStepCopy: Record<NimiqFlowStep, string> = {
  'requesting-nimiq-accounts': 'Approve account sharing in Nimiq Pay…',
  'requesting-nimiq-signing': 'Approve the Nimiq signature in Nimiq Pay…',
}

const ethereumStepCopy: Record<EthereumFlowStep, string> = {
  'requesting-ethereum-accounts': 'Approve Ethereum account access in Nimiq Pay…',
  'requesting-ethereum-signing': 'Approve the Ethereum signature in Nimiq Pay…',
}

function shorten(value: string) {
  return value.length > 28 ? `${value.slice(0, 14)}…${value.slice(-10)}` : value
}

function ResultCard({ title, result }: { title: string; result: NimiqFlowResult | EthereumFlowResult }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#dcebdc] bg-[#f4fbf4] p-4" aria-label={`${title} result`}>
      <div className="flex items-center gap-2 text-[#197334]"><CheckCircle2 size={18} /><p className="text-sm font-black">{title} complete</p></div>
      <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-arka-muted">Account</p>
      <p className="mt-1 break-all font-mono text-xs font-semibold text-arka-text">{result.accounts[0]}</p>
      <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-arka-muted">Signature</p>
      <p className="mt-1 break-all font-mono text-xs font-semibold text-arka-text">{shorten(typeof result.signature === 'string' ? result.signature : result.signature.signature)}</p>
    </div>
  )
}

export function DualChainLabScreen() {
  const [isNimiqConnecting, setIsNimiqConnecting] = useState(true)
  const [nimiqReady, setNimiqReady] = useState(false)
  const [nimiqResult, setNimiqResult] = useState<NimiqFlowResult | null>(null)
  const [ethereumResult, setEthereumResult] = useState<EthereumFlowResult | null>(null)
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null)
  const [status, setStatus] = useState('Preparing wallet providers…')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const language = getNimiqPayLanguage()
  const ethereumAvailable = Boolean(getEthereumProvider())

  useEffect(() => {
    let isMounted = true

    void getNimiqProviderPromise()
      .then(() => {
        if (!isMounted) return
        setNimiqReady(true)
        setStatus('Wallet providers are ready for testing.')
      })
      .catch((error: unknown) => {
        if (!isMounted) return
        setErrorMessage(getProviderErrorMessage(error))
        setStatus('Open this app inside Nimiq Pay to connect.')
      })
      .finally(() => {
        if (isMounted) setIsNimiqConnecting(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function handleNimiqFlow() {
    if (activeFlow || !nimiqReady) return
    setActiveFlow('nimiq')
    setErrorMessage(null)
    setNimiqResult(null)

    try {
      const result = await runNimiqFlow((step) => setStatus(nimiqStepCopy[step]))
      setNimiqResult(result)
      setStatus('Nimiq flow completed.')
    } catch (error: unknown) {
      setErrorMessage(getProviderErrorMessage(error))
      setStatus('Nimiq flow cancelled or failed.')
    } finally {
      setActiveFlow(null)
    }
  }

  async function handleEthereumFlow() {
    if (activeFlow || !ethereumAvailable) return
    setActiveFlow('ethereum')
    setErrorMessage(null)
    setEthereumResult(null)

    try {
      const result = await runEthereumFlow((step) => setStatus(ethereumStepCopy[step]))
      setEthereumResult(result)
      setStatus('Ethereum flow completed.')
    } catch (error: unknown) {
      setErrorMessage(getProviderErrorMessage(error))
      setStatus('Ethereum flow cancelled or failed.')
    } finally {
      setActiveFlow(null)
    }
  }

  return (
    <MobileScreen>
      <ScreenContainer className="gap-4">
        <ArkaHeader title="Wallet test lab" subtitle="Developer test" backTo="/profile" />

        <section>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#a46f00]">Dual-chain Mini App</p>
          <h2 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.04em]">Test both wallet paths.</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">Each button opens two native confirmations: first the account, then a plain-text signature. No funds move.</p>
        </section>

        <Card className="space-y-3 bg-[#fff8e7]">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#f7c842] text-[#3d2a00]"><ShieldCheck size={21} /></span><div><p className="text-sm font-black">Nimiq Pay environment</p><p className="text-xs font-semibold text-arka-muted">Language: {language}</p></div></div>
          <div className="grid gap-2 text-xs font-bold" aria-label="Provider status">
            <p className={nimiqReady ? 'text-[#197334]' : 'text-arka-muted'}>{nimiqReady ? '● Nimiq provider ready' : isNimiqConnecting ? '● Connecting to Nimiq provider…' : '● Nimiq provider unavailable'}</p>
            <p className={ethereumAvailable ? 'text-[#197334]' : 'text-arka-muted'}>{ethereumAvailable ? '● Ethereum provider detected' : '● Ethereum provider unavailable'}</p>
          </div>
        </Card>

        <div className="grid gap-3" aria-label="Dual-chain actions">
          <Card>
            <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff0bd] text-[#7d5700]"><WalletCards size={21} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-base font-black">Nimiq</h3><span className="rounded-full bg-[#f5f1e9] px-2 py-1 text-[10px] font-black text-arka-muted">2 confirmations</span></div><p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">Share a Nimiq account, then sign a test message.</p></div></div>
            <Button className="mt-4" type="button" onClick={() => void handleNimiqFlow()} disabled={Boolean(activeFlow) || isNimiqConnecting || !nimiqReady} aria-busy={activeFlow === 'nimiq'}>
              {activeFlow === 'nimiq' ? <Loader2 className="animate-spin" size={19} /> : <KeyRound size={19} />}{activeFlow === 'nimiq' ? 'Waiting for Nimiq Pay…' : 'Run Nimiq flow'}
            </Button>
            {nimiqResult ? <ResultCard title="Nimiq" result={nimiqResult} /> : null}
          </Card>

          <Card>
            <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eef0ff] text-[#4852a9]"><KeyRound size={21} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-base font-black">Ethereum</h3><span className="rounded-full bg-[#f5f1e9] px-2 py-1 text-[10px] font-black text-arka-muted">2 confirmations</span></div><p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">Connect an Ethereum account, then sign a test message.</p></div></div>
            <Button className="mt-4" type="button" variant="secondary" onClick={() => void handleEthereumFlow()} disabled={Boolean(activeFlow) || !ethereumAvailable} aria-busy={activeFlow === 'ethereum'}>
              {activeFlow === 'ethereum' ? <Loader2 className="animate-spin" size={19} /> : <KeyRound size={19} />}{activeFlow === 'ethereum' ? 'Waiting for Nimiq Pay…' : 'Run Ethereum flow'}
            </Button>
            {ethereumResult ? <ResultCard title="Ethereum" result={ethereumResult} /> : null}
          </Card>
        </div>

        <div className="rounded-2xl border border-[#e5ddd0] bg-white/75 p-4" aria-live="polite">
          <p className="flex items-start gap-2 text-sm font-bold"><AlertCircle className="mt-0.5 shrink-0 text-[#a46f00]" size={17} />{status}</p>
          {errorMessage ? <p className="mt-2 text-sm font-semibold leading-5 text-arka-error">{errorMessage}</p> : null}
        </div>

        <p className="flex items-center justify-center gap-2 pb-2 text-center text-xs font-semibold leading-5 text-arka-muted"><ShieldCheck size={16} className="shrink-0 text-[#a46f00]" />Testnet is recommended for wallet actions.</p>
      </ScreenContainer>
    </MobileScreen>
  )
}

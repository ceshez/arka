import { LoaderCircle, ShieldCheck, WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { ScreenContainer } from '../layout/ScreenContainer'
import { Button } from '../ui/Button'
import { MobileScreen } from '../ui/MobileScreen'
import { useWalletStore } from '../../store/walletStore'

export function WalletConnectionGate({ children }: { children: ReactNode }) {
  const status = useWalletStore((state) => state.status)
  const wallet = useWalletStore((state) => state.wallet)
  const error = useWalletStore((state) => state.error)
  const connect = useWalletStore((state) => state.connect)

  if (wallet) return <>{children}</>

  const connecting = status === 'connecting'

  return (
    <MobileScreen className="bg-[#fffaf5]">
      <ScreenContainer className="grid place-items-center px-5 py-8 text-center">
        <section className="w-full rounded-[1.75rem] border border-[#e6cf94] bg-white/95 p-6 shadow-[0_14px_34px_rgba(125,87,0,0.10)]" aria-labelledby="wallet-gate-title">
          <span className="arka-hex mx-auto grid size-20 place-items-center bg-linear-to-b from-[#f8d66c] to-[#e9b213] text-[#3d2a00] shadow-[0_10px_24px_rgba(125,87,0,0.18)]" aria-hidden="true">
            <WalletCards size={34} strokeWidth={1.9} />
          </span>
          <h1 id="wallet-gate-title" className="mt-6 text-[30px] font-black tracking-[-0.035em] text-[#111b25]">Connect your wallet</h1>
          <p className="mx-auto mt-3 max-w-[300px] text-sm font-semibold leading-6 text-arka-muted">
            Connect with Nimiq Pay before loading, creating, or joining an Arka.
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#fff8e7] p-4 text-left text-sm font-semibold leading-5 text-[#5f4a18]">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#a46f00]" size={20} />
            <p>Your Arkas stay hidden until the wallet connection is confirmed.</p>
          </div>
          {error ? <p className="mt-4 text-sm font-semibold text-arka-error" role="alert">{error}</p> : null}
          <Button type="button" className="mt-6" onClick={() => void connect()} disabled={connecting}>
            <span className="flex items-center justify-center gap-2">
              {connecting ? <LoaderCircle className="animate-spin" size={20} /> : <WalletCards size={20} />}
              {connecting ? 'Connecting wallet...' : 'Connect wallet'}
            </span>
          </Button>
        </section>
      </ScreenContainer>
    </MobileScreen>
  )
}

import { LoaderCircle, Wallet } from 'lucide-react'
import { cn } from '../../lib/utils/cn'
import { useWalletStore } from '../../store/walletStore'
import { MemberIdenticon } from './MemberIdenticon'

export function WalletStatus({ className, showLabel = false, hideWhenDisconnected = false }: { className?: string; showLabel?: boolean; hideWhenDisconnected?: boolean }) {
  const status = useWalletStore((state) => state.status)
  const wallet = useWalletStore((state) => state.wallet)
  const connect = useWalletStore((state) => state.connect)
  const connected = status === 'connected' && wallet

  if (hideWhenDisconnected && !connected) return null

  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={status === 'connecting'}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#e2dcd2] bg-white px-2 text-xs font-black text-arka-text transition active:scale-[0.98] disabled:opacity-70',
        !showLabel && 'size-11 p-0',
        connected && !showLabel && 'rounded-full border-0 bg-transparent',
        className,
      )}
      aria-label={connected ? `Wallet connected with ${wallet.source === 'nimiq-pay' ? 'Nimiq Pay' : 'Nimiq Wallet'}` : 'Connect wallet'}
      title={connected ? `Connected with ${wallet.source === 'nimiq-pay' ? 'Nimiq Pay' : 'Nimiq Wallet'}` : 'Connect wallet'}
    >
      <span className="relative grid size-8 shrink-0 place-items-center rounded-full text-arka-gold-dark">
        {connected ? (
          <MemberIdenticon seed={wallet.address} className="size-8 shadow-none" />
        ) : status === 'connecting' ? (
          <LoaderCircle className="animate-spin" size={19} />
        ) : (
          <Wallet size={19} strokeWidth={1.9} />
        )}
        <span className={cn('absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white', connected ? 'bg-arka-green' : 'bg-[#a7a8a4]')} aria-hidden="true" />
      </span>
      {showLabel ? <span>{connected ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Connect wallet'}</span> : null}
    </button>
  )
}

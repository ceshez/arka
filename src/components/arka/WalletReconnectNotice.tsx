import { LoaderCircle, WalletCards } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useWalletStore } from '../../store/walletStore'
import { MemberIdenticon } from './MemberIdenticon'

function routeHasInlineConnect(pathname: string) {
  if (pathname === '/') return true
  return ['/arkas', '/activity', '/scan', '/profile', '/create', '/join', '/arka/', '/history']
    .some((route) => pathname === route || pathname.startsWith(route))
}

export function WalletReconnectNotice() {
  const location = useLocation()
  const status = useWalletStore((state) => state.status)
  const wallet = useWalletStore((state) => state.wallet)
  const lastConnectedAddress = useWalletStore((state) => state.lastConnectedAddress)
  const error = useWalletStore((state) => state.error)
  const connect = useWalletStore((state) => state.connect)

  if (wallet || routeHasInlineConnect(location.pathname)) return null

  const connecting = status === 'connecting'
  const reconnecting = Boolean(lastConnectedAddress)

  return (
    <aside
      className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto flex max-w-[402px] items-center gap-3 rounded-2xl border border-[#e4ca8c] bg-[#fffdf7]/95 p-3 shadow-[0_12px_30px_rgba(27,28,25,0.16)] backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <span className="relative size-11 shrink-0">
        <MemberIdenticon seed={lastConnectedAddress ?? 'arka-connect-wallet'} className="size-11 border-2 border-white shadow-none" />
        <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-white bg-[#f7c842] text-[#3d2a00]">
          <WalletCards size={12} strokeWidth={2.5} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-black">{reconnecting ? 'Wallet disconnected' : 'Connect your wallet'}</strong>
        <span className="block text-xs font-semibold leading-4 text-arka-muted">
          {error || (reconnecting ? 'Reconnect to load your Arkas.' : 'Connect to create, join, and load Arkas.')}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void connect()}
        disabled={connecting}
        className="pointer-events-auto inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#7d5700] px-3 text-xs font-black text-white transition active:scale-95 disabled:opacity-65"
      >
        {connecting ? <LoaderCircle className="animate-spin" size={15} /> : null}
        {connecting ? 'Connecting' : 'Connect'}
      </button>
    </aside>
  )
}

import { WalletStatus } from './WalletStatus'

export function HomeArkasHeader() {
  return (
    <header className="flex items-center justify-between gap-4" aria-label="Arka navigation">
      <img src="/brand/arka-wordmark-v2-cropped.png" alt="Arka" className="h-9 w-auto max-w-[124px] object-contain" />
      <WalletStatus showLabel />
    </header>
  )
}

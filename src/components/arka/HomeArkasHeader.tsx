import { WalletStatus } from './WalletStatus'

export function HomeArkasHeader({
  title,
  subtitle,
}: {
  title?: string
  subtitle?: string
} = {}) {
  return (
    <div className="grid gap-6">
      <header className="flex items-center justify-between gap-4" aria-label="Arka navigation">
        <img src="/brand/arka-wordmark-v2-cropped.png" alt="Arka" className="h-9 w-auto max-w-[124px] object-contain" />
        <WalletStatus showLabel />
      </header>
      {title ? (
        <section>
          <h1 className="arka-page-title">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">{subtitle}</p> : null}
        </section>
      ) : null}
    </div>
  )
}

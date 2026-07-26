import type { AssetSymbol } from '../../types/arka'
import { cn } from '../../lib/utils/cn'

const assetStyles = {
  NIM: {
    label: 'NIM',
    detail: 'Nimiq',
    icon: 'hex',
  },
  USDT: {
    label: 'USDT',
    detail: 'Tether',
    icon: 'coin',
  },
} as const

export function AssetSelector({
  value,
  onChange,
  disabledAssets = [],
}: {
  value: AssetSymbol
  onChange: (value: AssetSymbol) => void
  disabledAssets?: AssetSymbol[]
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#eadcc8] bg-white p-1">
      {(['NIM', 'USDT'] as const).map((asset) => {
        const disabled = disabledAssets.includes(asset)
        return (
        <button
          key={asset}
          type="button"
          className={cn(
            'flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition',
            value === asset ? 'bg-[#fff8e7] text-arka-text shadow-[0_4px_8px_rgba(125,87,0,0.08)]' : 'text-arka-muted',
            disabled && 'cursor-not-allowed opacity-45',
          )}
          aria-pressed={value === asset}
          disabled={disabled}
          title={disabled ? `${asset} is available inside Nimiq Pay` : undefined}
          onClick={() => onChange(asset)}
        >
          <span className={cn('grid size-6 place-items-center', assetStyles[asset].icon === 'hex' ? 'arka-hex bg-[#E9B213]' : 'rounded-full bg-[#28c77b]')}>
            <span className="size-2 rounded-full bg-white" />
          </span>
          <span className="text-left leading-tight">
            <span className="block">{assetStyles[asset].label}</span>
            <span className="sr-only">{assetStyles[asset].detail}</span>
          </span>
        </button>
        )
      })}
    </div>
  )
}


import type { SplitMethod, SplitMethodType } from '../../types/arka'
import { cn } from '../../lib/utils/cn'
import type { LucideIcon } from 'lucide-react'

export function SplitMethodCard({
  method,
  selected,
  onSelect,
  icon: Icon,
}: {
  method: SplitMethod
  selected: boolean
  onSelect: (method: SplitMethodType) => void
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition',
        selected ? 'border-[#E9B213] bg-[#fff8e7] shadow-[0_6px_12px_rgba(125,87,0,0.08)]' : 'border-[#eadcc8] bg-white',
      )}
      onClick={() => onSelect(method.type)}
    >
      {Icon ? (
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', selected ? 'bg-[#F7E1B3] text-[#7d5700]' : 'bg-arka-surface-low text-arka-muted')}>
          <Icon size={21} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-black">{method.label}</span>
        <span className="mt-1 block text-sm font-semibold text-arka-muted">{method.description}</span>
      </span>
    </button>
  )
}


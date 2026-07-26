import { CircleCheck, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils/cn'

export type ToastNotice = {
  id: number
  tone: 'success' | 'info'
  title: string
  message: string
}

export function ArkaToast({ notice, onDismiss }: { notice: ToastNotice; onDismiss: () => void }) {
  const Icon = notice.tone === 'success' ? CircleCheck : Info

  return (
    <div className="arka-toast-viewport" aria-live="polite">
      <div className={cn('arka-toast', `is-${notice.tone}`)} role="status">
        <span className="arka-toast-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={2.2} />
        </span>
        <div className="arka-toast-copy">
          <strong>{notice.title}</strong>
          <p>{notice.message}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss notification">
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

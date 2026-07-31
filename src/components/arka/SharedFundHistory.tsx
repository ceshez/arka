import { ArrowDownLeft, CheckCircle2, Clock3, RotateCcw, Send } from 'lucide-react'
import type { Arka, SharedFundEvent } from '../../types/arka'
import { formatNim } from '../../lib/arka/formatMoney'
import { Card } from '../ui/Card'

function EventIcon({ event }: { event: SharedFundEvent }) {
  if (event.type === 'contribution') return <ArrowDownLeft size={18} />
  if (event.type.includes('refund')) return <RotateCcw size={18} />
  if (event.type.includes('settlement')) return <Send size={18} />
  return event.status === 'confirmed' ? <CheckCircle2 size={18} /> : <Clock3 size={18} />
}

export function SharedFundHistory({ arka }: { arka: Arka }) {
  if (arka.fundingMode !== 'shared-wallet') return null
  const events = arka.fundEvents ?? []

  return (
    <section className="mt-3" aria-labelledby="shared-fund-history-title">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 id="shared-fund-history-title" className="text-base font-black">Movements</h2>
          <p className="text-xs font-semibold text-arka-muted">Verified shared-fund activity</p>
        </div>
        <span className="text-xs font-bold text-[#7d5700]">{events.length} events</span>
      </div>
      <Card className="max-h-[17.5rem] overflow-y-auto p-0" aria-live="polite">
        {events.length ? events.map((event) => (
          <div key={event.id} className="flex min-h-[4.25rem] items-center gap-3 border-b border-[#eee3d1] px-4 py-3 last:border-b-0">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${event.status === 'confirmed' ? 'bg-[#e7f5e9] text-[#176832]' : event.status === 'rejected' ? 'bg-[#ffe5e1] text-[#9c2119]' : 'bg-[#fff2ce] text-[#7d5700]'}`}>
              <EventIcon event={event} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{event.label}</p>
              <p className="mt-0.5 text-xs font-semibold capitalize text-arka-muted">{event.status.replace('-', ' ')}</p>
            </div>
            {event.amountNim ? <strong className="shrink-0 text-sm">{event.type === 'contribution' ? '+' : ''}{formatNim(event.amountNim)}</strong> : null}
          </div>
        )) : (
          <div className="grid min-h-[9rem] place-items-center px-5 text-center">
            <div><Clock3 className="mx-auto text-[#a9874a]" size={24} /><p className="mt-2 text-sm font-black">No movements yet</p><p className="mt-1 text-xs font-semibold text-arka-muted">Verified contributions will appear here.</p></div>
          </div>
        )}
      </Card>
    </section>
  )
}

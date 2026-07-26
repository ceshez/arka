import { CheckCircle2, Plus, RefreshCcw, UsersRound } from 'lucide-react'

export function DemoLab({ memberCount, paidCount, collected, onAddPerson, onReset, onMarkPaid }: { memberCount: number; paidCount: number; collected: string; onAddPerson: () => void; onReset: () => void; onMarkPaid: () => void }) {
  return (
    <section className="mt-4 rounded-xl border border-[#d8b75d] bg-[#fff8e8] p-4" aria-labelledby="demo-lab-title">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f7c842] text-[#271900]"><UsersRound size={18} /></span><div className="min-w-0 flex-1"><h2 id="demo-lab-title" className="text-sm font-black">Guided demo</h2><p className="mt-1 text-xs font-semibold leading-4 text-arka-muted" aria-live="polite">{paidCount} of {memberCount} confirmed · {collected} collected</p></div><CheckCircle2 size={18} className={paidCount === memberCount ? 'text-[#197334]' : 'text-[#a7a39a]'} /></div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" onClick={onAddPerson} className="min-h-12 rounded-lg border border-[#e4d7be] bg-white px-2 text-xs font-black"><Plus className="mx-auto mb-1" size={15} />Add person</button>
        <button type="button" onClick={onReset} className="min-h-12 rounded-lg border border-[#e4d7be] bg-white px-2 text-xs font-black"><RefreshCcw className="mx-auto mb-1" size={15} />Reset</button>
        <button type="button" onClick={onMarkPaid} className="min-h-12 rounded-lg bg-[#1b1c19] px-2 text-xs font-black text-white"><UsersRound className="mx-auto mb-1" size={15} />All paid</button>
      </div>
    </section>
  )
}

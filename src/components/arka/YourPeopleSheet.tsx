import { ArrowDownUp, Pencil, Search, UsersRound } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { formatNim } from '../../lib/arka/formatMoney'
import { getSharedContacts, type SharedContact } from '../../lib/arka/getSharedContacts'
import { useArkaStore } from '../../store/arkaStore'
import { useProfileStore } from '../../store/profileStore'
import { useWalletStore } from '../../store/walletStore'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { MemberIdenticon } from './MemberIdenticon'

type SortMode = 'recent' | 'frequent' | 'name'

export function YourPeopleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SharedContact | null>(null)
  const [draftNickname, setDraftNickname] = useState('')
  const nicknames = useProfileStore((state) => state.contactNicknames)
  const setContactNickname = useProfileStore((state) => state.setContactNickname)
  const arkas = useArkaStore((state) => state.arkas)
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
  const walletAddress = useWalletStore((state) => state.wallet?.address)

  const contacts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase()
    return getSharedContacts(arkas, { walletAddress, memberId: currentGuestMemberId })
      .filter((contact) => `${contact.name} ${nicknames[contact.id] ?? ''}`.toLowerCase().includes(cleanQuery))
      .sort((left, right) => {
        if (sortMode === 'name') return left.name.localeCompare(right.name)
        if (sortMode === 'frequent') return right.arkaCount - left.arkaCount
        return Date.parse(right.lastSharedAt) - Date.parse(left.lastSharedAt)
      })
  }, [arkas, currentGuestMemberId, nicknames, query, sortMode, walletAddress])

  const openNickname = (contact: SharedContact) => {
    setSelected(contact)
    setDraftNickname(nicknames[contact.id] ?? '')
  }

  const saveNickname = (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setContactNickname(selected.id, draftNickname)
    setSelected(null)
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} eyebrow="Your people" title="Shared contacts">
        <p className="text-sm font-semibold leading-6 text-arka-muted">People from the Arkas you have shared. Private nicknames stay on this device.</p>
        <div className="relative mt-4"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-arka-muted" size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-13 w-full rounded-xl border border-[#e2d9cc] bg-white pl-11 pr-4 text-sm font-semibold outline-none focus:border-[#b57a00]" placeholder="Search people or nicknames" aria-label="Search people" /></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Sort people">
          {([['recent', 'Most recent'], ['frequent', 'Most Arkas'], ['name', 'A–Z']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setSortMode(value)} className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-black transition ${sortMode === value ? 'bg-[#1b1c19] text-white' : 'border border-[#e3dbcf] bg-white text-arka-muted'}`}>{label}</button>)}
        </div>
        <section className="mt-3 max-h-[calc(90dvh-20rem)] overflow-y-auto rounded-xl border border-[#e6ded2] bg-white overscroll-contain">
          {contacts.map((contact, index) => {
            const nickname = nicknames[contact.id]
            return <div key={contact.id} className={`flex min-h-[82px] items-center gap-3 px-4 py-3 ${index ? 'border-t border-[#eee8df]' : ''}`}>
              <MemberIdenticon seed={contact.avatarSeed} className="size-12 shrink-0" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{nickname || contact.name}</p>{nickname ? <p className="text-xs font-semibold text-arka-muted">{contact.name}</p> : null}<p className="mt-1 truncate text-xs font-semibold text-arka-muted">{contact.arkaCount} {contact.arkaCount === 1 ? 'Arka' : 'Arkas'} · {formatNim(contact.totalSharedNim)} shared</p></div>
              <button type="button" onClick={() => openNickname(contact)} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f6f2e9] text-[#7d5700]" aria-label={`Set a nickname for ${contact.name}`}><Pencil size={16} /></button>
            </div>
          })}
          {!contacts.length ? <div className="grid min-h-48 place-items-center px-6 text-center"><div><UsersRound className="mx-auto text-arka-muted" /><p className="mt-3 text-sm font-black">No shared people yet</p><p className="mt-1 text-xs font-semibold text-arka-muted">People appear here after you share an Arka.</p></div></div> : null}
        </section>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-arka-muted"><ArrowDownUp size={14} /> Nicknames are private and only visible to you.</p>
      </BottomSheet>

      <BottomSheet open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow="Private to you" title={selected ? `Nickname for ${selected.name}` : 'Add nickname'}>
        <form onSubmit={saveNickname}>
          <p className="text-sm font-semibold leading-6 text-arka-muted">Use a familiar name so you can recognize this person quickly. They will continue to see their original Arka name.</p>
          <label htmlFor="contact-nickname" className="mt-5 block text-xs font-extrabold uppercase tracking-[0.12em] text-arka-muted">Nickname</label>
          <input id="contact-nickname" autoFocus value={draftNickname} onChange={(event) => setDraftNickname(event.target.value)} maxLength={28} className="mt-2 min-h-14 w-full rounded-2xl border border-[#d9c69e] bg-white px-4 text-base font-bold outline-none focus:border-[#a46f00] focus:ring-2 focus:ring-[#f7c842]/35" placeholder="For example, Maria from work" />
          <Button className="mt-5" type="submit">Save nickname</Button>
          {selected && nicknames[selected.id] ? <button type="button" onClick={() => { setContactNickname(selected.id, ''); setSelected(null) }} className="mt-2 min-h-11 w-full text-sm font-bold text-arka-muted">Remove nickname</button> : null}
        </form>
      </BottomSheet>
    </>
  )
}

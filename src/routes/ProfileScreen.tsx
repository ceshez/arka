import { motion } from 'framer-motion'
import { Check, ChevronRight, Loader2, PencilLine, UsersRound, WalletCards, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HomeArkasHeader } from '../components/arka/HomeArkasHeader'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { YourPeopleSheet } from '../components/arka/YourPeopleSheet'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { MobileScreen } from '../components/ui/MobileScreen'
import { getSharedContacts } from '../lib/arka/getSharedContacts'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { useArkaStore } from '../store/arkaStore'
import { useProfileStore } from '../store/profileStore'
import { useWalletStore } from '../store/walletStore'

export function ProfileScreen() {
  const [peopleOpen, setPeopleOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameNotice, setNameNotice] = useState('')
  const recentArkas = useArkaStore((state) => state.recentArkas)
  const arkas = useArkaStore((state) => state.arkas)
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
  const updateCurrentWalletDisplayName = useArkaStore((state) => state.updateCurrentWalletDisplayName)
  const activeCount = recentArkas.filter((arka) => !['completed', 'cancelled'].includes(arka.status)).length
  const wallet = useWalletStore((state) => state.wallet)
  const displayName = useProfileStore((state) => state.displayName)
  const setDisplayName = useProfileStore((state) => state.setDisplayName)
  const [nameDraft, setNameDraft] = useState(displayName)
  const peopleCount = useMemo(
    () => getSharedContacts(arkas, {
      walletAddress: wallet?.address,
      memberId: currentGuestMemberId,
    }).length,
    [arkas, currentGuestMemberId, wallet?.address],
  )
  const identityName = wallet?.address ? formatWalletAddress(wallet.address) : 'Wallet not connected'

  const contactsTourOpen = location.search === '?tour=contacts'

  function closePeople() {
    setPeopleOpen(false)
    if (contactsTourOpen) navigate('/profile', { replace: true })
  }

  function startNameEdit() {
    setNameDraft(displayName)
    setEditingName(true)
  }

  async function saveName() {
    const cleanName = nameDraft.trim()
    if (!cleanName || savingName) return

    setSavingName(true)
    setNameNotice('')
    setDisplayName(cleanName)
    try {
      if (wallet?.address) {
        await updateCurrentWalletDisplayName(wallet.address, cleanName)
      }
      setNameNotice('Your name is updated in your shared Arkas and contacts.')
      setEditingName(false)
    } catch (error) {
      setNameNotice(error instanceof Error ? error.message : 'Your name was saved on this device.')
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  return (
    <MobileScreen>
      <motion.div className="shrink-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <ScreenContainer>
          <HomeArkasHeader title="Profile" subtitle="Your public Arka identity" />

          <section className="overflow-hidden rounded-[1.65rem] border border-[#e6cf94] bg-[#fff4d4] p-5 shadow-[0_10px_24px_rgba(125,87,0,0.09)]">
            <div className="flex items-center gap-4">
              {wallet ? <span className="shrink-0" aria-label="Connected wallet profile"><MemberIdenticon seed={wallet.address} className="size-16 rounded-full shadow-none" /></span> : <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white/70 text-[#7d5700]"><WalletCards size={28} /></span>}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#7d5700]">Public username</p>
                {editingName ? (
                  <div data-tour="profile-name" className="mt-1 flex items-center gap-2">
                    <input autoFocus maxLength={32} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveName(); if (event.key === 'Escape') setEditingName(false) }} placeholder="e.g. Ana" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#d9b75c] bg-white px-3 text-base font-black outline-none focus:ring-2 focus:ring-[#e9b213]/30" aria-label="Public username" />
                    <button type="button" disabled={savingName || !nameDraft.trim()} onClick={() => void saveName()} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#7d5700] text-white disabled:opacity-50" aria-label="Save profile name">{savingName ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}</button>
                    <button type="button" disabled={savingName} onClick={() => setEditingName(false)} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#decda9] bg-white text-[#68583a]" aria-label="Cancel name edit"><X size={18} /></button>
                  </div>
                ) : (
                  <button type="button" data-tour="profile-name" onClick={startNameEdit} className="mt-1 flex min-h-11 max-w-full items-center gap-2 text-left">
                    <span className="truncate text-xl font-black">{displayName || 'Choose a name'}</span><PencilLine className="shrink-0 text-[#7d5700]" size={17} />
                  </button>
                )}
                <p className="mt-0.5 text-sm font-semibold leading-5 text-arka-muted">{displayName ? `Everyone in your shared Arkas can see this username. Connected as ${identityName}.` : 'Choose the public username people will see in shared Arkas.'}</p>
                {nameNotice ? <p className="mt-2 text-xs font-bold leading-5 text-[#6d5100]" role="status">{nameNotice}</p> : null}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5" aria-label="Profile stats" data-tour="profile-overview">
            <div className="rounded-2xl border border-[#e8e0d5] bg-white p-3"><WalletCards size={17} className="text-[#7d5700]" /><p className="mt-3 text-2xl font-black">{activeCount}</p><p className="text-[11px] font-bold leading-tight text-arka-muted">Active Arkas</p></div>
            <div className="rounded-2xl border border-[#e8e0d5] bg-white p-3"><UsersRound size={17} className="text-[#7d5700]" /><p className="mt-3 text-2xl font-black">{peopleCount}</p><p className="text-[11px] font-bold leading-tight text-arka-muted">People</p></div>
          </section>

          <section className="overflow-hidden rounded-[1.45rem] border border-[#e7dfd4] bg-white shadow-[0_6px_16px_rgba(27,28,25,0.05)]" data-tour="profile-people">
            <button type="button" onClick={() => setPeopleOpen(true)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left active:bg-[#faf6ec]"><span className="grid size-10 place-items-center rounded-xl bg-[#fff2ca] text-[#7d5700]"><UsersRound size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black">Your people</strong><span className="text-xs font-semibold text-arka-muted">Wallet identities and private nicknames</span></span><ChevronRight size={18} className="text-arka-muted" /></button>
          </section>
        </ScreenContainer>
      </motion.div>

      <YourPeopleSheet open={peopleOpen || contactsTourOpen} onClose={closePeople} dataTour={contactsTourOpen ? 'contacts-sheet' : undefined} />
    </MobileScreen>
  )
}

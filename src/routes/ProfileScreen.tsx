import { motion } from 'framer-motion'
import { ChevronRight, FlaskConical, Pencil, PiggyBank, UserRound, UsersRound, WalletCards } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { YourPeopleSheet } from '../components/arka/YourPeopleSheet'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { getSharedContacts } from '../lib/arka/getSharedContacts'
import { useArkaStore } from '../store/arkaStore'
import { useProfileStore } from '../store/profileStore'
import { useWalletStore } from '../store/walletStore'

export function ProfileScreen() {
  const [editing, setEditing] = useState(false)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const displayName = useProfileStore((state) => state.displayName)
  const setDisplayName = useProfileStore((state) => state.setDisplayName)
  const recentArkas = useArkaStore((state) => state.recentArkas)
  const arkas = useArkaStore((state) => state.arkas)
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
  const [draftName, setDraftName] = useState(displayName)
  const activeCount = recentArkas.filter((arka) => !['completed', 'cancelled'].includes(arka.status)).length
  const wallet = useWalletStore((state) => state.wallet)
  const walletStatus = useWalletStore((state) => state.status)
  const walletError = useWalletStore((state) => state.error)
  const connectWallet = useWalletStore((state) => state.connect)
  const isWalletConnected = walletStatus === 'connected' && Boolean(wallet)
  const peopleCount = useMemo(
    () => getSharedContacts(arkas, {
      walletAddress: wallet?.address,
      memberId: currentGuestMemberId,
    }).length,
    [arkas, currentGuestMemberId, wallet?.address],
  )
  const hasUsername = Boolean(displayName.trim())
  const identityName = hasUsername ? displayName : wallet?.address ?? 'Your Arka profile'

  const editUsername = () => {
    if (!isWalletConnected) return
    setDraftName(displayName)
    setEditing(true)
  }

  const saveName = (event: FormEvent) => {
    event.preventDefault()
    if (!isWalletConnected) {
      setEditing(false)
      return
    }
    setDisplayName(draftName)
    setEditing(false)
  }

  return (
    <MobileScreen>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <ScreenContainer>
          <ArkaHeader title="Profile" subtitle="Your Arka identity" backTo="/" />

          <section className="overflow-hidden rounded-[1.65rem] border border-[#e6cf94] bg-[#fff4d4] p-5 shadow-[0_10px_24px_rgba(125,87,0,0.09)]">
            <div className="flex items-center gap-4">
              {wallet ? <span className="shrink-0" aria-label="Connected wallet profile"><MemberIdenticon seed={wallet.address} className="size-16 rounded-full shadow-none" /></span> : <UserRound size={34} className="shrink-0 text-[#7d5700]" aria-label="Arka profile" />}
              <div className="min-w-0 flex-1"><p className="truncate text-xl font-black">{identityName}</p><p className="mt-0.5 text-sm font-semibold text-arka-muted">{hasUsername ? 'Your public name across Arka' : isWalletConnected ? 'Add a username so friends recognize you easily' : 'Connect your wallet to choose a username'}</p></div>
              <button type="button" onClick={editUsername} disabled={!isWalletConnected} className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#e4c36e] bg-white/75 text-[#7d5700] disabled:cursor-not-allowed disabled:border-[#ded7c8] disabled:bg-white/45 disabled:text-arka-muted/55" aria-label={isWalletConnected ? 'Edit username' : 'Connect wallet to edit username'}><Pencil size={17} /></button>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2.5" aria-label="Profile stats">
            <div className="rounded-2xl border border-[#e8e0d5] bg-white p-3"><WalletCards size={17} className="text-[#7d5700]" /><p className="mt-3 text-2xl font-black">{activeCount}</p><p className="text-[11px] font-bold leading-tight text-arka-muted">Active Arkas</p></div>
            <div className="rounded-2xl border border-[#e8e0d5] bg-white p-3"><UsersRound size={17} className="text-[#7d5700]" /><p className="mt-3 text-2xl font-black">{peopleCount}</p><p className="text-[11px] font-bold leading-tight text-arka-muted">People</p></div>
            <div className="rounded-2xl border border-[#e6d09b] bg-[#fff8e7] p-3"><PiggyBank size={17} className="text-[#7d5700]" /><p className="mt-3 text-2xl font-black">3%</p><p className="text-[11px] font-bold leading-tight text-arka-muted">Cashback planned</p></div>
          </section>
          <p className="-mt-2 text-xs font-semibold leading-5 text-arka-muted">Not active yet. Rewards need a funded wallet and confirmed payout flow.</p>

          {!hasUsername && isWalletConnected ? <button type="button" onClick={editUsername} className="flex min-h-16 w-full items-center gap-3 rounded-[1.3rem] border border-[#e7cf94] bg-[#fff8e7] px-4 text-left shadow-[0_6px_16px_rgba(125,87,0,0.06)] active:scale-[0.99]"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1b1c19] text-[#f7c842]"><UserRound size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black">Choose a username</strong><span className="text-xs font-semibold text-arka-muted">It helps your group identify you in every Arka.</span></span><ChevronRight size={18} className="text-[#7d5700]" /></button> : null}

          {walletStatus !== 'connected' ? <section className="overflow-hidden rounded-[1.45rem] border border-[#e4ca8c] bg-[#fff8e7] p-4 text-[#2b251b] shadow-[0_10px_24px_rgba(125,87,0,0.09)] [&_button]:!bg-[#7d5700] [&_button]:!text-white [&_p:first-child]:!text-[#7d5700] [&_p:last-child]:!text-arka-muted">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f7c842] text-[#3d2a00]"><WalletCards size={22} strokeWidth={2.2} /></span>
              <div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#dfff53]">Nimiq Pay</p><p className="mt-0.5 truncate text-sm font-black">{walletStatus === 'connecting' ? 'Connecting your wallet…' : 'Connect your wallet'}</p><p className="mt-0.5 text-[11px] font-semibold leading-4 text-white/65">{walletError || 'Pay friends without leaving Arka.'}</p></div>
              <button type="button" onClick={() => void connectWallet()} disabled={walletStatus === 'connecting'} className="min-h-10 shrink-0 rounded-xl bg-white px-3 text-xs font-black text-[#1b1c19] transition active:scale-95 disabled:opacity-70">{walletStatus === 'connecting' ? '…' : 'Connect'}</button>
            </div>
          </section> : null}

          <Link to="/wallet-lab" className="flex min-h-16 w-full items-center gap-3 rounded-[1.3rem] border border-[#e5ddd0] bg-white px-4 text-left shadow-[0_6px_16px_rgba(27,28,25,0.05)] transition active:scale-[0.99]">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1edff] text-[#5751a8]"><FlaskConical size={19} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm font-black">Test wallet flows</strong><span className="text-xs font-semibold text-arka-muted">Try Nimiq and Ethereum confirmations</span></span>
            <ChevronRight size={18} className="text-arka-muted" />
          </Link>

          <section className="flex items-center gap-3 rounded-[1.3rem] border border-[#e6d9be] bg-[#fcf8ef] p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0bd] text-[#7d5700]"><PiggyBank size={19} /></span>
            <div><p className="text-sm font-black">3% NIM cashback planned</p><p className="mt-0.5 text-xs font-semibold leading-5 text-arka-muted">Arka will activate rewards only after funding and on-chain payout confirmation are implemented.</p></div>
          </section>

          <section className="overflow-hidden rounded-[1.45rem] border border-[#e7dfd4] bg-white shadow-[0_6px_16px_rgba(27,28,25,0.05)]">
            <button type="button" onClick={() => setPeopleOpen(true)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left active:bg-[#faf6ec]"><span className="grid size-10 place-items-center rounded-xl bg-[#fff2ca] text-[#7d5700]"><UsersRound size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black">Your people</strong><span className="text-xs font-semibold text-arka-muted">Names and private nicknames</span></span><ChevronRight size={18} className="text-arka-muted" /></button>
          </section>
        </ScreenContainer>
      </motion.div>

      <BottomSheet open={editing && isWalletConnected} onClose={() => setEditing(false)} eyebrow="Your identity" title="Choose your username">
        <form onSubmit={saveName}>
          <p className="text-sm font-semibold leading-6 text-arka-muted">This is your public Arka username. Anyone who joins an Arka you create can see it.</p>
          <label className="mt-5 block text-xs font-extrabold uppercase tracking-[0.12em] text-arka-muted" htmlFor="display-name">Username</label>
          <input id="display-name" autoFocus maxLength={28} value={draftName} onChange={(event) => setDraftName(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-[#d9c69e] bg-white px-4 text-base font-bold outline-none focus:border-[#a46f00] focus:ring-2 focus:ring-[#f7c842]/35" placeholder="How friends know you" />
          <Button className="mt-5" type="submit" disabled={!draftName.trim()}>Save username</Button>
        </form>
      </BottomSheet>
      <YourPeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
    </MobileScreen>
  )
}

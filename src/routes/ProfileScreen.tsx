import { motion } from 'framer-motion'
import { ChevronRight, FlaskConical, PiggyBank, UsersRound, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { YourPeopleSheet } from '../components/arka/YourPeopleSheet'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { MobileScreen } from '../components/ui/MobileScreen'
import { getSharedContacts } from '../lib/arka/getSharedContacts'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { useArkaStore } from '../store/arkaStore'
import { useWalletStore } from '../store/walletStore'

export function ProfileScreen() {
  const [peopleOpen, setPeopleOpen] = useState(false)
  const recentArkas = useArkaStore((state) => state.recentArkas)
  const arkas = useArkaStore((state) => state.arkas)
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
  const activeCount = recentArkas.filter((arka) => !['completed', 'cancelled'].includes(arka.status)).length
  const wallet = useWalletStore((state) => state.wallet)
  const peopleCount = useMemo(
    () => getSharedContacts(arkas, {
      walletAddress: wallet?.address,
      memberId: currentGuestMemberId,
    }).length,
    [arkas, currentGuestMemberId, wallet?.address],
  )
  const identityName = wallet?.address ? formatWalletAddress(wallet.address) : 'Wallet not connected'

  return (
    <MobileScreen>
      <motion.div className="shrink-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <ScreenContainer>
          <ArkaHeader title="Profile" subtitle="Your Arka identity" backTo="/" />

          <section className="overflow-hidden rounded-[1.65rem] border border-[#e6cf94] bg-[#fff4d4] p-5 shadow-[0_10px_24px_rgba(125,87,0,0.09)]">
            <div className="flex items-center gap-4">
              {wallet ? <span className="shrink-0" aria-label="Connected wallet profile"><MemberIdenticon seed={wallet.address} className="size-16 rounded-full shadow-none" /></span> : <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white/70 text-[#7d5700]"><WalletCards size={28} /></span>}
              <div className="min-w-0 flex-1"><p className="truncate text-xl font-black">{identityName}</p><p className="mt-0.5 text-sm font-semibold text-arka-muted">Your masked wallet identity across Arka</p></div>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2.5" aria-label="Profile stats">
            <div className="rounded-2xl border border-[#e8e0d5] bg-white p-3"><WalletCards size={17} className="text-[#7d5700]" /><p className="mt-3 text-2xl font-black">{activeCount}</p><p className="text-[11px] font-bold leading-tight text-arka-muted">Active Arkas</p></div>
            <div className="rounded-2xl border border-[#e8e0d5] bg-white p-3"><UsersRound size={17} className="text-[#7d5700]" /><p className="mt-3 text-2xl font-black">{peopleCount}</p><p className="text-[11px] font-bold leading-tight text-arka-muted">People</p></div>
            <div className="rounded-2xl border border-[#e6d09b] bg-[#fff8e7] p-3"><PiggyBank size={17} className="text-[#7d5700]" /><p className="mt-3 text-2xl font-black">3%</p><p className="text-[11px] font-bold leading-tight text-arka-muted">NIM cashback</p></div>
          </section>
          <p className="-mt-2 text-xs font-semibold leading-5 text-arka-muted">Eligible NIM payments unlock a host-funded reward confirmed separately in Nimiq Pay.</p>

          <Link to="/wallet-lab" className="flex min-h-16 w-full items-center gap-3 rounded-[1.3rem] border border-[#e5ddd0] bg-white px-4 text-left shadow-[0_6px_16px_rgba(27,28,25,0.05)] transition active:scale-[0.99]">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1edff] text-[#5751a8]"><FlaskConical size={19} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm font-black">Test wallet flows</strong><span className="text-xs font-semibold text-arka-muted">Try Nimiq and Ethereum confirmations</span></span>
            <ChevronRight size={18} className="text-arka-muted" />
          </Link>

          <section className="flex items-center gap-3 rounded-[1.3rem] border border-[#e6d9be] bg-[#fcf8ef] p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0bd] text-[#7d5700]"><PiggyBank size={19} /></span>
            <div><p className="text-sm font-black">3% NIM cashback is active</p><p className="mt-0.5 text-xs font-semibold leading-5 text-arka-muted">The host sends each reward from the connected host wallet after the contribution is confirmed.</p></div>
          </section>

          <section className="overflow-hidden rounded-[1.45rem] border border-[#e7dfd4] bg-white shadow-[0_6px_16px_rgba(27,28,25,0.05)]">
            <button type="button" onClick={() => setPeopleOpen(true)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left active:bg-[#faf6ec]"><span className="grid size-10 place-items-center rounded-xl bg-[#fff2ca] text-[#7d5700]"><UsersRound size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black">Your people</strong><span className="text-xs font-semibold text-arka-muted">Wallet identities and private nicknames</span></span><ChevronRight size={18} className="text-arka-muted" /></button>
          </section>
        </ScreenContainer>
      </motion.div>

      <YourPeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
    </MobileScreen>
  )
}

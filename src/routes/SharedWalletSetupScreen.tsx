import { CheckCircle2, ExternalLink, KeyRound, Loader2, LockKeyhole, UsersRound, WalletCards } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'
import { formatPublicIdentity, formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { getSharedWalletThreshold } from '../lib/nimiq/sharedWalletCrypto'
import { useArkaStore } from '../store/arkaStore'
import { useWalletStore } from '../store/walletStore'
import { getCurrentArkaMember } from './routeUtils'

const MULTISIG_URL = 'https://multisig.nimiq.com'

export function SharedWalletSetupScreen() {
  const { arkaId } = useParams()
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const guestMemberId = useArkaStore((state) => arkaId ? state.guestMemberIdsByArka[arkaId] : null)
  const hasHostSecret = useArkaStore((state) => Boolean(arkaId && state.remoteHostSecrets[arkaId]))
  const activate = useArkaStore((state) => state.activateSharedWalletMember)
  const verifyWallet = useArkaStore((state) => state.verifySharedWallet)
  const walletAddress = useWalletStore((state) => state.wallet?.address)
  const [sharedAddress, setSharedAddress] = useState(arka?.sharedWalletAddress ?? '')
  const [busy, setBusy] = useState<'activate' | 'verify' | null>(null)
  const [error, setError] = useState('')

  if (!arka) return <Navigate to="/error/arka-not-found" replace />
  if (arka.fundingMode !== 'shared-wallet') return <Navigate to={`/arka/${arka.id}/host/summary`} replace />

  const member = getCurrentArkaMember(arka, { walletAddress, guestMemberId, hasHostSecret })
  if (!member) return <Navigate to="/join" replace />
  const isHost = member.role === 'host'
  const participantCount = arka.members.length
  const activatedCount = arka.members.filter((candidate) => candidate.activationStatus === 'verified').length
  const currentThreshold = getSharedWalletThreshold(participantCount)
  const allActivated = participantCount >= 2 && activatedCount === participantCount
  const verified = arka.sharedWalletStatus === 'verified'
  const backTo = isHost ? `/arka/${arka.id}/host/summary` : `/arka/${arka.id}/guest`

  async function activateMember() {
    setBusy('activate')
    setError('')
    try {
      await activate(arka!.id, member!.id)
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Wallet activation failed.')
    } finally {
      setBusy(null)
    }
  }

  async function verify() {
    setBusy('verify')
    setError('')
    try {
      await verifyWallet(arka!.id, sharedAddress)
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'Shared wallet verification failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <MobileScreen>
      <ScreenContainer className="gap-4">
        <ArkaHeader title="Shared fund" subtitle={arka.name} backTo={backTo} />

        <Card className="border-[#ead28c] bg-[#fff9e9] p-5">
          <span className={`grid size-12 place-items-center rounded-2xl ${verified ? 'bg-[#dff3e4] text-[#176832]' : 'bg-[#f7d772] text-[#5f4100]'}`}>
            {verified ? <CheckCircle2 size={24} /> : <LockKeyhole size={23} />}
          </span>
          <h1 className="mt-4 text-2xl font-black">{verified ? 'Shared wallet verified' : 'Set up control together'}</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">
            {verified
              ? `The fund requires ${arka.approvalThreshold} approvals. No one person can move it alone.`
              : 'People can keep joining while setup is open. The required majority updates automatically with the current group.'}
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4"><UsersRound size={19} className="text-[#8d6200]" /><p className="mt-2 text-xs font-bold text-arka-muted">Joined now</p><strong className="mt-1 block text-xl">{participantCount}</strong></Card>
          <Card className="p-4"><KeyRound size={19} className="text-[#8d6200]" /><p className="mt-2 text-xs font-bold text-arka-muted">Activated</p><strong className="mt-1 block text-xl">{activatedCount} / {participantCount}</strong></Card>
        </div>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-arka-muted">Required majority now</p>
          <p className="mt-2 text-xl font-black">
            {currentThreshold > 0 ? `${currentThreshold} of ${participantCount}` : 'Add one more person'}
          </p>
          <p className="mt-2 text-sm font-semibold leading-5 text-arka-muted">
            This recalculates as people join. The signer group closes only when the host verifies the shared wallet.
          </p>
        </Card>

        <section aria-labelledby="activation-title">
          <h2 id="activation-title" className="text-base font-black">Wallet activation</h2>
          <div className="mt-2 grid gap-2">
            {arka.members.map((candidate) => (
              <div key={candidate.id} className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#e7d9c6] bg-white px-3 py-2">
                <MemberIdenticon seed={candidate.walletAddress ?? candidate.id} className="size-10" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{formatPublicIdentity(candidate.displayName, candidate.walletAddress)}</p><p className="text-xs font-semibold text-arka-muted">{candidate.role === 'host' ? 'Host' : 'Participant'}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${candidate.activationStatus === 'verified' ? 'bg-[#e4f5e8] text-[#176832]' : 'bg-[#f0ede7] text-[#6b6255]'}`}>{candidate.activationStatus === 'verified' ? 'Activated' : 'Pending'}</span>
              </div>
            ))}
          </div>
        </section>

        {!verified ? (
          <Card className="p-4 text-center">
            <p className="text-sm font-black">The group is still open</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">Keep sharing the invite while people join. The official Shared Wallet supports up to 16 signers.</p>
            <ButtonLink to={`/arka/${arka.id}/share`} className="mt-3">Invite more people</ButtonLink>
          </Card>
        ) : null}

        {!verified && member.activationStatus !== 'verified' ? (
          <Button type="button" disabled={Boolean(busy)} onClick={() => void activateMember()}>
            {busy === 'activate' ? <Loader2 className="animate-spin" size={19} /> : <KeyRound size={19} />}
            {busy === 'activate' ? 'Confirming wallet…' : 'Activate my wallet'}
          </Button>
        ) : null}

        {isHost && allActivated && !verified ? (
          <Card className="p-4">
            <h2 className="text-base font-black">Verify the official Shared Wallet</h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">When everyone you want is here, create the same {currentThreshold}-of-{participantCount} wallet in Nimiq Multisig, then paste its address here. Verifying it closes membership and opens contributions.</p>
            <a href={MULTISIG_URL} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d5b75f] bg-white text-sm font-black text-[#694900]">Open Nimiq Multisig <ExternalLink size={17} /></a>
            <label className="mt-4 grid gap-1.5 text-sm font-black">Shared wallet address<input value={sharedAddress} onChange={(event) => setSharedAddress(event.target.value)} placeholder="NQ…" className="min-h-12 rounded-xl border border-[#dfd5c4] bg-[#fffdf8] px-3 font-mono text-sm outline-none focus:border-[#e9b213]" /></label>
            <Button type="button" className="mt-3" disabled={Boolean(busy) || !sharedAddress.trim()} onClick={() => void verify()}>{busy === 'verify' ? <Loader2 className="animate-spin" size={19} /> : <WalletCards size={19} />}{busy === 'verify' ? 'Verifying…' : 'Verify shared wallet'}</Button>
          </Card>
        ) : null}

        {verified ? (
          <Card className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-arka-muted">Shared wallet</p><p className="mt-2 font-mono text-sm font-black">{formatWalletAddress(arka.sharedWalletAddress ?? '')}</p><p className="mt-2 text-sm font-semibold text-[#176832]">Contributions are open on NIM mainnet.</p></Card>
        ) : null}

        {error ? <p role="alert" className="rounded-xl bg-[#ffe6e1] p-3 text-sm font-semibold text-arka-error">{error}</p> : null}
        <Link to={backTo} className="min-h-11 text-center text-sm font-black text-[#6b6255]">Back to Arka</Link>
      </ScreenContainer>
    </MobileScreen>
  )
}

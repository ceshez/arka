import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ArkaBrandMark } from '../components/arka/ArkaBrandMark'
import { InviteQrScanner } from '../components/arka/InviteQrScannerSheet'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqArrowRight, NimiqScanQrCode } from '../components/ui/NimiqIcon'
import { InviteRepositoryError } from '../lib/invites/inviteRepository'
import { cn } from '../lib/utils/cn'
import { useArkaStore } from '../store/arkaStore'

const joinCodePattern = /^ARKA-(?:[A-Z0-9]{4}|[A-F0-9]{8})$/

export function JoinArkaScreen() {
  const navigate = useNavigate()
  const loadArkaInvite = useArkaStore((state) => state.loadArkaInvite)
  const [code, setCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState('')

  const normalizedCode = `ARKA-${code.trim().toUpperCase()}`
  const codeError = code.trim().length === 0
    ? 'Enter the invitation code.'
    : !joinCodePattern.test(normalizedCode)
      ? 'Use the code from your invitation.'
      : null
  const showCodeError = Boolean(codeError && (codeTouched || submitAttempted))

  const handleJoinReference = useCallback(async (reference: string) => {
    setIsLookingUp(true)
    setLookupError('')
    try {
      const arka = await loadArkaInvite(reference)
      navigate(arka ? `/join/${arka.code}/preview` : '/error/arka-not-found')
    } catch (error) {
      if (error instanceof InviteRepositoryError && error.code === 'not-configured') {
        setLookupError(error.message)
      } else {
        navigate('/error/arka-not-found')
      }
    } finally {
      setIsLookingUp(false)
    }
  }, [loadArkaInvite, navigate])

  async function handleJoin() {
    setSubmitAttempted(true)
    if (codeError) return
    await handleJoinReference(normalizedCode)
  }

  return (
    <MobileScreen className="bg-[#fffaf5]" withBottomAction>
      <ScreenContainer className="gap-6 px-5">
        <ArkaHeader title="Join Arka" subtitle="Scan an invite or enter the code your group shared." backTo="/" />

        <section aria-label="QR scanner" data-tour="join-arka-qr">
          <InviteQrScanner onScan={(reference) => void handleJoinReference(reference)} />
        </section>

        <div className="my-7 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-[#e8dfd2]" />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-arka-muted">or use a code</span>
          <span className="h-px flex-1 bg-[#e8dfd2]" />
        </div>

        <label className="grid gap-2" htmlFor="invitation-code" data-tour="join-arka-code">
          <span className="text-sm font-black text-[#302b20]">Invitation code</span>
          <div
            className={cn(
              'flex min-h-[86px] items-center gap-3 rounded-2xl border bg-white px-4 transition focus-within:border-[#d99c00] focus-within:ring-2 focus-within:ring-[#d99c00]/15',
              showCodeError ? 'border-arka-error' : 'border-[#eadcc8]',
            )}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#1b1c19] text-[#f7c842]" aria-hidden="true"><ArkaBrandMark className="size-8" /></span>
            <div className="flex min-w-0 max-w-full flex-1 items-center overflow-hidden text-[clamp(1rem,5.2vw,1.42rem)] font-black leading-none tracking-[0.045em] text-[#171814]"><span aria-hidden="true" className="shrink-0 text-[#7d5700]">ARKA-</span><input id="invitation-code" className="h-11 w-0 min-w-0 flex-1 bg-transparent uppercase outline-none placeholder:text-[0.68em] placeholder:tracking-[0.08em] placeholder:text-[#a69d90]" value={code} placeholder="TYPE CODE" inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} aria-label="Invitation code after ARKA dash" aria-invalid={showCodeError} aria-describedby={showCodeError ? 'invitation-code-error' : undefined} onBlur={() => setCodeTouched(true)} onChange={(event) => { const suffix = event.target.value.toUpperCase().replace(/^ARKA-?/, '').replace(/[^A-Z0-9]/g, '').slice(0, 8); setCode(suffix) }} onKeyDown={(event) => { if (event.key === 'Enter') void handleJoin() }} /></div>
          </div>
          {showCodeError ? <p id="invitation-code-error" className="text-sm font-semibold text-arka-error">{codeError}</p> : null}
          {lookupError ? <p className="text-sm font-semibold text-arka-error" role="alert">{lookupError}</p> : null}
        </label>

      </ScreenContainer>
      <BottomActionBar aboveBottomNav>
          <Button type="button" className="relative" onClick={() => void handleJoin()} disabled={isLookingUp || Boolean(codeError)}>
            <span className="flex items-center gap-3">
              <NimiqScanQrCode size={22} />
              {isLookingUp ? 'Finding Arka…' : 'Join Arka'}
            </span>
            <NimiqArrowRight className="absolute right-6" size={22} />
          </Button>
      </BottomActionBar>
    </MobileScreen>
  )
}

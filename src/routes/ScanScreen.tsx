import { NimiqScanQrCode } from '../components/ui/NimiqIcon'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'

export function ScanScreen() {
  return (
    <MobileScreen>
      <ScreenContainer>
        <ArkaHeader title="Scan" subtitle="Fast access to Arka invites" backTo="/" />

        <Card className="space-y-5 text-center">
          <div className="mx-auto grid aspect-square w-full max-w-64 place-items-center rounded-[1.75rem] border border-dashed border-[#e0b84d] bg-[#fff8e7] text-[#7d5700]">
            <div>
              <NimiqScanQrCode className="mx-auto" size={64} />
              <p className="mt-4 text-base font-black">Scan a QR</p>
              <p className="mt-1 text-sm font-semibold text-arka-muted">Join an Arka or open a user invite in one tap.</p>
            </div>
          </div>

          <p className="text-sm font-semibold text-arka-muted">
            If the camera is not ready, use the join code screen instead.
          </p>
        </Card>

        <div className="grid gap-3">
          <ButtonLink to="/join">Open join code</ButtonLink>
          <ButtonLink variant="secondary" to="/create">
            Create new Arka
          </ButtonLink>
        </div>
      </ScreenContainer>
    </MobileScreen>
  )
}

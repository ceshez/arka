import { Link } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'
import { StatusPill } from '../components/ui/StatusPill'
import { formatDate, formatNim, formatUsd } from '../lib/arka/formatMoney'
import { useArkaStore } from '../store/arkaStore'

export function ArkasScreen() {
  const recentArkas = useArkaStore((state) => state.recentArkas)
  const activeArkas = recentArkas.filter((arka) => arka.status !== 'completed' && arka.status !== 'cancelled')
  const totalCollected = recentArkas.reduce((total, arka) => total + arka.collectedFiat, 0)

  return (
    <MobileScreen>
      <ScreenContainer>
        <ArkaHeader title="Arkas" subtitle="Open and recent shared tabs" backTo="/" brandWordmark />

        <Card
          className="relative overflow-hidden border-0 bg-[#111214] bg-cover bg-right-bottom bg-no-repeat text-white shadow-[0_8px_20px_rgba(27,28,25,0.15)]"
          style={{ backgroundImage: "linear-gradient(90deg, rgba(11,12,13,0.96) 0%, rgba(11,12,13,0.72) 52%, rgba(11,12,13,0.08) 100%), url('/brand/arka-card-texture-cropped.png')" }}
        >
          <p className="text-sm font-bold text-[#f7c842]">Collection snapshot</p>
          <p className="mt-1 text-4xl font-black tracking-[-0.03em]">{formatUsd(totalCollected)}</p>
          <p className="mt-2 text-xs font-black text-[#f7c842]">Money moved with NIM host-wallet collection</p>
          <p className="mt-2 text-sm font-semibold text-white/65">
            {activeArkas.length} active Arkas · {recentArkas.length} recent in your pocket
          </p>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <ButtonLink to="/create">Create Arka</ButtonLink>
          <ButtonLink variant="secondary" to="/join">
            Join Arka
          </ButtonLink>
        </div>

        <section className="space-y-3">
          {recentArkas.map((arka) => (
            <Link className="block" key={arka.id} to={arka.status === 'completed' ? `/arka/${arka.id}/completed` : `/arka/${arka.id}/host/summary`}>
              <Card className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{arka.name}</p>
                    <p className="text-xs font-semibold text-arka-muted">
                      {formatDate(arka.completedAt ?? arka.createdAt)} · {arka.memberCount} members · {formatNim(arka.totalNimEstimate)}
                    </p>
                  </div>
                  <StatusPill status={arka.status} />
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-arka-muted">
                  <span>{formatUsd(arka.collectedFiat)} collected</span>
                  <span>{Math.round((arka.collectedFiat / arka.totalFiat) * 100)}% complete</span>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      </ScreenContainer>
    </MobileScreen>
  )
}

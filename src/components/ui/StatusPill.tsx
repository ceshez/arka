import type { ArkaMemberStatus, ArkaStatus } from '../../types/arka'
import { Badge } from './Badge'

export function StatusPill({ status }: { status: ArkaMemberStatus | ArkaStatus }) {
  if (status === 'paid' || status === 'completed') return <Badge tone="green">Paid</Badge>
  if (status === 'partial') return <Badge tone="gold">Partial</Badge>
  if (status === 'ready-to-settle') return <Badge tone="green">Ready to settle</Badge>
  if (status === 'collecting') return <Badge tone="gold">Collecting</Badge>
  if (status === 'pending' || status === 'open') return <Badge tone="blue">Pending</Badge>
  return <Badge>{status.replaceAll('-', ' ')}</Badge>
}

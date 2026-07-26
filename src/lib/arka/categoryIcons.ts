import {
  BriefcaseBusiness,
  Coffee,
  ConciergeBell,
  Gift,
  Grid2X2,
  House,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react'
import type { ArkaCategory } from '../../types/arka'

export const arkaCategoryIcons: Record<ArkaCategory, LucideIcon> = {
  dinner: ConciergeBell,
  cafe: Coffee,
  trip: BriefcaseBusiness,
  gift: Gift,
  event: PartyPopper,
  roommates: House,
  custom: Grid2X2,
}

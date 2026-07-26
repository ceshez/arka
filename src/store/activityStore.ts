import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ActivityStore = {
  lastSeenAt: string | null
  markAllSeen: () => void
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set) => ({
      lastSeenAt: null,
      markAllSeen: () => set({ lastSeenAt: new Date().toISOString() }),
    }),
    { name: 'arka-activity' },
  ),
)

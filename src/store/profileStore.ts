import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ProfileStore = {
  displayName: string
  contactNicknames: Record<string, string>
  setDisplayName: (displayName: string) => void
  setContactNickname: (contactId: string, nickname: string) => void
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      displayName: '',
      contactNicknames: {},
      setDisplayName: (displayName) => set({ displayName: displayName.trim() }),
      setContactNickname: (contactId, nickname) =>
        set((state) => {
          const nextNicknames = { ...state.contactNicknames }
          const cleanNickname = nickname.trim()

          if (cleanNickname) nextNicknames[contactId] = cleanNickname
          else delete nextNicknames[contactId]

          return { contactNicknames: nextNicknames }
        }),
    }),
    {
      name: 'arka-profile',
      version: 2,
      migrate: (persistedState) => ({
        ...(persistedState as Pick<ProfileStore, 'displayName' | 'contactNicknames'>),
        displayName: (persistedState as Partial<ProfileStore>)?.displayName?.trim() ?? '',
        contactNicknames: (persistedState as Partial<ProfileStore>)?.contactNicknames ?? {},
      }),
    },
  ),
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { connectWallet as requestWallet, getWalletConnectionMessage, type WalletSnapshot } from '../lib/nimiq/walletBalance'

type WalletStatus = 'idle' | 'connecting' | 'connected' | 'error'

type WalletStore = {
  status: WalletStatus
  wallet: WalletSnapshot | null
  lastConnectedAddress: string | null
  error?: string
  connect: () => Promise<void>
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      status: 'idle',
      wallet: null,
      lastConnectedAddress: null,
      async connect() {
        set({ status: 'connecting', error: undefined })
        try {
          const wallet = await requestWallet()
          set({
            status: 'connected',
            wallet,
            lastConnectedAddress: wallet.address,
            error: undefined,
          })
        } catch (error) {
          set({ status: 'error', wallet: null, error: getWalletConnectionMessage(error) })
        }
      },
    }),
    {
      name: 'arka-wallet-session',
      partialize: (state) => ({ lastConnectedAddress: state.lastConnectedAddress }),
    },
  ),
)

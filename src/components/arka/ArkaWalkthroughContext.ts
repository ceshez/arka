import { createContext, useContext } from 'react'

type WalkthroughContextValue = {
  openWalkthrough: () => void
}

export const ArkaWalkthroughContext = createContext<WalkthroughContextValue | null>(null)

export function useArkaWalkthrough() {
  const context = useContext(ArkaWalkthroughContext)
  if (!context) throw new Error('useArkaWalkthrough must be used inside ArkaWalkthroughProvider')
  return context
}

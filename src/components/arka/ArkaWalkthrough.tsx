import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useWalletStore } from '../../store/walletStore'
import { ArkaWalkthroughContext } from './ArkaWalkthroughContext'

const PROGRESS_KEY_PREFIX = 'arka-guided-tour-step-v2'
const SEEN_KEY_PREFIX = 'arka-guided-tour-seen-v2'

type TourStep = {
  route: string
  search?: string
  element: string
  title: string
  description: string
  side?: 'top' | 'bottom'
}

function getTourStorageKeys(address: string) {
  const walletKey = address.replace(/\s+/g, '').toUpperCase()
  return {
    progress: `${PROGRESS_KEY_PREFIX}:${walletKey}`,
    seen: `${SEEN_KEY_PREFIX}:${walletKey}`,
  }
}

const connectedTourSteps: TourStep[] = [
  {
    route: '/',
    element: '[data-tour="arka-intro"]',
    title: 'Welcome to Arka',
    description: 'Arka helps a group create a shared tab, invite friends, and track each payment together with NIM.',
    side: 'bottom',
  },
  {
    route: '/',
    element: '[data-tour="join-arka-action"]',
    title: 'Join an existing Arka',
    description: 'Your friends can join from Home whenever they receive an invite.',
    side: 'top',
  },
  {
    route: '/join',
    element: '[data-tour="join-arka-qr"]',
    title: 'Scan the invite QR',
    description: 'Open the camera and scan the group invite to see the Arka first.',
    side: 'bottom',
  },
  {
    route: '/join',
    element: '[data-tour="join-arka-code"]',
    title: 'Or enter the invite code',
    description: 'No QR? Enter the code your group shared. You will preview the Arka before joining.',
    side: 'top',
  },
  {
    route: '/arkas',
    element: '[data-tour="arkas-history"]',
    title: 'Your shared payment history',
    description: 'See the USD total moved, its approximate NIM amount, and whether each Arka is active, pending, or complete.',
    side: 'bottom',
  },
  {
    route: '/activity',
    element: '[data-tour="activity-history"]',
    title: 'Stay up to date',
    description: 'Activity keeps payment notices, new Arkas, joins, and group progress together in one timeline.',
    side: 'bottom',
  },
  {
    route: '/profile',
    element: '[data-tour="profile-name"]',
    title: 'Choose your name',
    description: 'Add the name your friends will recognise. You can edit it anytime from Profile.',
    side: 'bottom',
  },
  {
    route: '/profile',
    element: '[data-tour="profile-overview"]',
    title: 'Your Arka overview',
    description: 'Profile shows your active Arkas and the people you have shared with.',
    side: 'top',
  },
  {
    route: '/profile',
    search: '?tour=contacts',
    element: '[data-tour="contacts-sheet"]',
    title: 'Keep your contacts personal',
    description: 'See each person’s profile name or wallet label. You can add a nickname that is private and visible only to you.',
    side: 'top',
  },
]

export function ArkaWalkthroughProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const wallet = useWalletStore((state) => state.wallet)
  const [runId, setRunId] = useState(0)
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const storageKeys = useMemo(
    () => (wallet ? getTourStorageKeys(wallet.address) : null),
    [wallet],
  )

  const openWalkthrough = useCallback(() => {
    if (!storageKeys) return
    window.localStorage.setItem(storageKeys.progress, '0')
    window.localStorage.removeItem(storageKeys.seen)
    navigate('/')
    setRunId((value) => value + 1)
  }, [navigate, storageKeys])

  const context = useMemo(() => ({ openWalkthrough }), [openWalkthrough])
  const tourSteps = connectedTourSteps

  useEffect(() => {
    if (!wallet || !storageKeys) return

    const savedStepValue = window.localStorage.getItem(storageKeys.progress)
    const savedStep = savedStepValue === null ? Number.NaN : Number(savedStepValue)
    const hasSavedStep = Number.isInteger(savedStep) && savedStep >= 0 && savedStep < tourSteps.length
    const firstVisit = !window.localStorage.getItem(storageKeys.seen) && location.pathname === '/'
    const stepIndex = hasSavedStep ? savedStep : firstVisit ? 0 : -1
    const step = tourSteps[stepIndex]

    if (!step || step.route !== location.pathname || (step.search ?? '') !== location.search) return

    if (firstVisit && !hasSavedStep) {
      // Write both values before rendering the tour. React route changes and
      // manual navigation can no longer turn a partially viewed guide into a
      // fresh first-visit prompt when the user returns Home.
      window.localStorage.setItem(storageKeys.seen, 'true')
      window.localStorage.setItem(storageKeys.progress, '0')
    }

    const startTimer = window.setTimeout(() => {
      window.localStorage.setItem(storageKeys.progress, String(stepIndex))
      let isHandingOff = false
      const steps: DriveStep[] = tourSteps.map((tourStep, index) => ({
        element: tourStep.element,
        popover: {
          title: tourStep.title,
          description: tourStep.description,
          side: tourStep.side ?? 'bottom',
          align: 'center',
          showButtons: index === 0 ? ['next', 'close'] : ['previous', 'next', 'close'],
          nextBtnText: index === tourSteps.length - 1 ? 'Done' : 'Next',
          prevBtnText: 'Back',
          onPopoverRender: (popover) => {
            popover.closeButton.textContent = 'Skip'
            popover.closeButton.setAttribute('aria-label', 'Skip walkthrough')
          },
          onNextClick: () => {
            if (index === tourSteps.length - 1) {
              window.localStorage.setItem(storageKeys.seen, 'true')
              window.localStorage.removeItem(storageKeys.progress)
              driverRef.current?.destroy()
              navigate('/')
              return
            }

            const nextIndex = index + 1
            const nextStep = tourSteps[nextIndex]
            if (nextStep.route === tourStep.route && (nextStep.search ?? '') === (tourStep.search ?? '')) {
              driverRef.current?.moveNext()
              return
            }
            window.localStorage.setItem(storageKeys.progress, String(nextIndex))
            isHandingOff = true
            driverRef.current?.destroy()
            navigate({ pathname: nextStep.route, search: nextStep.search })
          },
          onPrevClick: () => {
            const previousIndex = Math.max(index - 1, 0)
            const previousStep = tourSteps[previousIndex]
            if (previousStep.route === tourStep.route && (previousStep.search ?? '') === (tourStep.search ?? '')) {
              driverRef.current?.movePrevious()
              return
            }
            window.localStorage.setItem(storageKeys.progress, String(previousIndex))
            isHandingOff = true
            driverRef.current?.destroy()
            navigate({ pathname: previousStep.route, search: previousStep.search })
          },
        },
      }))

      const tour = driver({
        steps,
        animate: true,
        smoothScroll: true,
        overlayColor: '#1b1c19',
        overlayOpacity: 0.58,
        stagePadding: 8,
        stageRadius: 18,
        popoverClass: 'arka-driver-popover',
        progressText: '{{current}} of {{total}}',
        onDestroyed: () => {
          if (isHandingOff) return
          window.localStorage.setItem(storageKeys.seen, 'true')
          window.localStorage.removeItem(storageKeys.progress)
        },
      })

      driverRef.current = tour
      tour.drive(stepIndex)
    }, 180)

    return () => {
      window.clearTimeout(startTimer)
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [location.pathname, location.search, navigate, runId, storageKeys, tourSteps, wallet])

  return <ArkaWalkthroughContext.Provider value={context}>{children}</ArkaWalkthroughContext.Provider>
}

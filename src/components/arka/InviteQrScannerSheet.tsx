import QrScanner from 'qr-scanner'
import { Camera, CameraOff, ImageUp, LoaderCircle, RotateCcw, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { parseInviteReference } from '../../lib/invites/parseInviteReference'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/BottomSheet'

function cameraErrorMessage(error: unknown) {
  if (!window.isSecureContext) {
    return 'Live camera scanning requires HTTPS. Open Arka from a secure link, or use the phone camera below.'
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Camera access is off. Allow it in your browser settings, then try again.'
    if (error.name === 'NotFoundError') return 'No camera was found on this device. You can choose a QR image instead.'
    if (error.name === 'NotReadableError') return 'The camera is busy or unavailable. Close other camera apps, then try again.'
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/permission|not allowed|denied/i.test(message)) {
    return 'Camera access is off. Allow it in your browser settings, then try again.'
  }
  if (/not found|no camera|requested device/i.test(message)) {
    return 'No camera was found on this device. You can choose a QR image instead.'
  }
  if (/not readable|could not start|in use/i.test(message)) {
    return 'The camera is busy or unavailable. Close other camera apps, then try again.'
  }

  return 'This browser could not start the camera. Choose a QR image or enter the value manually.'
}

function imageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image could not be loaded'))
    image.src = url
  })
}

function drawImageVariant(image: HTMLImageElement, cropRatio: number, rotation: number) {
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  const isCropped = cropRatio < 1
  const cropSize = Math.min(naturalWidth, naturalHeight) * cropRatio
  const sourceWidth = isCropped ? cropSize : naturalWidth
  const sourceHeight = isCropped ? cropSize : naturalHeight
  const sourceX = (naturalWidth - sourceWidth) / 2
  const sourceY = (naturalHeight - sourceHeight) / 2
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight))
  const drawWidth = Math.max(1, Math.round(sourceWidth * scale))
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale))
  const swapsSides = Math.abs(rotation % 180) === 90
  const canvas = document.createElement('canvas')
  canvas.width = swapsSides ? drawHeight : drawWidth
  canvas.height = swapsSides ? drawWidth : drawHeight

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Image processing is unavailable')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((rotation * Math.PI) / 180)
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  )

  return canvas
}

async function decodeQrImage(file: File) {
  const objectUrl = URL.createObjectURL(file)

  try {
    try {
      const result = await QrScanner.scanImage(file, {
        alsoTryWithoutScanRegion: true,
        returnDetailedScanResult: true,
      })
      return result.data
    } catch {
      // Try centered crops and rotated variants for screenshots and angled photos.
    }

    const image = await imageFromUrl(objectUrl)
    const variants = [
      [1, 0],
      [1, 90],
      [1, 180],
      [1, 270],
      [0.85, 0],
      [0.85, 90],
      [0.68, 0],
      [0.68, 90],
      [0.5, 0],
      [0.5, 90],
    ] as const

    for (const [cropRatio, rotation] of variants) {
      try {
        const result = await QrScanner.scanImage(drawImageVariant(image, cropRatio, rotation), {
          alsoTryWithoutScanRegion: true,
          returnDetailedScanResult: true,
        })
        return result.data
      } catch {
        // Try the next crop and orientation.
      }
    }

    throw new Error('No QR code found')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function QrScannerView({
  active = true,
  onScan,
  parseValue,
  invalidQrMessage = 'That QR could not be read.',
  activeMessage = 'Point your camera at the QR. It opens automatically.',
  fallbackMessage = 'Use a QR photo or enter the value manually.',
}: {
  active?: boolean
  onScan: (reference: string) => void
  parseValue: (value: string) => string | null | undefined
  invalidQrMessage?: string
  activeMessage?: string
  fallbackMessage?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const onScanRef = useRef(onScan)
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'error' | 'insecure'>(
    () => (window.isSecureContext ? 'starting' : 'insecure'),
  )
  const [cameraError, setCameraError] = useState('')
  const [scanError, setScanError] = useState('')
  const [isReadingImage, setIsReadingImage] = useState(false)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const startupTimer = window.setTimeout(() => {
      if (cancelled || scannerRef.current) return
      setCameraState('error')
      setCameraError('Camera permission is still waiting. Allow it in the browser prompt, or choose a QR photo.')
    }, 8_000)

    async function startCamera() {
      if (!window.isSecureContext) {
        window.clearTimeout(startupTimer)
        setCameraState('insecure')
        setCameraError(cameraErrorMessage(null))
        return
      }

      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        window.clearTimeout(startupTimer)
        setCameraState('error')
        setCameraError('Camera scanning is not available in this browser. Choose a QR image or enter the value manually.')
        return
      }

      setCameraState('starting')
      setCameraError('')
      setScanError('')

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          if (cancelled) return

          const reference = parseValue(result.data)
          if (!reference) {
            setScanError(invalidQrMessage)
            return
          }

          scanner.stop()
          onScanRef.current(reference)
        },
        {
          preferredCamera: 'environment',
          maxScansPerSecond: 12,
          highlightScanRegion: false,
          highlightCodeOutline: false,
          returnDetailedScanResult: true,
        },
      )

      try {
        await scanner.start()
        if (cancelled) {
          scanner.destroy()
          return
        }

        window.clearTimeout(startupTimer)
        scannerRef.current = scanner
        setCameraError('')
        setCameraState('active')
      } catch (error) {
        scanner.destroy()
        if (cancelled) return

        window.clearTimeout(startupTimer)
        setCameraState('error')
        setCameraError(cameraErrorMessage(error))
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      window.clearTimeout(startupTimer)
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [active, activeMessage, cameraAttempt, fallbackMessage, invalidQrMessage, parseValue])

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsReadingImage(true)
    setScanError('')

    try {
      const reference = parseValue(await decodeQrImage(file))
      if (!reference) {
        setScanError(invalidQrMessage)
        return
      }

      scannerRef.current?.stop()
      onScan(reference)
    } catch {
      setScanError(invalidQrMessage)
    } finally {
      setIsReadingImage(false)
    }
  }

  function retryCamera() {
    setCameraError('')
    setScanError('')
    setCameraAttempt((attempt) => attempt + 1)
  }

  return (
    <section aria-label="Live QR scanner">
      <div className="relative aspect-square overflow-hidden rounded-[1.6rem] bg-[#211b13] shadow-[0_12px_28px_rgba(27,28,25,0.2)]">
        {cameraState === 'insecure' ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#302f2b] px-8 text-center text-white">
            <span className="grid size-16 place-items-center rounded-full bg-[#171814] text-[#f7c842]" aria-hidden="true">
              <CameraOff size={29} />
            </span>
            <div>
              <p className="text-lg font-black">Secure camera link needed</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-white/75">
                This HTTP address cannot request live camera access.
              </p>
            </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline aria-label="Live camera preview" />
            <span className="pointer-events-none absolute inset-7 rounded-[1.25rem] border-2 border-[#f7c842] shadow-[0_0_0_999px_rgba(18,14,8,0.28)]" aria-hidden="true" />
            {cameraState !== 'active' ? (
              <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#171814]/80 text-[#f7c842]" aria-hidden="true">
                {cameraState === 'starting' ? <LoaderCircle className="animate-spin" size={28} /> : <CameraOff size={28} />}
              </span>
            ) : (
              <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#171814]/55 text-[#f7c842]" aria-hidden="true">
                <Camera size={25} />
              </span>
            )}
          </>
        )}
      </div>

      <p className="mt-4 text-center text-sm font-semibold leading-5 text-arka-muted">
        {cameraState === 'active'
          ? activeMessage
          : cameraState === 'starting'
            ? 'Starting your camera...'
            : cameraState === 'insecure'
              ? 'Open the phone camera below, or use a secure HTTPS link for live scanning.'
              : fallbackMessage}
      </p>

      {cameraError ? (
        <p
          className={cameraState === 'insecure'
            ? 'mt-3 rounded-2xl bg-[#fff2c5] px-4 py-3 text-sm font-semibold leading-5 text-[#6c4c00]'
            : 'mt-3 text-sm font-semibold leading-5 text-arka-error'}
          role={cameraState === 'insecure' ? 'status' : 'alert'}
        >
          {cameraError}
        </p>
      ) : null}
      {scanError ? <p className="mt-3 text-sm font-semibold leading-5 text-arka-error" role="alert">{scanError}</p> : null}

      {cameraState === 'error' ? (
        <Button className="mt-4" type="button" variant="secondary" onClick={retryCamera}>
          <RotateCcw size={19} /> Try camera again
        </Button>
      ) : null}

      {cameraState !== 'active' ? (
        <label className={cameraState === 'error' ? 'mt-2 block' : 'mt-4 block'}>
          <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={handleImage} />
          <span className="inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#f7c842] px-5 py-3 text-base font-extrabold text-[#171814] shadow-[0_6px_14px_rgba(225,166,0,0.22)] transition active:scale-[0.98]">
            <Camera size={20} />
            {isReadingImage ? 'Reading image...' : 'Open phone camera'}
          </span>
        </label>
      ) : null}

      <label className={cameraState === 'active' ? 'mt-4 block' : 'mt-2 block'}>
        <input className="sr-only" type="file" accept="image/*" onChange={handleImage} />
        <span className="inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#e0c99f] bg-white px-5 py-3 text-base font-extrabold text-arka-text shadow-[0_4px_8px_rgba(27,28,25,0.05)] transition active:scale-[0.98]">
          <ImageUp size={20} />
          {isReadingImage ? 'Reading image...' : 'Choose a saved QR photo'}
        </span>
      </label>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-arka-muted">
        <ShieldCheck size={14} /> Camera frames stay on this device.
      </p>
    </section>
  )
}

export function InviteQrScanner({
  active = true,
  onScan,
}: {
  active?: boolean
  onScan: (reference: string) => void
}) {
  return (
    <QrScannerView
      active={active}
      onScan={onScan}
      parseValue={parseInviteReference}
      invalidQrMessage="That QR is not an Arka invitation."
      activeMessage="Point your camera at the invite QR. It opens automatically."
      fallbackMessage="Use a QR photo or enter the invitation code below."
    />
  )
}

export function InviteQrScannerSheet({
  open,
  onClose,
  onScan,
}: {
  open: boolean
  onClose: () => void
  onScan: (reference: string) => void
}) {
  return (
    <BottomSheet open={open} title="Scan Arka invite" eyebrow="Camera" onClose={onClose}>
      <InviteQrScanner active={open} onScan={onScan} />
      <Button className="mt-2" type="button" variant="ghost" onClick={onClose}>Enter code instead</Button>
    </BottomSheet>
  )
}

import type { Arka } from '../../types/arka'
import { formatNim, formatUsd } from '../arka/formatMoney'

export async function createArkaReceipt(arka: Arka) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Receipt image is unavailable')

  context.fillStyle = '#faf7ef'
  context.fillRect(0, 0, 1080, 1350)
  context.fillStyle = '#1b1c19'
  context.beginPath()
  context.roundRect(70, 70, 940, 1210, 42)
  context.fill()
  context.fillStyle = '#f7c842'
  context.beginPath()
  context.roundRect(125, 125, 86, 86, 24)
  context.fill()
  context.fillStyle = '#1b1c19'
  context.font = '900 48px system-ui'
  context.textAlign = 'center'
  context.fillText('A', 168, 185)
  context.textAlign = 'left'
  context.fillStyle = '#fff'
  context.font = '900 48px system-ui'
  context.fillText('arka', 235, 184)
  context.fillStyle = '#f7c842'
  context.font = '800 27px system-ui'
  context.fillText('ARKA COMPLETED', 125, 330)
  context.fillStyle = '#fff'
  context.font = '900 72px system-ui'
  context.fillText(arka.name.slice(0, 24), 125, 420)
  context.font = '900 116px system-ui'
  context.fillText(formatUsd(arka.totalFiat), 125, 590)
  context.fillStyle = '#f7c842'
  context.font = '800 38px system-ui'
  context.fillText(`≈ ${formatNim(arka.totalNimEstimate)}`, 125, 652)
  context.fillStyle = '#292a27'
  context.beginPath()
  context.roundRect(125, 740, 830, 280, 30)
  context.fill()
  context.fillStyle = '#aaa99f'
  context.font = '700 25px system-ui'
  context.fillText('PEOPLE', 175, 820)
  context.fillText('ASSET', 470, 820)
  context.fillText('STATUS', 710, 820)
  context.fillStyle = '#fff'
  context.font = '900 48px system-ui'
  context.fillText(String(arka.members.length), 175, 895)
  context.fillText(arka.selectedAsset, 470, 895)
  context.fillText('ALL PAID', 710, 895)
  context.fillStyle = '#aaa99f'
  context.font = '650 25px system-ui'
  context.fillText(`${arka.members.length} of ${arka.members.length} confirmed`, 175, 965)
  context.fillStyle = '#fff'
  context.font = '800 31px system-ui'
  context.fillText('Paid together with Arka', 125, 1135)
  context.fillStyle = '#aaa99f'
  context.font = '650 25px system-ui'
  context.fillText('Collected by the host, settled with Nimiq Pay.', 125, 1185)

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create receipt')), 'image/png'))
  return new File([blob], `arka-${arka.code}-receipt.png`, { type: 'image/png' })
}

export async function shareArkaReceipt(arka: Arka) {
  const file = await createArkaReceipt(arka)
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `${arka.name} completed`, text: 'Arka completed. Everyone paid.', files: [file] })
    return 'shared' as const
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  return 'downloaded' as const
}

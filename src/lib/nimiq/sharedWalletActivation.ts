import { init } from '@nimiq/mini-app-sdk'
import { isNimiqPayEnvironment } from './detectNimiqEnvironment'
import { bytesToHex } from './sharedWalletCrypto'

const HUB_URL = import.meta.env.VITE_NIMIQ_HUB_URL?.trim() || 'https://hub.nimiq.com'

export type WalletActivationSignature = {
  signer?: string
  publicKey: string
  signature: string
}

export async function requestSharedWalletActivation(
  message: string,
  walletAddress: string,
): Promise<WalletActivationSignature> {
  if (isNimiqPayEnvironment()) {
    const provider = await init({ timeout: 8_000 })
    await provider.connect()
    const result = await provider.sign(message)
    if ('error' in result) throw new Error(result.error.message || 'Wallet activation was rejected.')
    return {
      signer: walletAddress,
      publicKey: result.publicKey,
      signature: result.signature,
    }
  }

  const { default: HubApi } = await import('@nimiq/hub-api')
  const hub = new HubApi(HUB_URL)
  const result = await hub.signMessage({
    appName: 'Arka',
    signer: walletAddress,
    message,
  })

  return {
    signer: result.signer,
    publicKey: bytesToHex(result.signerPublicKey),
    signature: bytesToHex(result.signature),
  }
}

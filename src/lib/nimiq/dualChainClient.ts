import { init, type NimiqProvider, type SignatureResult } from '@nimiq/mini-app-sdk'

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export type NimiqFlowStep = 'requesting-nimiq-accounts' | 'requesting-nimiq-signing'
export type EthereumFlowStep = 'requesting-ethereum-accounts' | 'requesting-ethereum-signing'

export type NimiqFlowResult = {
  accounts: string[]
  signature: SignatureResult
}

export type EthereumFlowResult = {
  accounts: string[]
  signature: string
}

const DUAL_CHAIN_MESSAGE = 'Arka dual-chain wallet test'

let nimiqProviderPromise: Promise<NimiqProvider> | null = null

export function getNimiqProviderPromise() {
  nimiqProviderPromise ??= init({ timeout: 10_000 })
  return nimiqProviderPromise
}

export function getEthereumProvider() {
  return typeof window !== 'undefined' ? window.ethereum ?? null : null
}

export function getProviderErrorMessage(value: unknown) {
  if (typeof value === 'object' && value !== null && 'error' in value) {
    const error = (value as { error?: { code?: unknown; message?: unknown } }).error
    if (error?.code === 4001) return 'Request cancelled. You can try again when ready.'
    if (typeof error?.message === 'string') return error.message
  }

  if (value instanceof Error) {
    if (/cancel|denied|reject|user rejected/i.test(value.message)) {
      return 'Request cancelled. You can try again when ready.'
    }
    if (/inject|provider|nimiq pay|not found/i.test(value.message)) {
      return 'Open Arka inside Nimiq Pay to use wallet actions.'
    }
  }

  return 'Wallet request failed. Please try again.'
}

function toHexUtf8(input: string) {
  return `0x${Array.from(new TextEncoder().encode(input))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

export async function runNimiqFlow(onStep?: (step: NimiqFlowStep) => void): Promise<NimiqFlowResult> {
  const nimiq = await getNimiqProviderPromise()

  onStep?.('requesting-nimiq-accounts')
  const accountsResult = await nimiq.listAccounts()
  if (typeof accountsResult === 'object' && accountsResult !== null && 'error' in accountsResult) {
    throw new Error(getProviderErrorMessage(accountsResult))
  }

  const accounts = accountsResult as string[]
  if (!accounts.length) throw new Error('No Nimiq account was returned.')

  onStep?.('requesting-nimiq-signing')
  const signatureResult = await nimiq.sign(DUAL_CHAIN_MESSAGE)
  if (typeof signatureResult === 'object' && signatureResult !== null && 'error' in signatureResult) {
    throw new Error(getProviderErrorMessage(signatureResult))
  }

  return { accounts, signature: signatureResult as SignatureResult }
}

export async function runEthereumFlow(onStep?: (step: EthereumFlowStep) => void): Promise<EthereumFlowResult> {
  const ethereum = getEthereumProvider()
  if (!ethereum) throw new Error('Ethereum provider not found. Open Arka inside Nimiq Pay.')

  onStep?.('requesting-ethereum-accounts')
  const accountsResult = await ethereum.request({ method: 'eth_requestAccounts' })
  if (typeof accountsResult !== 'object' || accountsResult === null || !Array.isArray(accountsResult)) {
    throw new Error('No Ethereum account was returned.')
  }

  const accounts = accountsResult as string[]
  if (!accounts.length) throw new Error('No Ethereum account was returned.')

  onStep?.('requesting-ethereum-signing')
  const signatureResult = await ethereum.request({
    method: 'personal_sign',
    params: [toHexUtf8(DUAL_CHAIN_MESSAGE), accounts[0]],
  })
  if (typeof signatureResult !== 'string') throw new Error('Ethereum signing did not return a signature.')

  return { accounts, signature: signatureResult }
}

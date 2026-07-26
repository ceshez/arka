import type { Arka, ArkaCategory, ArkaRole, ArkaType, AssetSymbol, SplitMethodType } from '../../types/arka'
import type { PaymentStatus, PaymentType } from '../../types/payment'
import { isNimiqPayEnvironment } from '../nimiq/detectNimiqEnvironment'
import { getSupabaseClient, getSupabaseConfiguration } from '../supabase/client'
import { createRandomId } from '../utils/createRandomId'

export type AnalyticsEventName =
  | 'app_opened'
  | 'screen_viewed'
  | 'demo_started'
  | 'create_started'
  | 'invite_viewed'
  | 'invite_shared'
  | 'invite_opened'
  | 'join_started'
  | 'join_failed'
  | 'payment_summary_viewed'
  | 'payment_started'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'payment_cancelled'
  | 'arka_ready_to_settle'
  | 'settlement_started'
  | 'settlement_confirmed'
  | 'settlement_failed'
  | 'settlement_cancelled'
  | 'arka_completed'
  | 'success_card_shared'
  | 'error_occurred'

type AnalyticsInviteMethod = 'native-share' | 'clipboard' | 'qr' | 'link' | 'code' | 'unknown'
type AnalyticsEnvironment = 'development' | 'test' | 'production'

export type AnalyticsEventContext = {
  arkaId?: string
  actorRole?: ArkaRole
  arkaType?: ArkaType
  category?: ArkaCategory
  splitMethod?: SplitMethodType
  inviteMethod?: AnalyticsInviteMethod
  asset?: AssetSymbol
  paymentType?: PaymentType
  paymentStatus?: Exclude<PaymentStatus, 'idle'>
  errorCode?: string
  route?: string
  amountFiat?: number
  amountNim?: number
  amountUsdt?: number
  durationMs?: number
  memberCount?: number
  isDemo?: boolean
}

const installationStorageKey = 'arka-analytics-installation-v1'
const sessionStorageKey = 'arka-analytics-session-v1'

function analyticsEnabled() {
  return import.meta.env.VITE_ANALYTICS_ENABLED === 'true'
}

function getOrCreateStorageValue(storage: Storage, key: string, createValue: () => string) {
  const existing = storage.getItem(key)
  if (existing) return existing

  const value = createValue()
  storage.setItem(key, value)
  return value
}

function getInstallationKey() {
  return getOrCreateStorageValue(
    window.localStorage,
    installationStorageKey,
    () => `${createRandomId()}:${createRandomId()}`,
  )
}

function getSessionId() {
  return getOrCreateStorageValue(window.sessionStorage, sessionStorageKey, createRandomId)
}

function getEnvironment(): AnalyticsEnvironment {
  if (import.meta.env.MODE === 'development') return 'development'
  if (import.meta.env.MODE === 'test') return 'test'
  return 'production'
}

export function sanitizeAnalyticsRoute(pathname: string) {
  return pathname
    .replace(/\/join\/[^/]+\/preview/g, '/join/:reference/preview')
    .replace(/\/arka\/[^/]+/g, '/arka/:arkaId')
    .slice(0, 128)
}

export function analyticsContextForArka(arka: Arka) {
  return {
    arkaId: arka.id,
    arkaType: arka.type,
    category: arka.metadata?.category,
    splitMethod: arka.splitMethod,
    memberCount: arka.members.length,
    isDemo: Boolean(arka.metadata?.isDemo),
  } satisfies AnalyticsEventContext
}

export async function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  context: AnalyticsEventContext = {},
) {
  if (!analyticsEnabled() || typeof window === 'undefined') return

  const configuration = getSupabaseConfiguration()
  if (!configuration) return

  try {
    const client = await getSupabaseClient(configuration)
    await client.rpc('record_analytics_event', {
      p_event_name: eventName,
      p_installation_key: getInstallationKey(),
      p_session_id: getSessionId(),
      p_event_id: createRandomId(),
      p_occurred_at: new Date().toISOString(),
      p_arka_id: context.arkaId ?? null,
      p_actor_role: context.actorRole ?? null,
      p_arka_type: context.arkaType ?? null,
      p_category: context.category ?? null,
      p_split_method: context.splitMethod ?? null,
      p_invite_method: context.inviteMethod ?? null,
      p_asset: context.asset ?? null,
      p_payment_type: context.paymentType ?? null,
      p_payment_status: context.paymentStatus ?? null,
      p_error_code: context.errorCode ?? null,
      p_route: context.route ? sanitizeAnalyticsRoute(context.route) : null,
      p_app_surface: isNimiqPayEnvironment() ? 'nimiq-pay' : 'browser',
      p_app_version: import.meta.env.VITE_APP_VERSION?.trim() || null,
      p_environment: getEnvironment(),
      p_amount_fiat: context.amountFiat ?? null,
      p_amount_nim: context.amountNim ?? null,
      p_amount_usdt: context.amountUsdt ?? null,
      p_duration_ms: context.durationMs ?? null,
      p_member_count: context.memberCount ?? null,
      p_is_demo: context.isDemo ?? false,
    })
  } catch {
    // Product actions must never fail because telemetry is unavailable.
  }
}

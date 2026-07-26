import type { SupabaseClient } from '@supabase/supabase-js'

export type SupabaseConfiguration = {
  url: string
  apiKey: string
}

let supabaseClient: Promise<SupabaseClient> | null = null
let supabaseClientSignature = ''

export function getSupabaseConfiguration(): SupabaseConfiguration | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  return url && apiKey ? { url, apiKey } : null
}

export function getSupabaseClient(configuration: SupabaseConfiguration) {
  const signature = `${configuration.url}:${configuration.apiKey}`

  if (!supabaseClient || supabaseClientSignature !== signature) {
    supabaseClient = import('@supabase/supabase-js').then(({ createClient }) => (
      createClient(configuration.url, configuration.apiKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      })
    ))
    supabaseClientSignature = signature
  }

  return supabaseClient
}

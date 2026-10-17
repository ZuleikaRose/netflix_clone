import { createClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, supabaseConfig } from './supabaseConfig.js'

// The session is saved in localStorage (AUTH_STORAGE_KEY), so a reload keeps the member signed in until they sign
// out, and tokens refresh automatically. /reset-password reads its recovery link itself, so detectSessionInUrl is off.
export const supabase = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.key, {
    auth: { persistSession: true, storageKey: AUTH_STORAGE_KEY, autoRefreshToken: true, detectSessionInUrl: false },
  })
  : null

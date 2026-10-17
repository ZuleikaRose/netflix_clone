import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from './supabaseConfig.js'

// The session is kept in memory only, so a reload signs the user out (a requirement) and nothing goes to
// localStorage. Tokens still refresh while the page stays open.
export const supabase = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.key, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
  })
  : null

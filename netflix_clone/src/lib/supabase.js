import { createClient } from '@supabase/supabase-js'

// Configured from .env.local (see .env.example). Without it the app runs on its built-in catalog, as CI does.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// The app keeps no state between page loads, so the client must not save a session to localStorage either
export const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null

import { loadEnv } from 'vite'

export const E2E_PORT = 4173
export const SUPABASE_E2E_PORT = 4174

// The variables both e2e builds bake in (`vite build --mode development`). CI has no .env.development.local, so the
// app runs on its built-in catalog and in-memory accounts there, and the Supabase checks skip.
const env = loadEnv('development', process.cwd(), 'VITE_')
export const supabaseConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY)

// Public Auth settings of the dev project, e.g. whether sign-ups must confirm their email first
export async function supabaseAuthSettings() {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY } })
  return response.json()
}

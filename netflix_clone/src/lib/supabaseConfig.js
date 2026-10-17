// Read from .env.development.local / .env.production.local (see .env.example). Without them the app runs on its
// built-in catalog and in-memory accounts, as CI does.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfig = url && key ? { url, key } : null

// 'supabase' signs in with Supabase Auth and saves each user's data. VITE_AUTH_BACKEND=memory keeps accounts in memory
// even when Supabase is configured: the e2e suite does that so its 100+ sign-ins stay local and fast.
export const authBackend = supabaseConfig && import.meta.env.VITE_AUTH_BACKEND !== 'memory' ? 'supabase' : 'memory'

// The client is loaded on first use, so its ~200 kB stays out of the first page load. Resolves to null without config.
export const getSupabase = () => import('./supabase.js').then((m) => m.supabase)

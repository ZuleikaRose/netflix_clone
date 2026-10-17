import { authBackend } from '../lib/supabaseConfig.js'
import { MemoryAuthProvider } from './MemoryAuthProvider.jsx'
import { SupabaseAuthProvider } from './SupabaseAuthProvider.jsx'

// Supabase Auth when the project is configured; otherwise (CI, e2e suite) accounts kept in memory
export function AuthProvider({ children }) {
  return authBackend === 'supabase'
    ? <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
    : <MemoryAuthProvider>{children}</MemoryAuthProvider>
}

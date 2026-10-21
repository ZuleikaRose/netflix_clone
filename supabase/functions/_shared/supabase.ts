// Shared by the Edge Functions: CORS, JSON responses, Supabase clients and the signed-in caller.
// Every function is deployed with verify_jwt = false (publishable keys aren't JWTs), so callers are checked here.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.117.2'

const url = Deno.env.get('SUPABASE_URL')!
// New-style keys when the project has them, otherwise the legacy ones
const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const publishableKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_ANON_KEY')!

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

// Bypasses RLS: only for the checks and writes each function exists to do
export const admin: SupabaseClient = createClient(url, secretKey, noSession)

// A fresh client with the publishable key, e.g. to check a password without touching the caller's session
export const publicClient = (): SupabaseClient => createClient(url, publishableKey, noSession)

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// The access token's claims (getUser has already checked its signature)
function claimsOf(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')))
  } catch {
    return {}
  }
}

// The user whose access token is on the request, or null. A member with two-step sign-in on counts only once they've
// entered a code (an aal2 session), like public.second_step_done() in the database.
export async function callerFrom(req: Request): Promise<{ user: User; token: string } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  const twoStep = data.user.factors?.some((f) => f.status === 'verified') ?? false
  if (twoStep && claimsOf(token).aal !== 'aal2') return null
  return { user: data.user, token }
}

// The caller's IP as the platform's proxy reports it (first address in X-Forwarded-For)
export const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

// Counts a request against a per-key limit (public.hit_rate_limit); false once `maxHits` fall in `windowSeconds`
export async function allowRequest(key: string, maxHits: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin.rpc('hit_rate_limit', { key, max_hits: maxHits, window_seconds: windowSeconds })
  if (error) throw error
  return data === true
}

// Wraps a POST handler with CORS preflight, method check and a JSON body
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      // Empty or invalid body: handlers validate what they need
    }
    try {
      return await handler(req, body)
    } catch (error) {
      console.error(error)
      return json({ error: 'Something went wrong. Please try again.' }, 500)
    }
  })
}

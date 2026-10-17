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

// The user whose access token is on the request, or null
export async function callerFrom(req: Request): Promise<{ user: User; token: string } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error || !data.user ? null : { user: data.user, token }
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

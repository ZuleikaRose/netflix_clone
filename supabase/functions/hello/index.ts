// GET /functions/v1/hello → { message: 'Hello World' }
// A public health check: no sign-in, no keys and no database, so it doesn't import _shared/supabase.ts (whose clients
// need the project's secrets and whose CORS allows POST only).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return new Response(JSON.stringify({ message: 'Hello World' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

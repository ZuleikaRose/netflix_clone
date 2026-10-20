// GET /functions/v1/multiply?a=6&b=6 or POST { a: 6, b: 6 } → { result: 36 }
// Public like hello: no sign-in, no keys and no database.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// A finite number from a JSON number or a numeric string; null for anything else (including '' and missing values)
const toNumber = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return null
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let params: Record<string, unknown> = Object.fromEntries(new URL(req.url).searchParams)
  if (req.method === 'POST') {
    try {
      params = { ...params, ...(await req.json()) }
    } catch {
      // Empty or invalid body: fall back to the query string
    }
  }

  const a = toNumber(params.a)
  const b = toNumber(params.b)
  if (a === null || b === null) return json({ error: 'Send two numbers as a and b, e.g. ?a=6&b=6.' }, 400)

  const result = a * b
  if (!Number.isFinite(result)) return json({ error: 'The result is too large.' }, 400)
  return json({ result })
})

// POST /functions/v1/record-referral { code } → { ok: true }
// Counts a click on an affiliate link (/signup?ref=CODE). Visitors aren't signed in, so this is public; sign-ups are
// counted by the sign-up trigger from the referral_code the app passes to Supabase Auth.
import { admin, allowRequest, clientIp, json, serve } from '../_shared/supabase.ts'

// One click per visitor IP per link per hour, so reloading or scripting the link doesn't inflate the count
const CLICK_WINDOW_SECONDS = 3600

serve(async (req, body) => {
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase().slice(0, 24) : ''
  if (!code) return json({ error: 'Missing referral code.' }, 400)

  const { data: affiliate, error } = await admin.from('affiliates').select('id').eq('referral_code', code).maybeSingle()
  if (error) throw error
  // The same answer for unknown codes and repeat clicks, so the endpoint reveals nothing about either
  if (!affiliate) return json({ ok: true })
  if (!(await allowRequest(`referral-click:${clientIp(req)}:${code}`, 1, CLICK_WINDOW_SECONDS))) return json({ ok: true })

  const { error: insertError } = await admin.from('referrals').insert({ affiliate_id: affiliate.id, kind: 'click' })
  if (insertError) throw insertError
  return json({ ok: true })
})

// POST /functions/v1/apply-promo { code } or { remove: true } (signed in) → { promo: { code, percentOff, plan } | null }
// Codes are checked against public.promotions, which browsers can't read; the result is the one code on the account.
import { admin, callerFrom, json, serve } from '../_shared/supabase.ts'

const planNames: Record<string, string> = { basic: 'Basic', standard: 'Standard', premium: 'Premium' }

serve(async (req, body) => {
  const caller = await callerFrom(req)
  if (!caller) return json({ error: 'Please sign in again.' }, 401)
  const userId = caller.user.id

  if (body.remove === true) {
    const { error } = await admin.from('promo_codes').delete().eq('user_id', userId)
    if (error) throw error
    return json({ promo: null })
  }

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const { data: promo, error } = await admin.from('promotions').select('code, percent_off, plan').eq('code', code).maybeSingle()
  if (error) throw error
  if (!promo) return json({ error: 'That code isn’t valid. Check the spelling and try again.' }, 400)

  const { data: account, error: accountError } = await admin.from('netflix_tables').select('plan').eq('id', userId).single()
  if (accountError) throw accountError
  if (promo.plan && promo.plan !== account.plan) {
    return json({ error: `${promo.code} only works with the ${planNames[promo.plan]} plan.` }, 400)
  }

  const { error: saveError } = await admin.from('promo_codes').upsert(
    { user_id: userId, code: promo.code, percent_off: promo.percent_off, plan: promo.plan, applied_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (saveError) throw saveError
  return json({ promo: { code: promo.code, percentOff: promo.percent_off, plan: promo.plan } })
})

import { defaultBilling } from './billing.js'

// Accounts in Supabase: netflix_tables + preferences + promo_codes ↔ the `user` object the pages use.
// Every call takes the client so this module doesn't pull supabase-js into the first page load.

const defaultPreferences = { autoplay_next: true, autoplay_previews: false, email_updates: true, personalized: true, maturity_rating: 'all' }

const preferenceColumns = {
  autoplayNext: 'autoplay_next',
  autoplayPreviews: 'autoplay_previews',
  emailUpdates: 'email_updates',
  personalized: 'personalized',
  maturity: 'maturity_rating',
}

// date columns ↔ ISO strings. Local noon, so formatting in any time zone shows the stored day.
const fromDateColumn = (date) => (date ? `${date}T12:00:00` : null)
function toDateColumn(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toUser(authUser, account, prefs, promo) {
  const p = { ...defaultPreferences, ...prefs }
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    plan: account.plan,
    promo: promo?.code ?? null,
    isDemo: authUser.app_metadata?.demo === true,
    preferences: Object.fromEntries(Object.entries(preferenceColumns).map(([key, column]) => [key, p[column]])),
    billing: {
      day: account.billing_day ?? defaultBilling.day,
      card: account.card_last4 ? { brand: account.card_brand, last4: account.card_last4, exp: account.card_exp } : defaultBilling.card,
      status: account.membership_status,
      resumesOn: fromDateColumn(account.resumes_on),
      endsOn: fromDateColumn(account.ends_on),
    },
  }
}

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

export async function loadAccount(supabase, authUser) {
  const id = authUser.id
  const [account, prefs, promo] = await Promise.all([
    supabase.from('netflix_tables').select('*').eq('id', id).single().then(unwrap),
    supabase.from('preferences').select('*').eq('user_id', id).maybeSingle().then(unwrap),
    supabase.from('promo_codes').select('code').eq('user_id', id).maybeSingle().then(unwrap),
  ])
  return toUser(authUser, account, prefs, promo)
}

// A Billing patch ({ day }, { card }, { status, resumesOn, endsOn }…) as netflix_tables columns
export function billingColumns(patch) {
  const columns = {}
  if ('day' in patch) columns.billing_day = patch.day
  if ('card' in patch) Object.assign(columns, { card_brand: patch.card.brand, card_last4: patch.card.last4, card_exp: patch.card.exp })
  if ('status' in patch) columns.membership_status = patch.status
  if ('resumesOn' in patch) columns.resumes_on = toDateColumn(patch.resumesOn)
  if ('endsOn' in patch) columns.ends_on = toDateColumn(patch.endsOn)
  return columns
}

// PostgREST refuses an UPDATE without a filter, so every write names the row
export const saveAccount = (supabase, id, columns) => supabase.from('netflix_tables').update(columns).eq('id', id).then(unwrap)

export const savePreference = (supabase, id, key, value) =>
  supabase.from('preferences').upsert({ user_id: id, [preferenceColumns[key]]: value }, { onConflict: 'user_id' }).then(unwrap)

// Calls an Edge Function; resolves to { data } or { error } with the function's own message when it sent one
export async function callFunction(supabase, name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return { data }
  const message = await error.context?.json?.().then((b) => b.error).catch(() => null)
  return { error: message ?? 'Something went wrong. Please try again.' }
}

// Supabase Auth errors as the messages the forms show
export function authErrorMessage(error) {
  switch (error.code) {
    case 'invalid_credentials': return 'Incorrect email or password.'
    case 'user_banned': return 'This account’s access has been removed. Contact support to restore it.'
    case 'email_not_confirmed': return 'Please confirm your email address first: check your inbox for the link.'
    case 'user_already_exists':
    case 'email_exists': return 'An account with this email already exists.'
    case 'same_password': return 'Choose a password you haven’t used for this account.'
    // Supabase's built-in email only delivers to the project's team until custom SMTP is set up
    case 'email_address_not_authorized': return 'We can’t send a confirmation email to this address yet. Please try again later.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit': return 'Too many attempts. Please wait a minute and try again.'
    default: return error.message || 'Something went wrong. Please try again.'
  }
}

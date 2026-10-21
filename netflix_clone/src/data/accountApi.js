import { defaultBilling } from './billing.js'
import { loadProfiles } from './profilesApi.js'

// Accounts in Supabase: netflix_tables + preferences + promo_codes ↔ the `user` object the pages use.
// Every call takes the client so this module doesn't pull supabase-js into the first page load.

const defaultPreferences = { autoplay_next: true, autoplay_previews: false, email_updates: true, personalized: true, maturity_rating: 'all' }

const preferenceColumns = {
  autoplayNext: 'autoplay_next',
  autoplayPreviews: 'autoplay_previews',
  emailUpdates: 'email_updates',
  personalized: 'personalized',
  playerVolume: 'player_volume', // 0-100, null = never set (the player then uses this browser's level)
  showOnLeaderboards: 'show_on_leaderboards', // opt-in: first name and best scores on game leaderboards
  keepHistory: 'keep_viewing_history', // off: nothing new goes into viewing history (the database also refuses it)
  historyRetention: 'history_retention_days', // 90 or 365: older history is deleted nightly; null = kept
}

// date columns ↔ ISO strings. Local noon, so formatting in any time zone shows the stored day.
const fromDateColumn = (date) => (date ? `${date}T12:00:00` : null)
function toDateColumn(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toUser(authUser, account, prefs, promo, profiles) {
  const p = { ...defaultPreferences, ...prefs }
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    plan: account.plan,
    promo: promo?.code ?? null,
    isDemo: authUser.app_metadata?.demo === true,
    profiles,
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
  const [account, prefs, promo, profiles, staff] = await Promise.all([
    supabase.from('netflix_tables').select('*').eq('id', id).single().then(unwrap),
    supabase.from('preferences').select('*').eq('user_id', id).maybeSingle().then(unwrap),
    supabase.from('promo_codes').select('code').eq('user_id', id).maybeSingle().then(unwrap),
    loadProfiles(supabase, id),
    // Support staff see the support dashboard (RLS: a member can read only their own staff row)
    supabase.from('staff').select('user_id').eq('user_id', id).maybeSingle().then(unwrap),
  ])
  return { ...toUser(authUser, account, prefs, promo, profiles), isStaff: Boolean(staff) }
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

// Calls an Edge Function; resolves to { data } or { error } with the function's own message when it sent one.
// Never throws: network failures (no response to read) become the generic message too.
export async function callFunction(supabase, name, body = {}) {
  const fallback = { error: 'Something went wrong. Check your connection and try again.' }
  try {
    const { data, error } = await supabase.functions.invoke(name, { body })
    if (!error) return { data }
    // An HTTP error carries the Response; a fetch failure doesn't
    const response = error.context
    const sent = typeof response?.json === 'function' ? await response.json().catch(() => null) : null
    return sent?.error ? { error: sent.error } : fallback
  } catch {
    return fallback
  }
}

// Supabase Auth's weak_password error: reasons 'length', 'characters' and/or 'pwned'; the minimum length is only in
// the message ("Password should be at least 13 characters…") and depends on the project's settings
function weakPasswordMessage({ reasons = [], message = '' }) {
  if (reasons.includes('pwned')) return 'This password has appeared in a data breach. Please choose a different one.'
  const needs = []
  if (reasons.includes('length')) needs.push(`at least ${message.match(/at least (\d+) characters/)?.[1] ?? 'more'} characters`)
  if (reasons.includes('characters')) needs.push('a lowercase letter, an uppercase letter, a number and a symbol')
  return needs.length ? `Your password needs ${needs.join(' and ')}.` : 'Please choose a stronger password.'
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
    // The project's Auth password rules (length, required characters, leaked-password check) are stricter than the form's
    case 'weak_password': return weakPasswordMessage(error)
    // Supabase's built-in email only delivers to the project's team until custom SMTP is set up
    case 'email_address_not_authorized': return 'We can’t send a confirmation email to this address yet. Please try again later.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit': return 'Too many attempts. Please wait a minute and try again.'
    default: return error.message || 'Something went wrong. Please try again.'
  }
}

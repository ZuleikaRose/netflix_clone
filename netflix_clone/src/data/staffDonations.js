import { STRIPE_PUBLISHABLE_KEY } from './donations.js'

// The support dashboard's Donations view (migration ..._staff_donations): totals by month and the latest donations,
// through staff-only database functions. In memory (no other members) a few sample donations stand in.

export const donationFilters = [
  { value: null, label: 'All' },
  { value: 'succeeded', label: 'Paid' },
  { value: 'failed', label: 'Didn’t go through' },
]

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

export const fetchDonationMonths = (supabase) => supabase.rpc('staff_donation_months', { p_months: 12 }).then(unwrap)
  .then((rows) => rows.map((r) => ({ month: r.month, paidCount: Number(r.paid_count), paidCents: Number(r.paid_cents), failedCount: Number(r.failed_count) })))
export const fetchRecentDonations = (supabase, status) => supabase.rpc('staff_recent_donations', { p_status: status }).then(unwrap)
  .then((rows) => rows.map((r) => ({
    id: r.id, amount: r.amount, status: r.status, at: new Date(r.created_at), member: r.member_name, paymentId: r.stripe_payment_intent_id,
  })))

// The payment in the Stripe Dashboard (test-mode keys open the test data), where staff can refund it
export function stripePaymentUrl(paymentId) {
  if (!paymentId?.startsWith('pi_')) return null
  const mode = STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_') ? 'test/' : ''
  return `https://dashboard.stripe.com/${mode}payments/${paymentId}`
}

const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
// "2026-10-01" (a month from the database) → "October 2026"
export const formatMonth = (isoDate) => monthName.format(new Date(`${isoDate}T00:00:00Z`))

// In memory: sample donations from this month (UTC) and last, with no Stripe payments behind them
export function sampleDonations(now = new Date()) {
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()
  // This month's first moments, so they stay in this month (and in the past) on any day
  const thisMonth = (minutes) => new Date(Math.min(now.getTime(), Date.UTC(year, monthIndex, 1, 0, minutes)))
  const lastMonth = (day) => new Date(Date.UTC(year, monthIndex - 1, day, 12))
  return [
    { id: 'sample-1', amount: 1000, status: 'succeeded', at: thisMonth(3), member: 'Jordan', paymentId: null },
    { id: 'sample-2', amount: 500, status: 'failed', at: thisMonth(2), member: 'Sam', paymentId: null },
    { id: 'sample-3', amount: 2500, status: 'succeeded', at: thisMonth(1), member: 'Priya', paymentId: null },
    { id: 'sample-4', amount: 5000, status: 'succeeded', at: lastMonth(20), member: 'Sam', paymentId: null },
    { id: 'sample-5', amount: 1000, status: 'succeeded', at: lastMonth(12), member: 'Jordan', paymentId: null },
  ]
}

// Donations → totals per UTC month, newest first (the same shape as staff_donation_months)
export function monthlyTotals(donations) {
  const months = new Map()
  for (const d of donations) {
    const key = `${d.at.toISOString().slice(0, 7)}-01`
    const m = months.get(key) ?? { month: key, paidCount: 0, paidCents: 0, failedCount: 0 }
    if (d.status === 'succeeded') {
      m.paidCount += 1
      m.paidCents += d.amount
    } else m.failedCount += 1
    months.set(key, m)
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month))
}

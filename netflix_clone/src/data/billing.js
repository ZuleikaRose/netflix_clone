import { locale, tr } from '../i18n/index.js'

// Billing is simulated: no payment is taken and full card numbers are never stored —
// only brand, last four digits and expiry are kept, as a real app's UI would receive from a payment processor.

export const defaultBilling = {
  day: 15,
  card: { brand: 'Visa', last4: '4242', exp: '08/28' },
  status: 'active', // 'active' | 'paused' | 'cancelled'
  resumesOn: null,
  endsOn: null,
}

export const pauseOptions = [1, 2, 3]

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// Next occurrence of `day` (1–28) on or after `from`
export function nextBillingDate(day, from = new Date()) {
  const today = startOfDay(from)
  const candidate = new Date(today.getFullYear(), today.getMonth(), day)
  return candidate >= today ? candidate : new Date(today.getFullYear(), today.getMonth() + 1, day)
}

export const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, date.getDate())

export const formatDate = (date) => date.toLocaleDateString(locale(), { month: 'long', day: 'numeric', year: 'numeric' })

// 1 → 1st, 2 → 2nd, 11 → 11th, 22 → 22nd (Spanish says "día 1", so just the number)
export function ordinal(n) {
  if (locale() !== 'en-US') return String(n)
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`
}

const brands = [
  ['Visa', /^4/],
  ['Mastercard', /^(5[1-5]|2[2-7])/],
  ['American Express', /^3[47]/],
  ['Discover', /^6(011|5)/],
]

export const cardBrand = (digits) => brands.find(([, re]) => re.test(digits))?.[0] ?? 'Card'

// Luhn checksum — catches typos in card numbers
export function passesLuhn(digits) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

// Returns field errors for a payment form; empty object when valid
export function validateCard({ name, number, exp, cvc }, now = new Date()) {
  const errors = {}
  const digits = number.replace(/[\s-]/g, '')
  if (!name.trim()) errors.name = tr('Enter the name on the card.')
  if (!/^\d{13,19}$/.test(digits) || !passesLuhn(digits)) errors.number = tr('Enter a valid card number.')
  const match = exp.match(/^(\d{2})\s*\/\s*(\d{2})$/)
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) {
    errors.exp = tr('Use the format MM/YY.')
  } else {
    // Cards are valid through the last day of their expiry month
    const expiresAfter = new Date(2000 + Number(match[2]), Number(match[1]), 1)
    if (expiresAfter <= now) errors.exp = tr('This card has expired.')
  }
  const cvcLength = cardBrand(digits) === 'American Express' ? 4 : 3
  if (!new RegExp(`^\\d{${cvcLength}}$`).test(cvc)) errors.cvc = tr('Enter the {count}-digit security code.', { count: cvcLength })
  return errors
}

// One-line membership state, shown on the Membership card and in Billing
export function billingSummary(billing) {
  if (billing.status === 'paused') return tr('Paused · resumes {date}', { date: formatDate(new Date(billing.resumesOn)) })
  if (billing.status === 'cancelled') return tr('Cancelled · you can watch until {date}', { date: formatDate(new Date(billing.endsOn)) })
  return tr('Next payment {date}', { date: formatDate(nextBillingDate(billing.day)) })
}

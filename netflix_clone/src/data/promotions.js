export const promotions = [
  { code: 'WELCOME50', title: 'Welcome offer', detail: '50% off your first month on any plan.', percent: 50 },
  { code: 'STUDENT20', title: 'Student discount', detail: '20% off every month with a valid student email.', percent: 20 },
  { code: 'FAMILY15', title: 'Family bundle', detail: '15% off Premium — share 4 screens for less.', percent: 15, plan: 'premium' },
]

export const findPromotion = (code) => promotions.find((p) => p.code === code?.trim().toUpperCase())

// Prices are stored as display strings ("$15.49"); work in cents to avoid float drift
export function discountedPrice(price, percent) {
  const cents = Math.round(parseFloat(price.replace('$', '')) * 100)
  return `$${(Math.round(cents * (100 - percent) / 100) / 100).toFixed(2)}`
}

export const plans = [
  { id: 'basic', name: 'Basic', price: '$7.99', quality: '720p (HD)', screens: 1 },
  { id: 'standard', name: 'Standard', price: '$15.49', quality: '1080p (Full HD)', screens: 2 },
  { id: 'premium', name: 'Premium', price: '$22.99', quality: '4K (Ultra HD) + HDR', screens: 4 },
]

export const findPlan = (id) => plans.find((p) => p.id === id) ?? plans[1]

// Affiliate program content and earnings rules (sample program for this demo)

// Flat commission per referred paying subscriber, tiered by lifetime referrals
export const commissionTiers = [
  { name: 'Starter', min: 1, max: 10, perSignup: 10 },
  { name: 'Pro', min: 11, max: 50, perSignup: 15 },
  { name: 'Partner', min: 51, max: Infinity, perSignup: 20 },
]

export const MIN_PAYOUT = 50
export const COOKIE_DAYS = 30

export const payoutMethods = ['PayPal', 'Bank transfer (ACH)', 'Gift card balance']

export const audienceSizes = ['Under 1,000', '1,000 – 10,000', '10,000 – 100,000', 'Over 100,000']

export const promotionChannels = ['Blog or website', 'YouTube', 'Instagram', 'TikTok', 'Newsletter', 'Podcast']

export const howItWorks = [
  { title: 'Apply', body: 'Tell us where you’ll promote us. Applications are reviewed instantly in this demo.' },
  { title: 'Share your link', body: `Every visitor who clicks your link is tracked for ${COOKIE_DAYS} days.` },
  { title: 'Earn', body: 'Get paid for each new subscriber who completes their first paid month.' },
]

export const eligibility = [
  'You must be 18 or older and hold an active membership.',
  'Your site or channel must be public and follow our content guidelines.',
  'One affiliate account per person; you can’t refer yourself or your household.',
]

export const restrictions = [
  'No paid search ads that bid on our brand name.',
  'No spam, unsolicited messages or misleading claims (e.g. “free forever”).',
  'No incentivized sign-ups such as cash back for subscribing.',
  'Don’t use our logo in a way that suggests you are us.',
]

export const tips = [
  { title: 'Drive traffic', body: 'Pair your link with honest reviews and “what to watch this weekend” lists — they convert best.' },
  { title: 'Track referrals', body: 'Use a different sub-ID per channel (e.g. ?sub=youtube) to see what works.' },
  { title: 'Maximize earnings', body: 'Time posts around big releases in New & Hot, when interest peaks.' },
]

export const marketingAssets = [
  { id: 'caption-weekend', kind: 'Social caption', text: 'Weekend sorted 🍿 Behind the Glass just dropped — start your membership:' },
  { id: 'caption-thriller', kind: 'Social caption', text: 'If you love a slow-burn thriller, The Signal is your next obsession. Watch here:' },
  { id: 'banner-wide', kind: 'Banner (728×90)', text: '<a href="{link}"><img src="https://example.com/banners/728x90.png" alt="Start watching" width="728" height="90"></a>' },
  { id: 'banner-square', kind: 'Banner (300×250)', text: '<a href="{link}"><img src="https://example.com/banners/300x250.png" alt="Start watching" width="300" height="250"></a>' },
]

export const tierFor = (signups) => commissionTiers.find((t) => signups >= t.min && signups <= t.max) ?? null

// Each signup is paid at the rate of the tier it falls in (like tax brackets)
export function earningsFor(signups) {
  return commissionTiers.reduce((total, t) => {
    const inTier = Math.max(0, Math.min(signups, t.max) - t.min + 1)
    return total + inTier * t.perSignup
  }, 0)
}

export const affiliateCode = (name) => `${name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'FRIEND'}${new Date().getFullYear() % 100}`

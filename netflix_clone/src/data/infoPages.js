// Help & legal pages, served at /info/:slug and listed in the footer (from the Figma reference)
export const infoPages = [
  { slug: 'support', label: 'Customer Support' },
  { slug: 'faqs', label: 'FAQs' },
  { slug: 'feedback', label: 'Feedback' },
  { slug: 'report-issue', label: 'Issue Reporting' },
  { slug: 'promotions', label: 'Promotions & Discounts' },
  { slug: 'tech-requirements', label: 'Technical Requirements' },
  { slug: 'ai', label: 'AI Integration' },
  { slug: 'affiliate', label: 'Affiliate Program' },
  { slug: 'legal', label: 'Legal & Privacy' },
  { slug: 'terms', label: 'Terms of Service' },
  { slug: 'privacy', label: 'Privacy Policy' },
  { slug: 'do-not-sell', label: 'Do Not Sell My Information' },
  { slug: 'accessibility', label: 'Accessibility Policy' },
]

export const infoLabel = (slug) => infoPages.find((p) => p.slug === slug)?.label

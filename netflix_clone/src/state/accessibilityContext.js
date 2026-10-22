import { createContext, useContext } from 'react'

export const AccessibilityContext = createContext(null)
export const useAccessibility = () => useContext(AccessibilityContext)

// Accessibility menu settings. They apply to the whole app (signed in or not); signed in with Supabase they are
// saved per member (AccessibilityProvider), otherwise they reset when the page reloads.
export const defaultA11y = {
  textSize: 100,
  font: 'default',
  lineHeight: 'default',
  letterSpacing: 'default',
  alignLeft: false,
  contrast: 'default',
  saturation: 'default',
  highlightLinks: false,
  highlightHeadings: false,
  strongFocus: false,
  bigCursor: false,
  readingGuide: false,
  hideImages: false,
  stopAnimations: false,
  captions: false,
  captionSize: 'medium',
  captionLanguage: 'en',
}

// Settings with a fixed set of values, shown as radio chips in the menu
export const a11yChoices = {
  textSize: { label: 'Text size', options: [[100, '100%'], [115, '115%'], [130, '130%'], [150, '150%']] },
  font: { label: 'Font', options: [['default', 'Default'], ['readable', 'Readable'], ['dyslexia', 'Dyslexia-friendly']] },
  lineHeight: { label: 'Line height', options: [['default', 'Default'], ['relaxed', '1.6×'], ['loose', '2×']] },
  letterSpacing: { label: 'Letter spacing', options: [['default', 'Default'], ['wide', 'Wide'], ['wider', 'Wider']] },
  contrast: { label: 'Contrast', options: [['default', 'Default'], ['high', 'High']] },
  saturation: { label: 'Color', options: [['default', 'Default'], ['low', 'Low saturation'], ['mono', 'Monochrome']] },
  captionSize: { label: 'Caption size', options: [['medium', 'Medium'], ['large', 'Large'], ['xlarge', 'Extra large']] },
  // A third value is the option's language, for screen readers
  captionLanguage: { label: 'Caption language', options: [['en', 'English', 'en'], ['es', 'Español', 'es']] },
}

// On/off settings, grouped as they appear in the menu
export const a11ySwitches = {
  text: [
    { key: 'alignLeft', label: 'Align text left', hint: 'Left-aligns centered text so lines start in the same place.' },
  ],
  navigation: [
    { key: 'highlightLinks', label: 'Highlight links', hint: 'Outlines and underlines every link.' },
    { key: 'highlightHeadings', label: 'Highlight headings', hint: 'Outlines headings so sections are easy to spot.' },
    { key: 'strongFocus', label: 'Strong focus outline', hint: 'A thick yellow outline shows where keyboard focus is.' },
    { key: 'bigCursor', label: 'Big cursor', hint: 'A larger mouse pointer.' },
    { key: 'readingGuide', label: 'Reading guide', hint: 'A bar that follows your pointer to keep your place.' },
  ],
  media: [
    { key: 'stopAnimations', label: 'Stop animations', hint: 'Turns off motion, transitions and video previews.' },
    { key: 'hideImages', label: 'Hide images', hint: 'Hides posters and artwork.' },
    { key: 'captions', label: 'Closed captions', hint: 'Show captions in the video player.' },
  ],
}

// One-tap profiles: each turns on a group of settings
export const a11yProfiles = [
  { id: 'seizure', label: 'Seizure safe', hint: 'Stops motion and tones down color.', settings: { stopAnimations: true, saturation: 'low' } },
  { id: 'vision', label: 'Low vision', hint: 'Bigger, clearer text and stronger contrast.', settings: { textSize: 130, font: 'readable', contrast: 'high', strongFocus: true } },
  { id: 'adhd', label: 'ADHD friendly', hint: 'Fewer distractions and a reading guide.', settings: { stopAnimations: true, readingGuide: true, highlightHeadings: true } },
  { id: 'dyslexia', label: 'Dyslexia friendly', hint: 'A dyslexia-friendly font with more spacing.', settings: { font: 'dyslexia', lineHeight: 'relaxed', letterSpacing: 'wide', alignLeft: true } },
  { id: 'keyboard', label: 'Keyboard navigation', hint: 'Strong focus outline and highlighted links.', settings: { strongFocus: true, highlightLinks: true } },
  { id: 'hearing', label: 'Deaf & hard of hearing', hint: 'Captions on, in a larger size.', settings: { captions: true, captionSize: 'large' } },
]

export const profileIsOn = (settings, profile) => Object.entries(profile.settings).every(([key, value]) => settings[key] === value)

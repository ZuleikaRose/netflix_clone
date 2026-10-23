import { tr } from '../i18n/index.js'

// Profiles: up to five per account, each with its own name, avatar colour and maturity rating (and its own lists,
// Continue Watching and game scores). The same limits are enforced by public.profiles in the database.

export const MAX_PROFILES = 5
export const MAX_PROFILE_NAME = 30

// Avatar colours, in the order the picker offers them. Each passes 3:1 against the dark page for the face.
export const avatarColors = [
  { key: 'blue', label: 'Blue', color: '#2c86c8' },
  { key: 'red', label: 'Red', color: '#d6453d' },
  { key: 'yellow', label: 'Yellow', color: '#e2b43a' },
  { key: 'green', label: 'Green', color: '#3f9b62' },
  { key: 'purple', label: 'Purple', color: '#8a63d2' },
]
export const avatarColor = (key) => (avatarColors.find((a) => a.key === key) ?? avatarColors[0]).color

export const maturityChoices = [
  { value: 'all', label: 'All maturity ratings' },
  { value: 'teen', label: 'Teens (TV-14, PG-13 and below)' },
  { value: 'kids', label: 'Kids (TV-PG, PG and below)' },
]

// An error message for a profile name, or null; `others` are the account's other profiles
export function profileNameProblem(name, others) {
  const trimmed = name.trim()
  if (!trimmed) return tr('Please enter a name.')
  if (trimmed.length > MAX_PROFILE_NAME) return tr('Names can be up to {count} characters.', { count: MAX_PROFILE_NAME })
  if (others.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return tr('Another profile already has this name.')
  return null
}

// Profile locks: a four-digit PIN; five wrong ones in a row lock the profile for this long (as in the database)
export const PIN_PATTERN = /^\d{4}$/
export const PIN_LOCKOUT_MINUTES = 15
export const MAX_PIN_ATTEMPTS = 5
export const pinMessages = {
  wrong: 'That PIN isn’t right. Please try again.',
  locked: `Too many wrong PINs. Try again in ${PIN_LOCKOUT_MINUTES} minutes.`,
}

// In memory: a profile with a random id (getRandomValues also works on plain-HTTP origins)
export const newProfileId = () => `profile-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')}`

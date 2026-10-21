// Custom lists: a profile's own named lists of titles, which it can share by link
export const MAX_LIST_NAME = 60
export const MAX_LIST_DESCRIPTION = 280

// An error message for a new or renamed list, or null. others: the profile's other lists
export function listNameProblem(name, others) {
  const trimmed = name.trim()
  if (!trimmed) return 'Please give the list a name.'
  if (trimmed.length > MAX_LIST_NAME) return `List names can be up to ${MAX_LIST_NAME} characters.`
  if (others.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) return `You already have a list called ${trimmed}.`
  return null
}

// 16 random hex characters, like the database's share slugs (in-memory lists only)
export const newShareSlug = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('')

export const sharePath = (list) => `/shared/${list.slug}`

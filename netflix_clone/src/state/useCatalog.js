import { catalog } from '../data/catalog.js'
import { useAuth } from './authContext.js'

const kids = ['TV-Y', 'TV-G', 'TV-PG', 'G', 'PG']
const allowedRatings = { kids, teen: [...kids, 'TV-14', 'PG-13'] }

// The catalog filtered by the signed-in user's maturity setting
export function useCatalog() {
  const { user } = useAuth()
  const allowed = allowedRatings[user?.preferences.maturity]
  const isAllowed = (title) => !allowed || allowed.includes(title.maturity)
  return { titles: catalog.filter(isAllowed), isAllowed }
}

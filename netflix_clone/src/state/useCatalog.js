import { useCatalogSource } from './catalogContext.js'
import { useProfile } from './profileContext.js'

const kids = ['TV-Y', 'TV-G', 'TV-PG', 'G', 'PG']
const allowedRatings = { kids, teen: [...kids, 'TV-14', 'PG-13'] }

// The catalog filtered by the watching profile's maturity rating (signed out: no filter).
// `all`, findTitle and genres cover every title, whatever the setting. rememberTitle(title) makes a TMDB title
// findable (once it's on a list) before the next page load.
export function useCatalog() {
  const { titles: all, saved, rememberTitle } = useCatalogSource()
  const allowed = allowedRatings[useProfile()?.profile?.maturity]
  const isAllowed = (title) => !allowed || allowed.includes(title.maturity)
  return {
    titles: all.filter(isAllowed),
    all,
    isAllowed,
    // Also finds TMDB titles saved to lists (My List, Favorites)
    findTitle: (id) => all.find((t) => t.id === id) ?? saved.find((t) => t.id === id),
    rememberTitle,
    genres: [...new Set(all.flatMap((t) => t.genres))].sort(),
  }
}

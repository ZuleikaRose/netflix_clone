import { useT } from '../state/useT.js'

// TMDB's terms ask apps to credit TMDB wherever its data appears
export function TmdbCredit() {
  const t = useT()
  return (
    <p className="tmdb-credit">
      {t('Movie and TV data from')} <a href="https://www.themoviedb.org" className="inline-link" target="_blank" rel="noreferrer">TMDB</a>.{' '}
      {t('This product uses the TMDB API but is not endorsed or certified by TMDB.')}
    </p>
  )
}

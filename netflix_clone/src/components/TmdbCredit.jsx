// TMDB's terms ask apps to credit TMDB wherever its data appears
export function TmdbCredit() {
  return (
    <p className="tmdb-credit">
      Movie and TV data from <a href="https://www.themoviedb.org" className="inline-link" target="_blank" rel="noreferrer">TMDB</a>.
      This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>
  )
}

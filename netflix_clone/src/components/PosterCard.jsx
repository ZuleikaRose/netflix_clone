import { Link } from 'react-router-dom'

// TMDB titles carry their own `path` and real poster art, which already shows the name
export function PosterCard({ title, children }) {
  const fromTmdb = title.source === 'tmdb'
  return (
    <article className="poster">
      <Link to={title.path ?? `/title/${title.id}`} className="poster-link" aria-label={title.title}>
        <img src={title.image} alt="" style={{ filter: fromTmdb ? 'none' : `brightness(.72) ${title.tint}` }} loading={fromTmdb ? 'lazy' : undefined} />
        {!fromTmdb && <span className="poster-title" aria-hidden="true">{title.title.toUpperCase()}</span>}
      </Link>
      {children}
    </article>
  )
}

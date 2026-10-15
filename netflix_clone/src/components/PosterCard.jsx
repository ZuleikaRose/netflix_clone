import { Link } from 'react-router-dom'

export function PosterCard({ title, children }) {
  return (
    <article className="poster">
      <Link to={`/title/${title.id}`} className="poster-link" aria-label={title.title}>
        <img src={title.image} alt="" style={{ filter: `brightness(.72) ${title.tint}` }} />
        <span className="poster-title" aria-hidden="true">{title.title.toUpperCase()}</span>
      </Link>
      {children}
    </article>
  )
}

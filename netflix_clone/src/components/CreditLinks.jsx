import { Fragment } from 'react'
import { Link } from 'react-router-dom'

// "Starring: A, B, C" with each name linking to that person's page. people: [{ key, name, to }]
export function CreditLinks({ label, people }) {
  if (!people.length) return null
  return (
    <p className="credits">
      <span>{label}:</span>{' '}
      {people.map((p, i) => (
        <Fragment key={p.key ?? p.name}>
          {i > 0 && ', '}
          <Link to={p.to} className="credit-link">{p.name}</Link>
        </Fragment>
      ))}
    </p>
  )
}

import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'

export function NotFound() {
  return (
    <>
      <PageHeader title="Lost Your Way?" back />
      <div className="empty">
        <p className="big-code" aria-hidden="true">404</p>
        <p>We can’t find that page. You’ll find lots to explore on the home page.</p>
        <Link to="/" className="play wide">Netflix Home</Link>
      </div>
    </>
  )
}

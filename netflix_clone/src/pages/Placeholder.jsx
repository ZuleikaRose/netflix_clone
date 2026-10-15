import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'

// Stand-in for sections planned in a later phase, so nav links never dead-end
export function Placeholder({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="empty">
        <p>{title} is coming in a later phase.</p>
        <Link to="/" className="play wide">Back to Home</Link>
      </div>
    </>
  )
}

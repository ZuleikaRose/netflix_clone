import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { infoPages } from '../data/infoPages.js'
import { NotFound } from './NotFound.jsx'

// Stand-in for pages planned in a later phase, so footer and nav links never dead-end
export function Placeholder({ title }) {
  const { slug } = useParams()
  const label = title ?? infoPages.find((p) => p.slug === slug)?.label
  if (!label) return <NotFound />

  return (
    <>
      <PageHeader title={label} back={!title} />
      <div className="empty">
        <p>{label} is coming in a later phase.</p>
        <Link to="/" className="play wide">Back to Home</Link>
      </div>
    </>
  )
}

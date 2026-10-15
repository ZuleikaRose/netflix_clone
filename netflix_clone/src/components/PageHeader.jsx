import { Link, useNavigate } from 'react-router-dom'
import { Icon } from './Icon.jsx'

export function PageHeader({ title, back = false }) {
  const navigate = useNavigate()

  return (
    <header className="page-header">
      {back
        ? <button className="icon-button" aria-label="Go back" onClick={() => navigate(-1)}><Icon name="back" /></button>
        : <Link to="/" className="brand" aria-label="Home">N</Link>}
      <h1>{title}</h1>
      <Link to="/search" className="icon-button" aria-label="Search"><Icon name="search" /></Link>
    </header>
  )
}

import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { useT } from '../state/useT.js'

export function NotFound() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('Lost Your Way?')} back />
      <div className="empty">
        <p className="big-code" aria-hidden="true">404</p>
        <p>{t('We can’t find that page. You’ll find lots to explore on the home page.')}</p>
        <Link to="/" className="play wide">{t('Netflix Home')}</Link>
      </div>
    </>
  )
}

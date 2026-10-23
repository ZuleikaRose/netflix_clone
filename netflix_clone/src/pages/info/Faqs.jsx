import { Link, useSearchParams } from 'react-router-dom'
import { faqCategories, faqs } from '../../data/faqs.js'
import { useT } from '../../state/useT.js'

export function Faqs() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''

  const setQueryParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const needle = q.trim().toLowerCase()
  const shown = faqs
    .filter((f) => !category || f.category === category)
    .filter((f) => !needle || `${t(f.q)} ${t(f.a)}`.toLowerCase().includes(needle))

  return (
    <div className="settings">
      <label htmlFor="faq-q" className="sr-only">{t('Search FAQs')}</label>
      <input id="faq-q" type="search" className="search-input" placeholder={t('Search FAQs')} value={q} onChange={(e) => setQueryParam('q', e.target.value)} />

      <div className="genre-chips" role="group" aria-label={t('Filter by topic')}>
        {faqCategories.map((c) => (
          <button key={c} className={category === c ? 'chip active' : 'chip'} aria-pressed={category === c} onClick={() => setQueryParam('category', category === c ? '' : c)}>{t(c)}</button>
        ))}
      </div>

      <p className="muted" aria-live="polite">{shown.length === 1 ? t('{count} question', { count: shown.length }) : t('{count} questions', { count: shown.length })}</p>

      {shown.length > 0
        ? (
          <div className="accordion">
            {shown.map((f) => (
              <details key={f.q}>
                <summary>{t(f.q)}</summary>
                <p>{t(f.a)}</p>
              </details>
            ))}
          </div>
        )
        : (
          <div className="empty">
            <p>{t('No answers match “{query}”.', { query: q })}</p>
            <Link to="/info/support" className="play wide">{t('Contact Customer Support')}</Link>
          </div>
        )}
    </div>
  )
}

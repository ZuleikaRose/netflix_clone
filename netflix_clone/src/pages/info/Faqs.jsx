import { Link, useSearchParams } from 'react-router-dom'
import { faqCategories, faqs } from '../../data/faqs.js'

export function Faqs() {
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
    .filter((f) => !needle || `${f.q} ${f.a}`.toLowerCase().includes(needle))

  return (
    <div className="settings">
      <label htmlFor="faq-q" className="sr-only">Search FAQs</label>
      <input id="faq-q" type="search" className="search-input" placeholder="Search FAQs" value={q} onChange={(e) => setQueryParam('q', e.target.value)} />

      <div className="genre-chips" role="group" aria-label="Filter by topic">
        {faqCategories.map((c) => (
          <button key={c} className={category === c ? 'chip active' : 'chip'} aria-pressed={category === c} onClick={() => setQueryParam('category', category === c ? '' : c)}>{c}</button>
        ))}
      </div>

      <p className="muted" aria-live="polite">{shown.length} question{shown.length === 1 ? '' : 's'}</p>

      {shown.length > 0
        ? (
          <div className="accordion">
            {shown.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        )
        : (
          <div className="empty">
            <p>No answers match “{q}”.</p>
            <Link to="/info/support" className="play wide">Contact Customer Support</Link>
          </div>
        )}
    </div>
  )
}

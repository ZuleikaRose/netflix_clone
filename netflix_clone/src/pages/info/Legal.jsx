import { legalDocs } from '../../data/legal.js'
import { useAccessibility } from '../../state/accessibilityContext.js'
import { useT } from '../../state/useT.js'

// The document itself stays in English; in another interface language a note says so, and the English text is
// marked lang="en" for screen readers
export function Legal({ doc }) {
  const t = useT()
  const english = useAccessibility().settings.language === 'en'
  const docLang = english ? undefined : 'en'
  const { updated, sections } = legalDocs[doc]

  return (
    <article className="legal-doc">
      {!english && <p className="muted">{t('This document is available in English only.')}</p>}
      <p className="muted" lang={docLang}>Last updated {updated} · Sample text for this demo app.</p>
      <nav aria-label={t('On this page')} className="toc">
        <p className="switch-label">{t('On this page')}</p>
        <ol lang={docLang}>{sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.heading}</a></li>)}</ol>
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} lang={docLang}>
          <h2 id={`${s.id}-h`}>{s.heading}</h2>
          <p>{s.body}</p>
        </section>
      ))}
    </article>
  )
}

import { legalDocs } from '../../data/legal.js'

export function Legal({ doc }) {
  const { updated, sections } = legalDocs[doc]

  return (
    <article className="legal-doc">
      <p className="muted">Last updated {updated} · Sample text for this demo app.</p>
      <nav aria-label="On this page" className="toc">
        <p className="switch-label">On this page</p>
        <ol>{sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.heading}</a></li>)}</ol>
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
          <h2 id={`${s.id}-h`}>{s.heading}</h2>
          <p>{s.body}</p>
        </section>
      ))}
    </article>
  )
}

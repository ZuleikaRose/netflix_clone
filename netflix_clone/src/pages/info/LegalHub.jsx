import { Link } from 'react-router-dom'
import { captionsCredit, clips } from '../../data/clips.js'

const documents = [
  { to: '/info/terms', title: 'Terms of Service', body: 'Membership, acceptable use, your account and limits of liability.' },
  { to: '/info/privacy', title: 'Privacy Policy', body: 'What we collect, how we use it, cookies and your choices.' },
  { to: '/info/accessibility', title: 'Accessibility Policy', body: 'Our WCAG 2.2 AA commitment, accessibility features and how to get help.' },
  { to: '/info/do-not-sell', title: 'Do Not Sell My Information', body: 'Opt out of sharing viewing data with partners.' },
  { to: '/info/affiliate', title: 'Affiliate Program terms', body: 'Eligibility, commissions and promotion rules for affiliates.' },
]

// Streaming-specific disclaimers called out in the outline's Legal and Privacy page
const disclaimers = [
  { title: 'Content licensing', body: 'Titles are licensed for personal viewing only. Availability changes as licenses begin and end, and can differ by region.' },
  { title: 'Ratings and advisories', body: 'Maturity ratings are guidance. Parents should use the maturity setting in Account to control what each profile can see.' },
  { title: 'Third-party content', body: 'Opinions in titles and member reviews are those of their creators, not ours.' },
  { title: 'Streaming quality', body: 'Picture quality depends on your plan, device and connection. See Technical Requirements for minimum speeds.' },
]

export function LegalHub() {
  return (
    <div className="settings">
      <p className="muted">Sample legal information for this demo app — not legal advice.</p>
      <ul className="topic-grid">
        {documents.map((d) => (
          <li key={d.to}><Link to={d.to} className="topic-card"><b>{d.title}</b><span className="muted">{d.body}</span></Link></li>
        ))}
      </ul>
      <section className="settings-card" aria-labelledby="disclaimers-heading">
        <h2 id="disclaimers-heading">Streaming disclaimers</h2>
        {disclaimers.map((d) => <p key={d.title}><b>{d.title}.</b> <span className="muted">{d.body}</span></p>)}
      </section>
      <section className="settings-card" aria-labelledby="media-credits-heading">
        <h2 id="media-credits-heading">Media credits</h2>
        <p className="muted">Sample video clips are short, re-encoded excerpts of the Blender Foundation’s open movies. English captions come from {captionsCredit.source} (<a href={captionsCredit.licenseUrl} className="inline-link" target="_blank" rel="noreferrer">{captionsCredit.license}</a>), re-timed to each excerpt.</p>
        <ul className="credit-list">
          {clips.map((c) => (
            <li key={c.id}>
              <p>
                <a href={c.sourceUrl} className="inline-link" target="_blank" rel="noreferrer">{c.film}</a> ({c.year}), {c.makers}. Excerpt {c.excerpt}.{' '}
                <a href={c.licenseUrl} className="inline-link" target="_blank" rel="noreferrer">{c.license}</a>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

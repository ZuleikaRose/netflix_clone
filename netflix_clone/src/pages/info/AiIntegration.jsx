import { Link } from 'react-router-dom'

const features = [
  { title: 'What should I watch?', body: 'Describe what you’re in the mood for in your own words and get up to five titles from our catalog, each with a reason. It uses Claude, an AI model from Anthropic. Your request (and, with personalized recommendations on, the names of titles the profile loved or liked) is sent to Anthropic; your name, email and account never are. Suggestions only come from titles the profile’s maturity rating allows, never ones marked Not for me, and requests aren’t stored.' },
  { title: 'More Like This', body: 'Every title page suggests other titles that share its genres, so one good find leads to the next.' },
  { title: 'Smarter search', body: 'Search matches titles, cast and genres, so “thriller” or an actor’s name both find what you’re after.' },
  { title: 'Support assistant', body: 'Live chat suggests answers from our FAQs instantly. A person can always take over through an issue report.' },
]

const principles = [
  'Recommendations use only your activity in this service — never data bought from third parties.',
  'Your maturity rating always overrides recommendations.',
  'Titles you mark Not for me are never recommended to that profile.',
  'The assistant only suggests titles from our own catalog; when the AI service isn’t available, it matches your words instead and says so.',
  'Opting out on Do Not Sell My Information stops any partner sharing.',
]

export function AiIntegration() {
  return (
    <div className="settings">
      <p className="auth-copy">We use AI to help you find something great to watch, faster. Here’s where it shows up and the rules it follows.</p>
      {features.map((f) => (
        <section key={f.title} className="settings-card">
          <h2>{f.title}</h2>
          <p className="muted">{f.body}</p>
        </section>
      ))}
      <section className="settings-card" aria-labelledby="principles-heading">
        <h2 id="principles-heading">Our principles</h2>
        <ul className="check-list">{principles.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>
      <p className="muted">Manage your preferences in <Link to="/account" className="inline-link">Account</Link> or opt out of sharing on <Link to="/info/do-not-sell" className="inline-link">Do Not Sell My Information</Link>.</p>
    </div>
  )
}

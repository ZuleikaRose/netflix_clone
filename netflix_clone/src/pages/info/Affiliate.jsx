import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCopyToClipboard } from '../../components/useCopyToClipboard.js'
import {
  affiliateCode, audienceSizes, commissionTiers, COOKIE_DAYS, earningsFor, eligibility, howItWorks,
  marketingAssets, MIN_PAYOUT, payoutMethods, promotionChannels, restrictions, tierFor, tips,
} from '../../data/affiliate.js'
import { useAuth } from '../../state/authContext.js'
import { useLibrary } from '../../state/libraryContext.js'
import { focusFirstError } from '../formUtils.js'

const isWebUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol)
  } catch {
    return false
  }
}

function CopyStatus({ copied, id, text }) {
  if (copied?.key !== id) return null
  return copied.ok
    ? <p className="save-status" role="status"><span aria-hidden="true">✓</span> Copied</p>
    : <p className="field-error" role="status">Couldn’t access the clipboard — select and copy: <code>{text}</code></p>
}

function JoinForm({ onJoin }) {
  const [form, setForm] = useState({ site: '', audience: audienceSizes[0], channels: [], payout: payoutMethods[0], agree: false })
  const [errors, setErrors] = useState({})

  const toggleChannel = (c) => setForm({ ...form, channels: form.channels.includes(c) ? form.channels.filter((x) => x !== c) : [...form.channels, c] })

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!isWebUrl(form.site)) next.site = 'Enter the full address of your site or channel, starting with https://'
    if (!form.channels.length) next.channels = 'Choose at least one way you’ll promote us.'
    if (!form.agree) next.agree = 'You need to accept the program terms to join.'
    setErrors(next)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    onJoin({ ...form, site: form.site.trim() })
  }

  return (
    <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="join-heading">
      <h2 id="join-heading">Join the program</h2>
      <div className={errors.site ? 'field has-error' : 'field'}>
        <label htmlFor="aff-site">Website or channel URL</label>
        <input id="aff-site" type="url" inputMode="url" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder="https://youtube.com/@yourchannel" aria-invalid={Boolean(errors.site)} aria-describedby={errors.site ? 'aff-site-error' : undefined} />
        {errors.site && <p id="aff-site-error" className="field-error"><span aria-hidden="true">⚠</span> {errors.site}</p>}
      </div>

      <label className="select-row">
        <span className="switch-label">Audience size</span>
        <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
          {audienceSizes.map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>

      <fieldset className="check-group" aria-describedby={errors.channels ? 'aff-channels-error' : undefined}>
        <legend>Where will you promote us?</legend>
        {promotionChannels.map((c) => (
          <label key={c} className="check-row">
            <input type="checkbox" checked={form.channels.includes(c)} onChange={() => toggleChannel(c)} aria-invalid={Boolean(errors.channels)} />
            <span>{c}</span>
          </label>
        ))}
        {errors.channels && <p id="aff-channels-error" className="field-error"><span aria-hidden="true">⚠</span> {errors.channels}</p>}
      </fieldset>

      <label className="select-row">
        <span className="switch-label">Get paid by</span>
        <select value={form.payout} onChange={(e) => setForm({ ...form, payout: e.target.value })}>
          {payoutMethods.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>

      <label className="check-row">
        <input type="checkbox" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} aria-invalid={Boolean(errors.agree)} aria-describedby={errors.agree ? 'aff-agree-error' : undefined} />
        <span>I agree to the program terms, eligibility rules and promotion restrictions below.</span>
      </label>
      {errors.agree && <p id="aff-agree-error" className="field-error"><span aria-hidden="true">⚠</span> {errors.agree}</p>}

      <button type="submit" className="cta">Apply now</button>
    </form>
  )
}

function Dashboard({ affiliate, link, onReferral, canSimulateSignups, copied, copy }) {
  const earnings = earningsFor(affiliate.signups)
  const tier = tierFor(affiliate.signups)
  const nextTier = commissionTiers.find((t) => t.min > affiliate.signups)
  const conversion = affiliate.clicks ? Math.round((affiliate.signups / affiliate.clicks) * 100) : 0

  return (
    <section className="settings-card" aria-labelledby="dash-heading">
      <h2 id="dash-heading">Your affiliate dashboard</h2>
      <p className="muted">Approved · code <b className="promo-code">{affiliate.code}</b> · paid by {affiliate.payout}</p>

      <div className="field">
        <label htmlFor="aff-link">Your referral link</label>
        <div className="copy-row">
          <input id="aff-link" value={link} readOnly onFocus={(e) => e.target.select()} />
          <button type="button" className="cta" onClick={() => copy('link', link)}>Copy</button>
        </div>
        <CopyStatus copied={copied} id="link" text={link} />
      </div>

      <dl className="stat-grid">
        <div><dt>Clicks</dt><dd>{affiliate.clicks}</dd></div>
        <div><dt>Sign-ups</dt><dd>{affiliate.signups}</dd></div>
        <div><dt>Conversion</dt><dd>{conversion}%</dd></div>
        <div><dt>Earnings</dt><dd>${earnings}</dd></div>
      </dl>
      <p className="muted" role="status">
        {tier ? `${tier.name} tier · $${tier.perSignup} per sign-up` : 'No sign-ups yet'}
        {nextTier && ` · ${nextTier.min - affiliate.signups} more to reach ${nextTier.name}`}
        {' · '}{earnings >= MIN_PAYOUT ? 'Eligible for payout on the 1st' : `$${MIN_PAYOUT - earnings} until your first payout`}
      </p>

      <div className="demo-tools" role="group" aria-labelledby="demo-tools-heading">
        <p id="demo-tools-heading" className="switch-label">Demo tools <span className="muted">(simulate referral tracking)</span></p>
        <button type="button" className="ghost-cta" onClick={() => onReferral('click')}>Simulate a click</button>
        {canSimulateSignups
          ? <button type="button" className="ghost-cta" onClick={() => onReferral('signup')}>Simulate a sign-up</button>
          : <p className="muted">Sign-ups are counted when someone creates an account from your link.</p>}
      </div>
    </section>
  )
}

export function Affiliate() {
  const { user } = useAuth()
  const { affiliate, joinAffiliate, recordReferral, canSimulateSignups } = useLibrary()
  const { copied, copy } = useCopyToClipboard()
  const link = affiliate ? `${window.location.origin}/signup?ref=${affiliate.code}` : ''

  return (
    <div className="settings">
      <p className="auth-copy">Love what you watch? Earn up to ${commissionTiers.at(-1).perSignup} for every friend, follower or reader who becomes a member through your link.</p>

      <ol className="steps">
        {howItWorks.map((s, i) => (
          <li key={s.title}><span className="step-num" aria-hidden="true">{i + 1}</span><span><b>{s.title}</b><span className="muted">{s.body}</span></span></li>
        ))}
      </ol>

      {affiliate
        ? <Dashboard affiliate={affiliate} link={link} onReferral={recordReferral} canSimulateSignups={canSimulateSignups} copied={copied} copy={copy} />
        : <JoinForm onJoin={(application) => joinAffiliate({ ...application, code: affiliateCode(user.name) })} />}

      <section className="settings-card" aria-labelledby="commission-heading">
        <h2 id="commission-heading">Commission structure</h2>
        <table className="spec-table">
          <thead><tr><th scope="col">Tier</th><th scope="col">Lifetime sign-ups</th><th scope="col">Per sign-up</th></tr></thead>
          <tbody>
            {commissionTiers.map((t) => (
              <tr key={t.name}><th scope="row">{t.name}</th><td>{t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max}`}</td><td>${t.perSignup}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Paid monthly once your balance reaches ${MIN_PAYOUT}, via {payoutMethods.join(', ')}. Referrals are tracked for {COOKIE_DAYS} days after a click and count once the member completes their first paid month.</p>
      </section>

      <section className="settings-card" aria-labelledby="assets-heading">
        <h2 id="assets-heading">Marketing materials</h2>
        {!affiliate && <p className="muted">Join to get materials pre-filled with your referral link.</p>}
        <ul className="asset-list">
          {marketingAssets.map((a) => {
            // Banners embed the link in their HTML; captions get it appended
            const target = link || 'YOUR_LINK'
            const text = a.text.includes('{link}') ? a.text.replace('{link}', target) : `${a.text} ${target}`
            return (
              <li key={a.id}>
                <p className="switch-label">{a.kind}</p>
                <pre className="asset-text">{text}</pre>
                <button type="button" className="ghost-cta" disabled={!affiliate} onClick={() => copy(a.id, text)}>Copy {a.kind.toLowerCase()}</button>
                <CopyStatus copied={copied} id={a.id} text={text} />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="settings-card" aria-labelledby="tips-heading">
        <h2 id="tips-heading">Grow your earnings</h2>
        {tips.map((t) => <p key={t.title}><b>{t.title}.</b> <span className="muted">{t.body}</span></p>)}
      </section>

      <section className="settings-card" aria-labelledby="aff-terms-heading">
        <h2 id="aff-terms-heading">Program terms</h2>
        <div className="accordion">
          <details><summary>Eligibility requirements</summary><ul className="check-list">{eligibility.map((e) => <li key={e}>{e}</li>)}</ul></details>
          <details><summary>Promotion restrictions</summary><ul className="check-list restricted">{restrictions.map((r) => <li key={r}>{r}</li>)}</ul></details>
          <details><summary>Payments</summary><p>Commissions are paid monthly by {payoutMethods.join(', ')} once you reach ${MIN_PAYOUT}. Reversed or refunded memberships are deducted from the next payout.</p></details>
        </div>
        <p className="muted">Questions? <Link to="/info/support" className="inline-link">Contact Customer Support</Link>.</p>
      </section>
    </div>
  )
}

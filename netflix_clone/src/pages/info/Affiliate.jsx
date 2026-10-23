import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCopyToClipboard } from '../../components/useCopyToClipboard.js'
import {
  affiliateCode, audienceSizes, commissionTiers, COOKIE_DAYS, earningsFor, eligibility, howItWorks,
  marketingAssets, MIN_PAYOUT, payoutMethods, promotionChannels, restrictions, tierFor, tips,
} from '../../data/affiliate.js'
import { useAuth } from '../../state/authContext.js'
import { useLibrary } from '../../state/libraryContext.js'
import { useT } from '../../state/useT.js'
import { focusFirstError } from '../formUtils.js'

const isWebUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol)
  } catch {
    return false
  }
}

function CopyStatus({ copied, id, text }) {
  const t = useT()
  if (copied?.key !== id) return null
  return copied.ok
    ? <p className="save-status" role="status"><span aria-hidden="true">✓</span> {t('Copied')}</p>
    : <p className="field-error" role="status">{t('Couldn’t access the clipboard — select and copy:')} <code>{text}</code></p>
}

function JoinForm({ onJoin }) {
  const t = useT()
  const [form, setForm] = useState({ site: '', audience: audienceSizes[0], channels: [], payout: payoutMethods[0], agree: false })
  // English messages, shown in the interface language
  const [errors, setErrors] = useState({})

  const toggleChannel = (c) => setForm((f) => ({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] }))

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
      <h2 id="join-heading">{t('Join the program')}</h2>
      <div className={errors.site ? 'field has-error' : 'field'}>
        <label htmlFor="aff-site">{t('Website or channel URL')}</label>
        <input id="aff-site" type="url" inputMode="url" value={form.site} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, site: value })) }} placeholder={t('https://youtube.com/@yourchannel')} aria-invalid={Boolean(errors.site)} aria-describedby={errors.site ? 'aff-site-error' : undefined} />
        {errors.site && <p id="aff-site-error" className="field-error"><span aria-hidden="true">⚠</span> {t(errors.site)}</p>}
      </div>

      <label className="select-row">
        <span className="switch-label">{t('Audience size')}</span>
        <select value={form.audience} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, audience: value })) }}>
          {audienceSizes.map((a) => <option key={a} value={a}>{t(a)}</option>)}
        </select>
      </label>

      <fieldset className="check-group" aria-describedby={errors.channels ? 'aff-channels-error' : undefined}>
        <legend>{t('Where will you promote us?')}</legend>
        {promotionChannels.map((c) => (
          <label key={c} className="check-row">
            <input type="checkbox" checked={form.channels.includes(c)} onChange={() => toggleChannel(c)} aria-invalid={Boolean(errors.channels)} />
            <span>{t(c)}</span>
          </label>
        ))}
        {errors.channels && <p id="aff-channels-error" className="field-error"><span aria-hidden="true">⚠</span> {t(errors.channels)}</p>}
      </fieldset>

      <label className="select-row">
        <span className="switch-label">{t('Get paid by')}</span>
        <select value={form.payout} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, payout: value })) }}>
          {payoutMethods.map((p) => <option key={p} value={p}>{t(p)}</option>)}
        </select>
      </label>

      <label className="check-row">
        <input type="checkbox" checked={form.agree} onChange={(e) => { const { checked } = e.target; setForm((f) => ({ ...f, agree: checked })) }} aria-invalid={Boolean(errors.agree)} aria-describedby={errors.agree ? 'aff-agree-error' : undefined} />
        <span>{t('I agree to the program terms, eligibility rules and promotion restrictions below.')}</span>
      </label>
      {errors.agree && <p id="aff-agree-error" className="field-error"><span aria-hidden="true">⚠</span> {t(errors.agree)}</p>}

      <button type="submit" className="cta">{t('Apply now')}</button>
    </form>
  )
}

function Dashboard({ affiliate, link, onReferral, canSimulateReferrals, copied, copy }) {
  const t = useT()
  const earnings = earningsFor(affiliate.signups)
  const tier = tierFor(affiliate.signups)
  const nextTier = commissionTiers.find((x) => x.min > affiliate.signups)
  const conversion = affiliate.clicks ? Math.round((affiliate.signups / affiliate.clicks) * 100) : 0

  return (
    <section className="settings-card" aria-labelledby="dash-heading">
      <h2 id="dash-heading">{t('Your affiliate dashboard')}</h2>
      <p className="muted">{t('Approved · code')} <b className="promo-code">{affiliate.code}</b> · {t('paid by {method}', { method: t(affiliate.payout) })}</p>

      <div className="field">
        <label htmlFor="aff-link">{t('Your referral link')}</label>
        <div className="copy-row">
          <input id="aff-link" value={link} readOnly onFocus={(e) => e.target.select()} />
          <button type="button" className="cta" onClick={() => copy('link', link)}>{t('Copy')}</button>
        </div>
        <CopyStatus copied={copied} id="link" text={link} />
      </div>

      <dl className="stat-grid">
        <div><dt>{t('Clicks')}</dt><dd>{affiliate.clicks}</dd></div>
        <div><dt>{t('Sign-ups')}</dt><dd>{affiliate.signups}</dd></div>
        <div><dt>{t('Conversion')}</dt><dd>{conversion}%</dd></div>
        <div><dt>{t('Earnings')}</dt><dd>${earnings}</dd></div>
      </dl>
      <p className="muted" role="status">
        {tier ? t('{tier} tier · {amount} per sign-up', { tier: t(tier.name), amount: `$${tier.perSignup}` }) : t('No sign-ups yet')}
        {nextTier && ` · ${t('{count} more to reach {tier}', { count: nextTier.min - affiliate.signups, tier: t(nextTier.name) })}`}
        {' · '}{earnings >= MIN_PAYOUT ? t('Eligible for payout on the 1st') : t('{amount} until your first payout', { amount: `$${MIN_PAYOUT - earnings}` })}
      </p>

      {canSimulateReferrals
        ? (
          <div className="demo-tools" role="group" aria-labelledby="demo-tools-heading">
            <p id="demo-tools-heading" className="switch-label">{t('Demo tools')} <span className="muted">{t('(simulate referral tracking)')}</span></p>
            <button type="button" className="ghost-cta" onClick={() => onReferral('click')}>{t('Simulate a click')}</button>
            <button type="button" className="ghost-cta" onClick={() => onReferral('signup')}>{t('Simulate a sign-up')}</button>
          </div>
        )
        : <p className="muted">{t('A click counts once per visitor per hour when someone opens your link; a sign-up counts when they create an account from it.')}</p>}
    </section>
  )
}

export function Affiliate() {
  const t = useT()
  const { user } = useAuth()
  const { affiliate, joinAffiliate, recordReferral, canSimulateReferrals } = useLibrary()
  const { copied, copy } = useCopyToClipboard()
  const link = affiliate ? `${window.location.origin}/signup?ref=${affiliate.code}` : ''
  const methods = payoutMethods.map((m) => t(m)).join(', ')

  return (
    <div className="settings">
      <p className="auth-copy">{t('Love what you watch? Earn up to {amount} for every friend, follower or reader who becomes a member through your link.', { amount: `$${commissionTiers.at(-1).perSignup}` })}</p>

      <ol className="steps">
        {howItWorks.map((s, i) => (
          <li key={s.title}><span className="step-num" aria-hidden="true">{i + 1}</span><span><b>{t(s.title)}</b><span className="muted">{t(s.body)}</span></span></li>
        ))}
      </ol>

      {affiliate
        ? <Dashboard affiliate={affiliate} link={link} onReferral={recordReferral} canSimulateReferrals={canSimulateReferrals} copied={copied} copy={copy} />
        : <JoinForm onJoin={(application) => joinAffiliate({ ...application, code: affiliateCode(user.name) })} />}

      <section className="settings-card" aria-labelledby="commission-heading">
        <h2 id="commission-heading">{t('Commission structure')}</h2>
        <table className="spec-table">
          <thead><tr><th scope="col">{t('Tier')}</th><th scope="col">{t('Lifetime sign-ups')}</th><th scope="col">{t('Per sign-up')}</th></tr></thead>
          <tbody>
            {commissionTiers.map((tier) => (
              <tr key={tier.name}><th scope="row">{t(tier.name)}</th><td>{tier.max === Infinity ? `${tier.min}+` : `${tier.min}–${tier.max}`}</td><td>${tier.perSignup}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">{t('Paid monthly once your balance reaches {amount}, via {methods}. Referrals are tracked for {days} days after a click and count once the member completes their first paid month.', { amount: `$${MIN_PAYOUT}`, methods, days: COOKIE_DAYS })}</p>
      </section>

      <section className="settings-card" aria-labelledby="assets-heading">
        <h2 id="assets-heading">{t('Marketing materials')}</h2>
        {!affiliate && <p className="muted">{t('Join to get materials pre-filled with your referral link.')}</p>}
        <ul className="asset-list">
          {marketingAssets.map((a) => {
            // Banners embed the link in their HTML; captions get it appended
            const target = link || t('YOUR_LINK')
            const text = a.text.includes('{link}') ? a.text.replace('{link}', target) : `${t(a.text)} ${target}`
            const kind = t(a.kind)
            return (
              <li key={a.id}>
                <p className="switch-label">{kind}</p>
                <pre className="asset-text">{text}</pre>
                <button type="button" className="ghost-cta" disabled={!affiliate} onClick={() => copy(a.id, text)}>{t('Copy {item}', { item: kind.toLowerCase() })}</button>
                <CopyStatus copied={copied} id={a.id} text={text} />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="settings-card" aria-labelledby="tips-heading">
        <h2 id="tips-heading">{t('Grow your earnings')}</h2>
        {tips.map((tip) => <p key={tip.title}><b>{t(tip.title)}.</b> <span className="muted">{t(tip.body)}</span></p>)}
      </section>

      <section className="settings-card" aria-labelledby="aff-terms-heading">
        <h2 id="aff-terms-heading">{t('Program terms')}</h2>
        <div className="accordion">
          <details><summary>{t('Eligibility requirements')}</summary><ul className="check-list">{eligibility.map((e) => <li key={e}>{t(e)}</li>)}</ul></details>
          <details><summary>{t('Promotion restrictions')}</summary><ul className="check-list restricted">{restrictions.map((r) => <li key={r}>{t(r)}</li>)}</ul></details>
          <details><summary>{t('Payments')}</summary><p>{t('Commissions are paid monthly by {methods} once you reach {amount}. Reversed or refunded memberships are deducted from the next payout.', { methods, amount: `$${MIN_PAYOUT}` })}</p></details>
        </div>
        <p className="muted">{t('Questions?')} <Link to="/info/support" className="inline-link">{t('Contact Customer Support')}</Link>.</p>
      </section>
    </div>
  )
}

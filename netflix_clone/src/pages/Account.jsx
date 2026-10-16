import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '../components/Field.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PlanPicker } from '../components/PlanPicker.jsx'
import { useAccessibility } from '../state/accessibilityContext.js'
import { billingSummary } from '../data/billing.js'
import { findPlan } from '../data/plans.js'
import { discountedPrice, findPromotion } from '../data/promotions.js'
import { EMAIL_PATTERN, MIN_PASSWORD, demoAccount, useAuth } from '../state/authContext.js'
import { Billing } from './account/Billing.jsx'
import { DeleteAccount } from './account/DeleteAccount.jsx'
import { focusFirstError } from './formUtils.js'

const toggles = [
  { key: 'autoplayNext', label: 'Autoplay next episode', hint: 'Start the next episode automatically on all devices.' },
  { key: 'autoplayPreviews', label: 'Autoplay previews', hint: 'Start silent previews on Home and title pages by themselves. They never autoplay when Stop animations or reduced motion is on.' },
  { key: 'emailUpdates', label: 'Email me new releases', hint: 'News about titles we think you’ll love.' },
]

// Permissions from the outline (§8): users can opt out of data use for recommendations
const privacyToggles = [
  { key: 'personalized', label: 'Personalized recommendations', hint: 'Use what you save, favorite and rate to suggest titles on Home.' },
]

function Status({ message }) {
  return <p className="save-status" role="status">{message && <><span aria-hidden="true">✓</span> {message}</>}</p>
}

function ProfileForm({ user, updateProfile }) {
  const [form, setForm] = useState({ name: user.name, email: user.email })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Please enter a valid email address.'
    if (!Object.keys(next).length) {
      const error = updateProfile(form)
      if (error) next.email = error
    }
    setErrors(next)
    setStatus(Object.keys(next).length ? '' : 'Profile saved')
    if (Object.keys(next).length) focusFirstError(e.currentTarget)
  }

  return (
    <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="profile-heading">
      <h2 id="profile-heading">Profile</h2>
      <Field label="Name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
      <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
      <button type="submit" className="cta">Save profile</button>
      <Status message={status} />
    </form>
  )
}

function PasswordForm({ email, changePassword, demoPassword }) {
  const blank = { current: '', next: '', confirm: '' }
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')
  const updateField = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!form.current) next.current = 'Please enter your current password.'
    if (form.next.length < MIN_PASSWORD) next.next = `Password must be at least ${MIN_PASSWORD} characters.`
    if (form.confirm !== form.next) next.confirm = 'Passwords don’t match.'
    if (!Object.keys(next).length) {
      const error = changePassword(form.current, form.next)
      if (error) next.current = error
    }
    setErrors(next)
    if (Object.keys(next).length) {
      setStatus('')
      focusFirstError(e.currentTarget)
    } else {
      setForm(blank)
      setStatus('Password updated')
    }
  }

  return (
    <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="password-heading">
      <h2 id="password-heading">Change password</h2>
      {demoPassword && <p className="demo-credentials">Demo account password for this page load: <code>{demoPassword}</code></p>}
      {/* Lets password managers associate the new password with this account */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="Current password" type="password" autoComplete="current-password" value={form.current} onChange={updateField('current')} error={errors.current} />
      <Field label="New password" type="password" autoComplete="new-password" value={form.next} onChange={updateField('next')} error={errors.next} hint={`At least ${MIN_PASSWORD} characters.`} />
      <Field label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={updateField('confirm')} error={errors.confirm} />
      <button type="submit" className="cta">Update password</button>
      <Status message={status} />
    </form>
  )
}

export function Account() {
  const { user, demoPassword, updateProfile, changePassword, changePlan, removePromo, setPreference } = useAuth()
  const { openMenu } = useAccessibility()
  const [planStatus, setPlanStatus] = useState('')
  const plan = findPlan(user.plan)
  const promo = findPromotion(user.promo)

  const switchPlan = (id) => {
    changePlan(id)
    // Plan-specific codes (e.g. Premium-only) stop applying when the plan changes
    const dropped = promo?.plan && promo.plan !== id
    if (dropped) removePromo()
    setPlanStatus(`Switched to ${findPlan(id).name}${dropped ? ` · ${promo.code} removed (${findPlan(promo.plan).name} only)` : ''}`)
  }

  return (
    <>
      <PageHeader title="Account" back />
      <div className="settings">
        <section className="settings-card membership" aria-labelledby="membership-heading">
          <h2 id="membership-heading">Membership</h2>
          <p><b>{plan.name}</b> · {promo ? <><span className="sr-only">was </span><s className="muted">{plan.price}</s> <span className="sr-only">now </span>{discountedPrice(plan.price, promo.percent)}</> : plan.price}/month</p>
          {promo && <p className="muted">Code {promo.code}: {promo.percent}% off · <Link to="/info/promotions" className="inline-link">Manage</Link></p>}
          <p className="muted">{billingSummary(user.billing)}</p>
          <p className="muted">Member since 2026 · {user.email}</p>
        </section>

        <ProfileForm user={user} updateProfile={updateProfile} />
        <PasswordForm email={user.email} changePassword={changePassword} demoPassword={user.email === demoAccount.email ? demoPassword : null} />

        <section className="settings-card" aria-labelledby="plan-heading">
          <h2 id="plan-heading">Plan</h2>
          <PlanPicker name="account-plan" value={user.plan} onChange={switchPlan} />
          <Status message={planStatus} />
        </section>

        <Billing />

        <section className="settings-card" aria-labelledby="playback-heading">
          <h2 id="playback-heading">Playback &amp; notifications</h2>
          {toggles.map(({ key, label, hint }) => (
            <label key={key} className="switch-row">
              <span><span className="switch-label">{label}</span><span className="muted">{hint}</span></span>
              <input type="checkbox" role="switch" checked={user.preferences[key]} onChange={(e) => setPreference(key, e.target.checked)} />
            </label>
          ))}
          <label className="select-row">
            <span className="switch-label">Maturity rating</span>
            <select value={user.preferences.maturity} onChange={(e) => setPreference('maturity', e.target.value)}>
              <option value="all">All maturity ratings</option>
              <option value="teen">Teens (TV-14, PG-13 and below)</option>
              <option value="kids">Kids (TV-PG, PG and below)</option>
            </select>
          </label>
        </section>

        <section className="settings-card" aria-labelledby="a11y-settings-heading">
          <h2 id="a11y-settings-heading">Accessibility</h2>
          <p className="muted">Text size, readable fonts, contrast, captions, reading aids and more. The menu is also behind the accessibility icon at the top of every page.</p>
          <button type="button" className="cta" aria-haspopup="dialog" onClick={openMenu}>Open accessibility menu</button>
          <Link to="/info/accessibility" className="ghost-cta">Read our Accessibility Policy</Link>
        </section>

        <section className="settings-card" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading">Privacy &amp; data</h2>
          {privacyToggles.map(({ key, label, hint }) => (
            <label key={key} className="switch-row">
              <span><span className="switch-label">{label}</span><span className="muted">{hint}</span></span>
              <input type="checkbox" role="switch" checked={user.preferences[key]} onChange={(e) => setPreference(key, e.target.checked)} />
            </label>
          ))}
          <p className="muted">More choices: <Link to="/info/do-not-sell" className="inline-link">Do Not Sell My Information</Link> · <Link to="/info/privacy" className="inline-link">Privacy Policy</Link></p>
        </section>

        <nav className="settings-card link-list" aria-label="Help">
          <Link to="/info/support">Customer Support</Link>
          <Link to="/info/faqs">FAQs</Link>
          <Link to="/info/promotions">Promotions &amp; Discounts</Link>
          <Link to="/info/affiliate">Affiliate Program</Link>
          <Link to="/info/legal">Legal &amp; Privacy</Link>
          <Link to="/info/accessibility">Accessibility Policy</Link>
          <Link to="/logout" className="danger-link">Sign out</Link>
        </nav>

        <DeleteAccount />
      </div>
    </>
  )
}

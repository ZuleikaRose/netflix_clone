import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '../components/Field.jsx'
import { GrownUpGate } from '../components/GrownUpGate.jsx'
import { MonthlyDonation } from '../components/MonthlyDonation.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PlanPicker } from '../components/PlanPicker.jsx'
import { useAccessibility } from '../state/accessibilityContext.js'
import { billingSummary } from '../data/billing.js'
import { findPlan } from '../data/plans.js'
import { maturityChoices } from '../data/profiles.js'
import { useProfile } from '../state/profileContext.js'
import { usePwa } from '../state/usePwa.js'
import { useMonthlyDonation } from '../state/useMonthlyDonation.js'
import { promptInstall } from '../lib/pwa.js'
import { discountedPrice, findPromotion } from '../data/promotions.js'
import { EMAIL_PATTERN, passwordHint, passwordProblem, useAuth } from '../state/authContext.js'
import { useT } from '../state/useT.js'
import { Billing } from './account/Billing.jsx'
import { DeleteAccount } from './account/DeleteAccount.jsx'
import { Security } from './account/Security.jsx'
import { focusFirstError } from './formUtils.js'

const toggles = [
  { key: 'autoplayNext', label: 'Autoplay next episode', hint: 'Start the next episode automatically on all devices.' },
  { key: 'autoplayPreviews', label: 'Autoplay previews', hint: 'Start silent previews on Home and title pages by themselves. They never autoplay when Stop animations or reduced motion is on.' },
  { key: 'emailUpdates', label: 'Email me new releases', hint: 'News about titles we think you’ll love.' },
]

// Permissions from the outline (§8): users can opt out of data use for recommendations
const privacyToggles = [
  { key: 'personalized', label: 'Personalized recommendations', hint: 'Use what you save, favorite and rate to suggest titles on Home.' },
  { key: 'showOnLeaderboards', label: 'Show me on game leaderboards', hint: 'Your first name and best scores appear on each game’s leaderboard for other members.' },
]

// Install as an app: the browser's own prompt where there is one, else how to do it by hand
function InstallCard() {
  const { canInstall, installed } = usePwa()
  const t = useT()
  const [declined, setDeclined] = useState(false)
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const install = async () => setDeclined(!(await promptInstall()))
  return (
    <section className="settings-card" aria-labelledby="app-heading">
      <h2 id="app-heading">{t('App')}</h2>
      {installed
        ? <p className="muted"><span aria-hidden="true">✓</span> {t('Netflix Clone is installed on this device. It opens from your home screen or app list, and pages you’ve visited work offline.')}</p>
        : canInstall
          ? (
            <>
              <p className="muted">{t('Add Netflix Clone to your home screen or desktop: it opens in its own window and works offline.')}</p>
              <button type="button" className="cta" onClick={install}>{t('Install Netflix Clone')}</button>
              {declined && <p className="muted" role="status">{t('Not installed. You can install it any time from here.')}</p>}
            </>
          )
          : <p className="muted">{ios ? t('To install: tap Share, then Add to Home Screen.') : t('To install, use your browser’s menu: Install app, or Add to Home Screen.')}</p>}
    </section>
  )
}

// A running monthly donation, with Cancel (nothing shows without one, or in the in-memory build)
function AccountMonthlyDonation() {
  const state = useMonthlyDonation()
  return <MonthlyDonation state={state} />
}

function Status({ message }) {
  return <p className="save-status" role="status">{message && <><span aria-hidden="true">✓</span> {message}</>}</p>
}

function ProfileForm({ user, updateProfile }) {
  const t = useT()
  const [form, setForm] = useState({ name: user.name, email: user.email })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const formElement = e.currentTarget
    const next = {}
    if (!form.name.trim()) next.name = t('Please enter your name.')
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = t('Please enter a valid email address.')
    if (!Object.keys(next).length) {
      const error = await updateProfile(form)
      if (error) next.email = t(error)
    }
    setErrors(next)
    setStatus(Object.keys(next).length ? '' : t('Profile saved'))
    if (Object.keys(next).length) focusFirstError(formElement)
  }

  return (
    <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="profile-heading">
      <h2 id="profile-heading">{t('Profile')}</h2>
      <Field label={t('Name')} autoComplete="name" value={form.name} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, name: value })) }} error={errors.name} />
      <Field label={t('Email')} type="email" autoComplete="email" value={form.email} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, email: value })) }} error={errors.email} />
      <button type="submit" className="cta">{t('Save profile')}</button>
      <Status message={status} />
    </form>
  )
}

function PasswordForm({ email, changePassword, demoPassword }) {
  const t = useT()
  const blank = { current: '', next: '', confirm: '' }
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')
  const updateField = (key) => (e) => { const { value } = e.target; setForm((f) => ({ ...f, [key]: value })) }

  const submit = async (e) => {
    e.preventDefault()
    const formElement = e.currentTarget
    const next = {}
    if (!form.current) next.current = t('Please enter your current password.')
    const weakness = passwordProblem(form.next)
    if (weakness) next.next = weakness
    if (form.confirm !== form.next) next.confirm = t('Passwords don’t match.')
    if (!Object.keys(next).length) {
      const error = await changePassword(form.current, form.next)
      if (error) next.current = t(error)
    }
    setErrors(next)
    if (Object.keys(next).length) {
      setStatus('')
      focusFirstError(formElement)
    } else {
      setForm(blank)
      setStatus(t('Password updated'))
    }
  }

  return (
    <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="password-heading">
      <h2 id="password-heading">{t('Change password')}</h2>
      {demoPassword && <p className="demo-credentials">{t('Demo account password:')} <code>{demoPassword}</code></p>}
      {/* Lets password managers associate the new password with this account */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label={t('Current password')} type="password" autoComplete="current-password" value={form.current} onChange={updateField('current')} error={errors.current} />
      <Field label={t('New password')} type="password" autoComplete="new-password" value={form.next} onChange={updateField('next')} error={errors.next} hint={passwordHint()} />
      <Field label={t('Confirm new password')} type="password" autoComplete="new-password" value={form.confirm} onChange={updateField('confirm')} error={errors.confirm} />
      <button type="submit" className="cta">{t('Update password')}</button>
      <Status message={status} />
    </form>
  )
}

export function Account() {
  const { user, demoEmail, demoPassword, updateProfile, changePassword, changePlan, removePromo, setPreference, editProfile } = useAuth()
  const { profile } = useProfile()
  const { openMenu } = useAccessibility()
  const t = useT()
  const [planStatus, setPlanStatus] = useState('')
  const [maturityError, setMaturityError] = useState(null)
  const plan = findPlan(user.plan)

  // The rating stays as it was if saving fails, so say so
  const changeMaturity = async (maturity) => {
    setMaturityError(t(await editProfile(profile.id, { maturity })))
  }
  const promo = findPromotion(user.promo)

  const switchPlan = (id) => {
    changePlan(id)
    // Plan-specific codes (e.g. Premium-only) stop applying when the plan changes
    const dropped = promo?.plan && promo.plan !== id
    if (dropped) removePromo()
    setPlanStatus(t('Switched to {plan}', { plan: t(findPlan(id).name) }) + (dropped ? ` · ${t('{code} removed ({plan} only)', { code: promo.code, plan: t(findPlan(promo.plan).name) })}` : ''))
  }

  return (
    <>
      <PageHeader title={t('Account')} back />
      <div className="settings">
        <GrownUpGate what={t('account settings')}>
          <section className="settings-card membership" aria-labelledby="membership-heading">
            <h2 id="membership-heading">{t('Membership')}</h2>
            <p><b>{t(plan.name)}</b> · {promo ? <><span className="sr-only">{t('was')} </span><s className="muted">{plan.price}</s> <span className="sr-only">{t('now')} </span>{discountedPrice(plan.price, promo.percent)}</> : plan.price}{t('/month')}</p>
            {promo && <p className="muted">{t('Code {code}: {percent}% off', { code: promo.code, percent: promo.percent })} · <Link to="/info/promotions" className="inline-link">{t('Manage')}</Link></p>}
            <p className="muted">{billingSummary(user.billing)}</p>
            <p className="muted">{t('Member since {year}', { year: 2026 })} · {user.email}</p>
          </section>

          {user.isStaff && (
            <nav className="settings-card link-list" aria-label={t('Staff')}>
              <Link to="/support-dashboard">{t('Support dashboard')}</Link>
            </nav>
          )}

          <ProfileForm user={user} updateProfile={updateProfile} />
          <PasswordForm email={user.email} changePassword={changePassword} demoPassword={user.email === demoEmail ? demoPassword : null} />
          <Security />

          <section className="settings-card" aria-labelledby="plan-heading">
            <h2 id="plan-heading">{t('Plan')}</h2>
            <PlanPicker name="account-plan" value={user.plan} onChange={switchPlan} />
            <Status message={planStatus} />
          </section>

          <Billing />

          <section className="settings-card" aria-labelledby="playback-heading">
            <h2 id="playback-heading">{t('Playback & notifications')}</h2>
            {toggles.map(({ key, label, hint }) => (
              <label key={key} className="switch-row">
                <span><span className="switch-label">{t(label)}</span><span className="muted">{t(hint)}</span></span>
                <input type="checkbox" role="switch" checked={user.preferences[key]} onChange={(e) => setPreference(key, e.target.checked)} />
              </label>
            ))}
            <label className="select-row">
              <span className="switch-label">{t('Maturity rating')}</span>
              <span className="muted">{t('For {name}. Each profile has its own;', { name: profile.name })} <Link to="/profiles" className="inline-link">{t('manage profiles')}</Link>.</span>
              <select value={profile.maturity} onChange={(e) => changeMaturity(e.target.value)}>
                {maturityChoices.map((m) => <option key={m.value} value={m.value}>{t(m.label)}</option>)}
              </select>
            </label>
            {maturityError && <p className="form-alert" role="alert">{maturityError}</p>}
          </section>

          <InstallCard />

          <section className="settings-card" aria-labelledby="a11y-settings-heading">
            <h2 id="a11y-settings-heading">{t('Accessibility')}</h2>
            <p className="muted">{t('Text size, readable fonts, contrast, captions, reading aids and more. The menu is also behind the accessibility icon at the top of every page.')}</p>
            <button type="button" className="cta" aria-haspopup="dialog" onClick={openMenu}>{t('Open accessibility menu')}</button>
            <Link to="/info/accessibility" className="ghost-cta">{t('Read our Accessibility Policy')}</Link>
          </section>

          <section className="settings-card" aria-labelledby="privacy-heading">
            <h2 id="privacy-heading">{t('Privacy & data')}</h2>
            {privacyToggles.map(({ key, label, hint }) => (
              <label key={key} className="switch-row">
                <span><span className="switch-label">{t(label)}</span><span className="muted">{t(hint)}</span></span>
                <input type="checkbox" role="switch" checked={user.preferences[key]} onChange={(e) => setPreference(key, e.target.checked)} />
              </label>
            ))}
            <Link to="/history" className="ghost-cta">{t('Viewing activity and history settings')}</Link>
            <Link to="/year-in-review" className="ghost-cta">{t('Year in Review')}</Link>
            <p className="muted">{t('More choices:')} <Link to="/info/do-not-sell" className="inline-link">{t('Do Not Sell My Information')}</Link> · <Link to="/info/privacy" className="inline-link">{t('Privacy Policy')}</Link></p>
          </section>

          <AccountMonthlyDonation />

          <nav className="settings-card link-list" aria-label={t('Help')}>
            <Link to="/info/support">{t('Customer Support')}</Link>
            <Link to="/info/faqs">{t('FAQs')}</Link>
            <Link to="/info/promotions">{t('Promotions & Discounts')}</Link>
            <Link to="/info/affiliate">{t('Affiliate Program')}</Link>
            <Link to="/donate">{t('Make a donation')}</Link>
            <Link to="/info/legal">{t('Legal & Privacy')}</Link>
            <Link to="/info/accessibility">{t('Accessibility Policy')}</Link>
            <Link to="/logout" className="danger-link">{t('Sign out')}</Link>
          </nav>

          <DeleteAccount />
        </GrownUpGate>
      </div>
    </>
  )
}

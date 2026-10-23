import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { Field } from '../components/Field.jsx'
import { CODE_PATTERN } from '../data/totp.js'
import { EMAIL_PATTERN, useAuth } from '../state/authContext.js'
import { useT } from '../state/useT.js'
import { focusFirstError } from './formUtils.js'

// The second step for members with two-step sign-in on: the code from their authenticator app
function SecondStep({ email }) {
  const { verifySecondStep, cancelSecondStep } = useAuth()
  const t = useT()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    let problem = CODE_PATTERN.test(code) ? null : t('Enter the six-digit code from your authenticator app.')
    if (!problem) {
      setPending(true)
      problem = t(await verifySecondStep(code))
      setPending(false)
    }
    setError(problem)
    if (problem) {
      setCode('')
      focusFirstError(form)
    }
  }

  return (
    <AuthShell title={t('Two-step sign-in')}>
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
        <p className="auth-copy">{t('Open your authenticator app and enter the code for')} <b>{email}</b>.</p>
        <Field label={t('Six-digit code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={error} />
        <button type="submit" className="cta" disabled={pending}>{t('Verify')}</button>
      </form>
      <button type="button" className="ghost-cta" onClick={cancelSecondStep} disabled={pending}>{t('Use another account')}</button>
    </AuthShell>
  )
}

export function Login() {
  const { backend, ready, user, notice, secondStep, demoEmail, demoPassword, login, loginDemo } = useAuth()
  const location = useLocation()
  const t = useT()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  // Signing in with Supabase takes a round trip; don't let a second click start another
  const [pending, setPending] = useState(false)

  // Back to the page that asked for sign-in, with its query (search filters, a watch party's invite)
  const from = location.state?.from
  const destination = from ? `${from.pathname}${from.search ?? ''}` : '/'
  if (!ready) return <p className="session-restoring" role="status">{t('Signing you in…')}</p>
  // Signing in sets `user`, which brings the member here and on to where they were going
  if (user) return <Navigate to={destination} replace />
  if (secondStep) return <SecondStep email={secondStep.email} />

  const updateField = (key) => (e) => { const { value } = e.target; setForm((f) => ({ ...f, [key]: value })) }

  const finish = async (signIn) => {
    setPending(true)
    let error
    try {
      error = await signIn()
    } catch {
      // e.g. offline: the providers return messages for expected failures, so this is the network or a bug
      error = 'We couldn’t sign you in. Check your connection and try again.'
    } finally {
      setPending(false)
    }
    if (error) setFormError(t(error))
  }

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = t('Please enter a valid email address.')
    if (!form.password) next.password = t('Please enter your password.')
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    finish(() => login(form.email, form.password))
  }

  return (
    <AuthShell title={t('Sign In')}>
      {notice && <p className="form-success" role="status">{t(notice)}</p>}
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        <Field label={t('Email')} type="email" autoComplete="email" value={form.email} onChange={updateField('email')} error={errors.email} />
        <Field label={t('Password')} type="password" autoComplete="current-password" value={form.password} onChange={updateField('password')} error={errors.password} />
        <button type="submit" className="cta" disabled={pending}>{t('Sign In')}</button>
      </form>
      <p className="auth-switch"><Link to="/forgot-password">{t('Forgot your password?')}</Link></p>
      <button type="button" className="ghost-cta" onClick={() => finish(loginDemo)} disabled={pending}>{t('Use demo account')}</button>
      {demoPassword
        ? <p className="demo-credentials">{t('Or sign in as')} <b>{demoEmail}</b> {t('with password')} <code>{demoPassword}</code> ({backend === 'supabase' ? t('your private demo account, deleted after 24 hours') : t('new on every reload')}).</p>
        : <p className="demo-credentials">{t('Creates a private demo account for you. It’s deleted automatically after 24 hours.')}</p>}
      <p className="auth-switch">{t('New to Netflix?')} <Link to="/signup">{t('Sign up now.')}</Link></p>
    </AuthShell>
  )
}

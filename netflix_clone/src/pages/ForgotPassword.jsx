import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { Field } from '../components/Field.jsx'
import { EMAIL_PATTERN, normalizeEmail, useAuth } from '../state/authContext.js'
import { useT } from '../state/useT.js'
import { focusFirstError } from './formUtils.js'

// Step 1 of a password reset: send the link. The answer is the same whether or not the account exists.
export function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const t = useT()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [pending, setPending] = useState(false)
  // { email, demoLink? } once the request has gone through
  const [sent, setSent] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const invalid = !EMAIL_PATTERN.test(email.trim())
    setError(invalid ? t('Please enter a valid email address.') : null)
    setFormError(null)
    if (invalid) return focusFirstError(form)
    setPending(true)
    const result = await requestPasswordReset(email)
    setPending(false)
    if (result.error) setFormError(t(result.error))
    else setSent({ email: normalizeEmail(email), demoLink: result.demoLink })
  }

  if (sent) {
    return (
      <AuthShell title={t('Check your email')}>
        <p className="auth-copy" role="status">
          {t('If there’s an account for')} <b>{sent.email}</b>{t(', we’ve sent it a link to choose a new password.')}{' '}
          {t('The link works once and expires in an hour. Check your spam folder if it doesn’t arrive in a few minutes.')}
        </p>
        {sent.demoLink && (
          <p className="demo-credentials">
            {t('Demo mode: no email is sent.')} <Link to={sent.demoLink} className="inline-link">{t('Open the reset link')}</Link>
          </p>
        )}
        <p className="auth-switch"><Link to="/login">{t('Back to Sign In')}</Link></p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('Forgot your password?')}>
      <p className="auth-copy">{t('Enter the email address you signed up with and we’ll send you a link to choose a new password.')}</p>
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        <Field label={t('Email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        <button type="submit" className="cta" disabled={pending}>{t('Send reset link')}</button>
      </form>
      <p className="auth-switch">{t('Remembered it?')} <Link to="/login">{t('Sign in.')}</Link></p>
    </AuthShell>
  )
}

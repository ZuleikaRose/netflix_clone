import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { Field } from '../components/Field.jsx'
import { EMAIL_PATTERN, normalizeEmail, useAuth } from '../state/authContext.js'
import { focusFirstError } from './formUtils.js'

// Step 1 of a password reset: send the link. The answer is the same whether or not the account exists.
export function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
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
    setError(invalid ? 'Please enter a valid email address.' : null)
    setFormError(null)
    if (invalid) return focusFirstError(form)
    setPending(true)
    const result = await requestPasswordReset(email)
    setPending(false)
    if (result.error) setFormError(result.error)
    else setSent({ email: normalizeEmail(email), demoLink: result.demoLink })
  }

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <p className="auth-copy" role="status">
          If there’s an account for <b>{sent.email}</b>, we’ve sent it a link to choose a new password. The link works once and
          expires in an hour. Check your spam folder if it doesn’t arrive in a few minutes.
        </p>
        {sent.demoLink && (
          <p className="demo-credentials">
            Demo mode: no email is sent. <Link to={sent.demoLink} className="inline-link">Open the reset link</Link>
          </p>
        )}
        <p className="auth-switch"><Link to="/login">Back to Sign In</Link></p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Forgot your password?">
      <p className="auth-copy">Enter the email address you signed up with and we’ll send you a link to choose a new password.</p>
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        <button type="submit" className="cta" disabled={pending}>Send reset link</button>
      </form>
      <p className="auth-switch">Remembered it? <Link to="/login">Sign in.</Link></p>
    </AuthShell>
  )
}

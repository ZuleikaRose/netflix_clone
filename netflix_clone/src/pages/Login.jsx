import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { Field } from '../components/Field.jsx'
import { EMAIL_PATTERN, useAuth } from '../state/authContext.js'
import { focusFirstError } from './formUtils.js'

export function Login() {
  const { backend, user, notice, demoEmail, demoPassword, login, loginDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  // Signing in with Supabase takes a round trip; don't let a second click start another
  const [pending, setPending] = useState(false)

  // Return to the page that bounced the user here, if any
  const destination = location.state?.from?.pathname ?? '/'
  if (user) return <Navigate to={destination} replace />

  const updateField = (key) => (e) => setForm({ ...form, [key]: e.target.value })

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
    if (error) setFormError(error)
    else navigate(destination, { replace: true })
  }

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Please enter a valid email address.'
    if (!form.password) next.password = 'Please enter your password.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    finish(() => login(form.email, form.password))
  }

  return (
    <AuthShell title="Sign In">
      {notice && <p className="form-success" role="status">{notice}</p>}
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={updateField('email')} error={errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" value={form.password} onChange={updateField('password')} error={errors.password} />
        <button type="submit" className="cta" disabled={pending}>Sign In</button>
      </form>
      <button type="button" className="ghost-cta" onClick={() => finish(loginDemo)} disabled={pending}>Use demo account</button>
      {demoPassword
        ? <p className="demo-credentials">Or sign in as <b>{demoEmail}</b> with password <code>{demoPassword}</code> ({backend === 'supabase' ? 'your private demo account, deleted after 24 hours' : 'new on every reload'}).</p>
        : <p className="demo-credentials">Creates a private demo account for you. It’s deleted automatically after 24 hours.</p>}
      <p className="auth-switch">New to Netflix? <Link to="/signup">Sign up now.</Link></p>
    </AuthShell>
  )
}

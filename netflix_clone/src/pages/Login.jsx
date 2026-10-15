import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { Field } from '../components/Field.jsx'
import { EMAIL_PATTERN, useAuth } from '../state/authContext.js'
import { focusFirstError } from './formUtils.js'

export function Login() {
  const { user, login, loginDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)

  // Return to the page that bounced the user here, if any
  const destination = location.state?.from?.pathname ?? '/'
  if (user) return <Navigate to={destination} replace />

  const updateField = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Please enter a valid email address.'
    if (!form.password) next.password = 'Please enter your password.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    const error = login(form.email, form.password)
    if (error) setFormError(error)
    else navigate(destination, { replace: true })
  }

  const signInWithDemo = () => {
    loginDemo()
    navigate(destination, { replace: true })
  }

  return (
    <AuthShell title="Sign In">
      <form className="auth-form" onSubmit={submit} noValidate>
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={updateField('email')} error={errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" value={form.password} onChange={updateField('password')} error={errors.password} />
        <button type="submit" className="cta">Sign In</button>
      </form>
      <button type="button" className="ghost-cta" onClick={signInWithDemo}>Use demo account</button>
      <p className="auth-switch">New to Netflix? <Link to="/signup">Sign up now.</Link></p>
    </AuthShell>
  )
}

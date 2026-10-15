import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { Field } from '../components/Field.jsx'
import { PlanPicker } from '../components/PlanPicker.jsx'
import { EMAIL_PATTERN, MIN_PASSWORD, useAuth } from '../state/authContext.js'
import { focusFirstError } from './formUtils.js'

function validateSignup(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your name.'
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Please enter a valid email address.'
  if (form.password.length < MIN_PASSWORD) errors.password = `Password must be at least ${MIN_PASSWORD} characters.`
  if (form.confirm !== form.password) errors.confirm = 'Passwords don’t match.'
  return errors
}

export function Signup() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', plan: 'standard' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  // Affiliate links land here as /signup?ref=CODE
  const [params] = useSearchParams()
  const referralCode = params.get('ref')?.replace(/[^A-Z0-9]/gi, '').slice(0, 12)

  if (user) return <Navigate to="/" replace />

  const updateField = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    const next = validateSignup(form)
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    const error = signup(form)
    if (error) setFormError(error)
    else navigate('/', { replace: true })
  }

  return (
    <AuthShell title="Create Account">
      {referralCode && <p className="form-success" role="status">You were invited by a friend (code <b>{referralCode.toUpperCase()}</b>). Welcome!</p>}
      <form className="auth-form" onSubmit={submit} noValidate>
        {formError && <p className="form-alert" role="alert">{formError} <Link to="/login">Sign in instead</Link></p>}
        <Field label="Name" autoComplete="name" value={form.name} onChange={updateField('name')} error={errors.name} />
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={updateField('email')} error={errors.email} />
        <Field label="Password" type="password" autoComplete="new-password" value={form.password} onChange={updateField('password')} error={errors.password} hint={`At least ${MIN_PASSWORD} characters.`} />
        <Field label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={updateField('confirm')} error={errors.confirm} />
        <PlanPicker value={form.plan} onChange={(plan) => setForm({ ...form, plan })} />
        <button type="submit" className="cta">Start Watching</button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in.</Link></p>
    </AuthShell>
  )
}

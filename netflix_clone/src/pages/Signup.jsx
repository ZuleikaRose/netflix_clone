import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { Field } from '../components/Field.jsx'
import { PlanPicker } from '../components/PlanPicker.jsx'
import { EMAIL_PATTERN, PASSWORD_HINT, passwordProblem, useAuth } from '../state/authContext.js'
import { focusFirstError } from './formUtils.js'

function validateSignup(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your name.'
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Please enter a valid email address.'
  const weakness = passwordProblem(form.password)
  if (weakness) errors.password = weakness
  if (form.confirm !== form.password) errors.confirm = 'Passwords don’t match.'
  return errors
}

export function Signup() {
  const { user, signup, recordReferralClick } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', plan: 'standard' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [pending, setPending] = useState(false)
  // Set when Supabase asks the new member to confirm their email before signing in
  const [confirmEmail, setConfirmEmail] = useState(null)
  // Affiliate links land here as /signup?ref=CODE
  const [params] = useSearchParams()
  const referralCode = params.get('ref')?.replace(/[^A-Z0-9]/gi, '').slice(0, 12).toUpperCase()

  // Opening the link counts as a click for the affiliate (no-op without Supabase)
  useEffect(() => { if (referralCode) recordReferralClick(referralCode) }, [referralCode, recordReferralClick])

  if (user) return <Navigate to="/" replace />

  if (confirmEmail) {
    return (
      <AuthShell title="Check your email">
        <p className="auth-copy" role="status">We sent a confirmation link to <b>{confirmEmail}</b>. Open it to finish creating your account, then sign in.</p>
        <Link to="/login" className="cta">Go to Sign In</Link>
      </AuthShell>
    )
  }

  const updateField = (key) => (e) => { const { value } = e.target; setForm((f) => ({ ...f, [key]: value })) }

  const submit = async (e) => {
    e.preventDefault()
    const next = validateSignup(form)
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    setPending(true)
    const result = await signup({ ...form, referralCode })
    setPending(false)
    if (result.error) setFormError(result.error)
    else if (result.confirmEmail) setConfirmEmail(result.confirmEmail)
    else navigate('/', { replace: true })
  }

  return (
    <AuthShell title="Create Account">
      {referralCode && <p className="form-success" role="status">You were invited by a friend (code <b>{referralCode}</b>). Welcome!</p>}
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
        {formError && <p className="form-alert" role="alert">{formError} <Link to="/login">Sign in instead</Link></p>}
        <Field label="Name" autoComplete="name" value={form.name} onChange={updateField('name')} error={errors.name} />
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={updateField('email')} error={errors.email} />
        <Field label="Password" type="password" autoComplete="new-password" value={form.password} onChange={updateField('password')} error={errors.password} hint={PASSWORD_HINT} />
        <Field label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={updateField('confirm')} error={errors.confirm} />
        <PlanPicker value={form.plan} onChange={(plan) => setForm((f) => ({ ...f, plan }))} />
        <button type="submit" className="cta" disabled={pending}>Start Watching</button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in.</Link></p>
    </AuthShell>
  )
}

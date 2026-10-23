import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell.jsx'
import { Field } from '../components/Field.jsx'
import { passwordHint, passwordProblem, useAuth } from '../state/authContext.js'
import { useT } from '../state/useT.js'
import { focusFirstError } from './formUtils.js'

// Step 2 of a password reset: the page the emailed link opens. Checks the link, then sets the new password and
// sends the member to sign in.
export function ResetPassword() {
  const { beginPasswordReset, completePasswordReset } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const t = useT()
  // { state: 'checking' } → { state: 'ready', email } or { state: 'invalid', error }
  const [link, setLink] = useState({ state: 'checking' })
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [pending, setPending] = useState(false)

  // Checked once, with the URL as it arrived. The auth context changes identity as it connects, so a ref (which
  // survives StrictMode's remount) keeps the one-time link from being checked twice.
  const [arrival] = useState(() => ({ search: location.search, hash: location.hash }))
  const checked = useRef(false)
  useEffect(() => {
    if (checked.current) return
    checked.current = true
    beginPasswordReset(arrival).then((result) => {
      setLink(result.error ? { state: 'invalid', error: result.error } : { state: 'ready', email: result.email })
    })
    // The link carries a one-time token: keep it out of the address bar and history
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [arrival, beginPasswordReset])

  if (link.state === 'checking') {
    return (
      <AuthShell title={t('Reset your password')}>
        <p className="auth-copy" role="status">{t('Checking your reset link…')}</p>
      </AuthShell>
    )
  }

  if (link.state === 'invalid') {
    return (
      <AuthShell title={t('Reset your password')}>
        <p className="form-alert" role="alert">{t(link.error)}</p>
        <Link to="/forgot-password" className="cta">{t('Request a new link')}</Link>
        <p className="auth-switch"><Link to="/login">{t('Back to Sign In')}</Link></p>
      </AuthShell>
    )
  }

  const updateField = (key) => (e) => { const { value } = e.target; setForm((f) => ({ ...f, [key]: value })) }

  const submit = async (e) => {
    e.preventDefault()
    const formElement = e.currentTarget
    const next = {}
    const weakness = passwordProblem(form.password)
    if (weakness) next.password = weakness
    if (form.confirm !== form.password) next.confirm = t('Passwords don’t match.')
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstError(formElement)
    setPending(true)
    const error = await completePasswordReset(form.password)
    setPending(false)
    // The sign-in page shows the "password changed" notice
    if (error) setFormError(t(error))
    else navigate('/login', { replace: true })
  }

  return (
    <AuthShell title={t('Choose a new password')}>
      <p className="auth-copy">{t('For')} <b>{link.email}</b>.</p>
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        {/* Lets password managers save the new password for the right account */}
        <input type="text" name="username" autoComplete="username" value={link.email} readOnly hidden />
        <Field label={t('New password')} type="password" autoComplete="new-password" value={form.password} onChange={updateField('password')} error={errors.password} hint={passwordHint()} />
        <Field label={t('Confirm new password')} type="password" autoComplete="new-password" value={form.confirm} onChange={updateField('confirm')} error={errors.confirm} />
        <button type="submit" className="cta" disabled={pending}>{t('Save new password')}</button>
      </form>
    </AuthShell>
  )
}

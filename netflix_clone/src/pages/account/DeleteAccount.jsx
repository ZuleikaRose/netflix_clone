import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '../../components/Field.jsx'
import { useAuth } from '../../state/authContext.js'
import { focusFirstError } from '../formUtils.js'

// Danger zone: deleting needs a cancelled membership, the account email typed out and the password. It removes app access only;
// erasing data is a separate support request.
export function DeleteAccount() {
  const { user, deleteAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const headingRef = useRef(null)
  const cancelled = user.billing.status === 'cancelled'

  // The form replaces the button that opened it, so move focus to its heading
  useEffect(() => { if (open) headingRef.current.focus() }, [open])

  const goToBilling = () => {
    const heading = document.getElementById('billing-heading')
    heading.scrollIntoView({ block: 'start' })
    heading.focus({ preventScroll: true })
  }

  const close = () => {
    setOpen(false)
    setEmail('')
    setPassword('')
    setErrors({})
  }

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const next = {}
    if (!cancelled) next.membership = 'Your membership is still active. Cancel it in Billing before deleting your account.'
    if (email.trim().toLowerCase() !== user.email) next.email = 'This doesn’t match your account email.'
    if (!password) next.password = 'Please enter your password.'
    if (!Object.keys(next).length) {
      // Signing out sends the user to /login, which shows the deletion notice (and unmounts this form)
      const error = await deleteAccount(password)
      if (!error) return
      next.password = error
    }
    setErrors(next)
    if (next.email || next.password) focusFirstError(form)
  }

  return (
    <section className="settings-card danger-zone" aria-labelledby="danger-heading">
      <h2 id="danger-heading">Danger zone</h2>
      {!open
        ? <>
          <p className="muted">Delete your account and remove your access to the app.</p>
          <button type="button" className="cta delete-fill" onClick={() => setOpen(true)}>Delete account</button>
        </>
        : (
          <form className="confirm-box" onSubmit={submit} noValidate aria-labelledby="delete-heading">
            {/* Lets password managers fill the right account's password */}
            <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
            <h3 id="delete-heading" ref={headingRef} tabIndex={-1}>Before you delete your account</h3>
            <ol className="delete-steps">
              <li className={cancelled ? 'done' : undefined}>
                <b>Cancel your membership first.</b> Delete account won’t work until your subscription is cancelled.{' '}
                {cancelled
                  ? <span className="ok-text">Done: your membership is cancelled.</span>
                  : <button type="button" className="text-button" onClick={goToBilling}>Go to Billing to cancel</button>}
              </li>
              <li><b>This only removes your access to the app.</b> Your viewing history, reviews and other data stay on file.</li>
              <li><b>Want your data removed too?</b> <Link to="/info/report-issue?type=data-removal" className="inline-link">Contact support to submit a ticket</Link> and we’ll remove it.</li>
            </ol>
            {errors.membership && <p className="form-alert" role="alert">{errors.membership}</p>}
            <Field label="Type your email address to confirm" type="email" autoComplete="off" spellCheck="false" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} hint={`Type ${user.email}`} />
            <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
            <button type="submit" className="cta delete-fill">Delete my account access</button>
            <button type="button" className="ghost-cta" onClick={close}>Keep my account</button>
          </form>
        )}
    </section>
  )
}

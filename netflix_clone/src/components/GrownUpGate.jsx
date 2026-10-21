import { useState } from 'react'
import { focusFirstError } from '../pages/formUtils.js'
import { useAuth } from '../state/authContext.js'
import { useProfile } from '../state/profileContext.js'
import { Field } from './Field.jsx'

// On a Kids profile, account settings and profile management wait for the account password ("Ask a grown-up").
// Other profiles see `children` straight away.
export function GrownUpGate({ what, children }) {
  const { checkPassword } = useAuth()
  const { profile, grownUp, confirmGrownUp } = useProfile()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  if (grownUp) return children

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    let problem = password ? null : 'Please enter the account password.'
    if (!problem) {
      setBusy(true)
      problem = await checkPassword(password)
      setBusy(false)
    }
    setError(problem)
    if (problem) return focusFirstError(form)
    confirmGrownUp()
  }

  return (
    <form className="settings-card grown-up" onSubmit={submit} noValidate aria-labelledby="grown-up-heading">
      <h2 id="grown-up-heading">Ask a grown-up</h2>
      <p className="muted">{profile.name} is a Kids profile. A grown-up needs to enter the account password to open {what}.</p>
      <Field label="Account password" type="password" autoComplete="current-password" value={password}
        onChange={(e) => setPassword(e.target.value)} error={error} />
      <button type="submit" className="cta" disabled={busy}>Continue</button>
    </form>
  )
}

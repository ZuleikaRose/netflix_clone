import { useState } from 'react'
import { focusFirstError } from '../pages/formUtils.js'
import { useAuth } from '../state/authContext.js'
import { useProfile } from '../state/profileContext.js'
import { useT } from '../state/useT.js'
import { Field } from './Field.jsx'

// On a Kids profile, account settings and profile management wait for the account password ("Ask a grown-up").
// Other profiles see `children` straight away. `what` comes already translated ("account settings").
export function GrownUpGate({ what, children }) {
  const { checkPassword } = useAuth()
  const t = useT()
  const { profile, grownUp, confirmGrownUp } = useProfile()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  if (grownUp) return children

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    let problem = password ? null : t('Please enter the account password.')
    if (!problem) {
      setBusy(true)
      problem = t(await checkPassword(password))
      setBusy(false)
    }
    setError(problem)
    if (problem) return focusFirstError(form)
    confirmGrownUp()
  }

  return (
    <form className="settings-card grown-up" onSubmit={submit} noValidate aria-labelledby="grown-up-heading">
      <h2 id="grown-up-heading">{t('Ask a grown-up')}</h2>
      <p className="muted">{t('{name} is a Kids profile. A grown-up needs to enter the account password to open {what}.', { name: profile.name, what })}</p>
      <Field label={t('Account password')} type="password" autoComplete="current-password" value={password}
        onChange={(e) => setPassword(e.target.value)} error={error} />
      <button type="submit" className="cta" disabled={busy}>{t('Continue')}</button>
    </form>
  )
}

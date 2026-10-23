import { useState } from 'react'
import { EXTRA_MINUTES, formatMinutes } from '../data/screenTime.js'
import { focusFirstError } from '../pages/formUtils.js'
import { useT } from '../state/useT.js'
import { Field } from './Field.jsx'

// Over the player once the profile has used its daily limit: a grown-up can allow more time with the account password
export function ScreenTimeUp({ profileName, limit, onAllow, onClose }) {
  const t = useT()
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    let problem = password ? null : 'Please enter the account password.'
    if (!problem) {
      setBusy(true)
      problem = await onAllow(password)
      setBusy(false)
    }
    setError(problem)
    if (problem) focusFirstError(form)
  }

  return (
    <div className="player-end screen-time-up" role="alertdialog" aria-modal="false" aria-labelledby="time-up-heading" aria-describedby="time-up-text">
      <h2 id="time-up-heading">{t('Time’s up for today')}</h2>
      <p id="time-up-text">{t('{name} has watched {time} today, the daily limit. Watching starts again tomorrow.', { name: profileName, time: formatMinutes(limit) })}</p>
      {asking
        ? (
          <form className="lock-form" onSubmit={submit} noValidate aria-label={t('Allow {minutes} more minutes', { minutes: EXTRA_MINUTES })}>
            <Field label={t('Account password')} type="password" autoComplete="current-password" value={password} autoFocus
              onChange={(e) => setPassword(e.target.value)} error={t(error)} hint={t('A grown-up can allow more time today.')} />
            <button type="submit" className="play" disabled={busy}>{t('Allow {minutes} minutes', { minutes: EXTRA_MINUTES })}</button>
            <button type="button" className="secondary" onClick={() => { setAsking(false); setError(null); setPassword('') }}>{t('Cancel')}</button>
          </form>
        )
        : (
          <>
            <button type="button" className="play" onClick={() => setAsking(true)}>{t('Ask a grown-up')}</button>
            <button type="button" className="secondary" onClick={onClose}>{t('Close')}</button>
          </>
        )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Field } from '../../components/Field.jsx'
import { useCopyToClipboard } from '../../components/useCopyToClipboard.js'
import { describeDevice, formatWhen } from '../../data/devices.js'
import { CODE_PATTERN } from '../../data/totp.js'
import { useAuth } from '../../state/authContext.js'
import { useT } from '../../state/useT.js'
import { focusFirstError } from '../formUtils.js'

// A six-digit code field and a button; onCode(code) resolves to an error message or null. Labels come translated.
function CodeForm({ label, submitLabel, danger = false, onCode, onCancel }) {
  const t = useT()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    let problem = CODE_PATTERN.test(code) ? null : t('Enter the six-digit code from your authenticator app.')
    if (!problem) {
      setBusy(true)
      problem = t(await onCode(code))
      setBusy(false)
    }
    setError(problem)
    if (problem) {
      setCode('')
      focusFirstError(form)
    }
  }
  return (
    <form className="lock-form" onSubmit={submit} noValidate aria-label={label}>
      <Field label={t('Six-digit code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={error} hint={t('The six-digit code your authenticator app shows now.')} />
      <button type="submit" className={danger ? 'cta delete-fill' : 'cta'} disabled={busy}>{submitLabel}</button>
      <button type="button" className="ghost-cta" onClick={onCancel}>{t('Cancel')}</button>
    </form>
  )
}

function TwoStep() {
  const { user, startTwoStep, confirmTwoStep, turnOffTwoStep } = useAuth()
  const { copied, copy } = useCopyToClipboard()
  const t = useT()
  const [setup, setSetup] = useState(null) // { factorId, key, uri, qrCode } while turning on
  const [turningOff, setTurningOff] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')

  const begin = async () => {
    setStatus('')
    const started = await startTwoStep()
    setError(t(started.error) ?? null)
    if (!started.error) setSetup(started)
  }
  const confirm = async (code) => {
    const problem = await confirmTwoStep(setup.factorId, code)
    if (!problem) {
      setSetup(null)
      setStatus(t('Two-step sign-in is on'))
    }
    return problem
  }
  const turnOff = async (code) => {
    const problem = await turnOffTwoStep(code)
    if (!problem) {
      setTurningOff(false)
      setStatus(t('Two-step sign-in is off'))
    }
    return problem
  }
  // The key in groups of four, easier to type into an app
  const groupedKey = setup?.key.match(/.{1,4}/g).join(' ')

  return (
    <section className="settings-card" aria-labelledby="two-step-heading">
      <h2 id="two-step-heading">{t('Two-step sign-in')}</h2>
      <p className="muted">
        {user.twoStep
          ? t('On. Signing in asks for a code from your authenticator app after your password.')
          : t('Off. Turn it on to ask for a code from an authenticator app (such as Google Authenticator, Microsoft Authenticator or 1Password) after your password.')}
      </p>
      {setup && (
        <div className="two-step-setup">
          <ol className="delete-steps">
            <li>{setup.qrCode ? t('Scan this code with your authenticator app, or enter the setup key.') : t('In your authenticator app, add an account and enter this setup key.')}</li>
            <li>{t('Enter the six-digit code the app shows.')}</li>
          </ol>
          {setup.qrCode && <img className="two-step-qr" src={setup.qrCode} alt={t('QR code for your authenticator app')} width="180" height="180" />}
          <p className="setup-key">{t('Setup key:')} <code>{groupedKey}</code></p>
          <button type="button" className="ghost-cta" onClick={() => copy('key', setup.key)}>{t('Copy setup key')}</button>
          {copied?.key === 'key' && <p className="muted" role="status">{copied.ok ? t('Setup key copied') : t('Copy it by hand: {key}', { key: setup.key })}</p>}
          <CodeForm label={t('Confirm two-step sign-in')} submitLabel={t('Turn on')} onCode={confirm} onCancel={() => setSetup(null)} />
        </div>
      )}
      {turningOff && <CodeForm label={t('Turn off two-step sign-in')} submitLabel={t('Turn off')} danger onCode={turnOff} onCancel={() => setTurningOff(false)} />}
      {!setup && !turningOff && (user.twoStep
        ? <button type="button" className="ghost-cta" onClick={() => { setTurningOff(true); setStatus('') }}>{t('Turn off two-step sign-in')}</button>
        : <button type="button" className="cta" onClick={begin}>{t('Turn on two-step sign-in')}</button>)}
      {error && <p className="form-alert" role="alert">{error}</p>}
      <p className="save-status" role="status">{status && <><span aria-hidden="true">✓</span> {status}</>}</p>
    </section>
  )
}

function Devices() {
  const { listDevices, signOutDevice, signOutOtherDevices } = useAuth()
  const t = useT()
  const [devices, setDevices] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')

  const refresh = async () => {
    const found = await listDevices()
    setError(t(found.error) ?? null)
    if (!found.error) setDevices(found.devices)
  }
  useEffect(() => {
    let ignore = false
    listDevices().then((found) => {
      if (ignore) return
      setError(t(found.error) ?? null)
      if (!found.error) setDevices(found.devices)
    })
    return () => { ignore = true }
    // Read once per visit; the buttons below refresh it
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const others = (devices ?? []).filter((d) => !d.current)
  const signOut = async (device) => {
    const problem = await signOutDevice(device.id)
    setError(t(problem))
    if (!problem) setStatus(t('{device} is signed out', { device: describeDevice(device.userAgent) }))
    refresh()
  }
  const signOutOthers = async () => {
    const problem = await signOutOtherDevices()
    setError(t(problem))
    if (!problem) setStatus(t('Every other device is signed out'))
    refresh()
  }

  return (
    <section className="settings-card" aria-labelledby="devices-heading">
      <h2 id="devices-heading">{t('Signed-in devices')}</h2>
      {!devices && !error && <p className="muted" role="status">{t('Loading your devices…')}</p>}
      {devices && (
        <ul className="device-list">
          {devices.map((d) => (
            <li key={d.id}>
              <span>
                <b>{describeDevice(d.userAgent)}</b>{d.current && <span className="profile-badge">{t('This device')}</span>}
                <span className="muted">{t('Last active {when}', { when: formatWhen(d.lastActiveAt) })}{d.signedInAt ? ` · ${t('signed in {when}', { when: formatWhen(d.signedInAt) })}` : ''}</span>
              </span>
              {!d.current && <button type="button" className="ghost-cta" aria-label={t('Sign out {device}, last active {when}', { device: describeDevice(d.userAgent), when: formatWhen(d.lastActiveAt) })} onClick={() => signOut(d)}>{t('Sign out')}</button>}
            </li>
          ))}
        </ul>
      )}
      {devices && <p className="muted">{others.length ? t('A device you sign out has to sign in again within the hour.') : t('No other devices are signed in.')}</p>}
      {others.length > 0 && <button type="button" className="ghost-cta" onClick={signOutOthers}>{t('Sign out all other devices')}</button>}
      {error && <p className="form-alert" role="alert">{error}</p>}
      <p className="save-status" role="status">{status && <><span aria-hidden="true">✓</span> {status}</>}</p>
    </section>
  )
}

// Account → Security: two-step sign-in and the account's signed-in devices
export function Security() {
  return (
    <>
      <TwoStep />
      <Devices />
    </>
  )
}

import { useEffect, useState } from 'react'
import { Field } from '../../components/Field.jsx'
import { useCopyToClipboard } from '../../components/useCopyToClipboard.js'
import { describeDevice, formatWhen } from '../../data/devices.js'
import { CODE_PATTERN } from '../../data/totp.js'
import { useAuth } from '../../state/authContext.js'
import { focusFirstError } from '../formUtils.js'

const codeHint = 'The six-digit code your authenticator app shows now.'

// A six-digit code field and a button; onCode(code) resolves to an error message or null
function CodeForm({ label, submitLabel, danger = false, onCode, onCancel }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    let problem = CODE_PATTERN.test(code) ? null : 'Enter the six-digit code from your authenticator app.'
    if (!problem) {
      setBusy(true)
      problem = await onCode(code)
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
      <Field label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={error} hint={codeHint} />
      <button type="submit" className={danger ? 'cta delete-fill' : 'cta'} disabled={busy}>{submitLabel}</button>
      <button type="button" className="ghost-cta" onClick={onCancel}>Cancel</button>
    </form>
  )
}

function TwoStep() {
  const { user, startTwoStep, confirmTwoStep, turnOffTwoStep } = useAuth()
  const { copied, copy } = useCopyToClipboard()
  const [setup, setSetup] = useState(null) // { factorId, key, uri, qrCode } while turning on
  const [turningOff, setTurningOff] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')

  const begin = async () => {
    setStatus('')
    const started = await startTwoStep()
    setError(started.error ?? null)
    if (!started.error) setSetup(started)
  }
  const confirm = async (code) => {
    const problem = await confirmTwoStep(setup.factorId, code)
    if (!problem) {
      setSetup(null)
      setStatus('Two-step sign-in is on')
    }
    return problem
  }
  const turnOff = async (code) => {
    const problem = await turnOffTwoStep(code)
    if (!problem) {
      setTurningOff(false)
      setStatus('Two-step sign-in is off')
    }
    return problem
  }
  // The key in groups of four, easier to type into an app
  const groupedKey = setup?.key.match(/.{1,4}/g).join(' ')

  return (
    <section className="settings-card" aria-labelledby="two-step-heading">
      <h2 id="two-step-heading">Two-step sign-in</h2>
      <p className="muted">
        {user.twoStep
          ? 'On. Signing in asks for a code from your authenticator app after your password.'
          : 'Off. Turn it on to ask for a code from an authenticator app (such as Google Authenticator, Microsoft Authenticator or 1Password) after your password.'}
      </p>
      {setup && (
        <div className="two-step-setup">
          <ol className="delete-steps">
            <li>{setup.qrCode ? 'Scan this code with your authenticator app, or enter the setup key.' : 'In your authenticator app, add an account and enter this setup key.'}</li>
            <li>Enter the six-digit code the app shows.</li>
          </ol>
          {setup.qrCode && <img className="two-step-qr" src={setup.qrCode} alt="QR code for your authenticator app" width="180" height="180" />}
          <p className="setup-key">Setup key: <code>{groupedKey}</code></p>
          <button type="button" className="ghost-cta" onClick={() => copy('key', setup.key)}>Copy setup key</button>
          {copied?.key === 'key' && <p className="muted" role="status">{copied.ok ? 'Setup key copied' : `Copy it by hand: ${setup.key}`}</p>}
          <CodeForm label="Confirm two-step sign-in" submitLabel="Turn on" onCode={confirm} onCancel={() => setSetup(null)} />
        </div>
      )}
      {turningOff && <CodeForm label="Turn off two-step sign-in" submitLabel="Turn off" danger onCode={turnOff} onCancel={() => setTurningOff(false)} />}
      {!setup && !turningOff && (user.twoStep
        ? <button type="button" className="ghost-cta" onClick={() => { setTurningOff(true); setStatus('') }}>Turn off two-step sign-in</button>
        : <button type="button" className="cta" onClick={begin}>Turn on two-step sign-in</button>)}
      {error && <p className="form-alert" role="alert">{error}</p>}
      <p className="save-status" role="status">{status && <><span aria-hidden="true">✓</span> {status}</>}</p>
    </section>
  )
}

function Devices() {
  const { listDevices, signOutDevice, signOutOtherDevices } = useAuth()
  const [devices, setDevices] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')

  const refresh = async () => {
    const found = await listDevices()
    setError(found.error ?? null)
    if (!found.error) setDevices(found.devices)
  }
  useEffect(() => {
    let ignore = false
    listDevices().then((found) => {
      if (ignore) return
      setError(found.error ?? null)
      if (!found.error) setDevices(found.devices)
    })
    return () => { ignore = true }
    // Read once per visit; the buttons below refresh it
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const others = (devices ?? []).filter((d) => !d.current)
  const signOut = async (device) => {
    const problem = await signOutDevice(device.id)
    setError(problem)
    if (!problem) setStatus(`${describeDevice(device.userAgent)} is signed out`)
    refresh()
  }
  const signOutOthers = async () => {
    const problem = await signOutOtherDevices()
    setError(problem)
    if (!problem) setStatus('Every other device is signed out')
    refresh()
  }

  return (
    <section className="settings-card" aria-labelledby="devices-heading">
      <h2 id="devices-heading">Signed-in devices</h2>
      {!devices && !error && <p className="muted" role="status">Loading your devices…</p>}
      {devices && (
        <ul className="device-list">
          {devices.map((d) => (
            <li key={d.id}>
              <span>
                <b>{describeDevice(d.userAgent)}</b>{d.current && <span className="profile-badge">This device</span>}
                <span className="muted">Last active {formatWhen(d.lastActiveAt)}{d.signedInAt ? ` · signed in ${formatWhen(d.signedInAt)}` : ''}</span>
              </span>
              {!d.current && <button type="button" className="ghost-cta" aria-label={`Sign out ${describeDevice(d.userAgent)}, last active ${formatWhen(d.lastActiveAt)}`} onClick={() => signOut(d)}>Sign out</button>}
            </li>
          ))}
        </ul>
      )}
      {devices && <p className="muted">{others.length ? 'A device you sign out has to sign in again within the hour.' : 'No other devices are signed in.'}</p>}
      {others.length > 0 && <button type="button" className="ghost-cta" onClick={signOutOthers}>Sign out all other devices</button>}
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

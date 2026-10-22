import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Field } from '../components/Field.jsx'
import { GrownUpGate } from '../components/GrownUpGate.jsx'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import { MAX_PROFILES, MAX_PROFILE_NAME, PIN_PATTERN, avatarColors, maturityChoices, profileNameProblem } from '../data/profiles.js'
import { useAuth } from '../state/authContext.js'
import { useProfile } from '../state/profileContext.js'
import { LIMIT_CHOICES, formatMinutes } from '../data/screenTime.js'
import { useScreenTime } from '../state/useScreenTime.js'
import { focusFirstError } from './formUtils.js'

// Adds a profile (no `profile`) or edits one; deleting needs a second, explicit press
function ProfileForm({ profile, others, onDone }) {
  const { addProfile, editProfile, removeProfile } = useAuth()
  const { profile: watching, forgetProfile } = useProfile()
  const [form, setForm] = useState({ name: profile?.name ?? '', avatar: profile?.avatar ?? 'blue', maturity: profile?.maturity ?? 'all' })
  const [error, setError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const formElement = e.currentTarget
    const problem = profileNameProblem(form.name, others)
    setError(problem)
    setSaveError(null)
    if (problem) return focusFirstError(formElement)
    setBusy(true)
    const failed = profile ? await editProfile(profile.id, form) : await addProfile(form)
    setBusy(false)
    if (failed) return setSaveError(failed)
    onDone()
  }

  const remove = async () => {
    setBusy(true)
    const failed = await removeProfile(profile.id)
    setBusy(false)
    if (failed) return setSaveError(failed)
    if (watching?.id === profile.id) forgetProfile()
    onDone()
  }

  return (
    <form className="settings-card profile-form" onSubmit={submit} noValidate aria-labelledby="profile-form-heading">
      <h2 id="profile-form-heading">{profile ? `Edit ${profile.name}` : 'Add a profile'}</h2>
      <Field label="Profile name" value={form.name} maxLength={MAX_PROFILE_NAME} autoComplete="off" error={error}
        onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, name: value })) }} />
      <fieldset className="avatar-choices">
        <legend>Avatar colour</legend>
        {avatarColors.map((a) => (
          <label key={a.key} className="avatar-choice">
            <input type="radio" name="avatar" value={a.key} checked={form.avatar === a.key} onChange={() => setForm((f) => ({ ...f, avatar: a.key }))} />
            <ProfileAvatar profile={{ avatar: a.key }} /><span>{a.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="select-row">
        <span className="switch-label">Maturity rating</span>
        <select value={form.maturity} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, maturity: value })) }}>
          {maturityChoices.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      {saveError && <p className="form-alert" role="alert">{saveError}</p>}
      <button type="submit" className="cta" disabled={busy}>{profile ? 'Save profile' : 'Add profile'}</button>
      <button type="button" className="ghost-cta" onClick={onDone}>Cancel</button>
      {profile && others.length > 0 && (
        confirmDelete
          ? (
            <div className="profile-delete" role="group" aria-label={`Delete ${profile.name}?`}>
              <p>Deleting {profile.name} also deletes its watch list, favorites, Continue Watching and game scores.</p>
              <button type="button" className="cta delete-fill" disabled={busy} onClick={remove}>Yes, delete {profile.name}</button>
              <button type="button" className="ghost-cta" onClick={() => setConfirmDelete(false)}>Keep profile</button>
            </div>
          )
          : <button type="button" className="ghost-cta" onClick={() => setConfirmDelete(true)}>Delete profile</button>
      )}
    </form>
  )
}

// Asks for a locked profile's PIN; onUnlocked runs once it's right
function PinPrompt({ profile, onUnlocked, onCancel }) {
  const { unlockProfile } = useAuth()
  const { markUnlocked } = useProfile()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    let problem = PIN_PATTERN.test(pin) ? null : 'Enter the profile’s four-digit PIN.'
    if (!problem) {
      setBusy(true)
      problem = await unlockProfile(profile.id, pin)
      setBusy(false)
    }
    setError(problem)
    if (problem) {
      setPin('')
      return focusFirstError(form)
    }
    markUnlocked(profile.id)
    onUnlocked()
  }

  return (
    <form className="settings-card pin-prompt" onSubmit={submit} noValidate aria-labelledby="pin-heading">
      <ProfileAvatar profile={profile} large />
      <h2 id="pin-heading">{profile.name} is locked</h2>
      <Field label="Profile PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} autoFocus
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} error={error} />
      <button type="submit" className="cta" disabled={busy}>Unlock</button>
      <button type="button" className="ghost-cta" onClick={onCancel}>Cancel</button>
    </form>
  )
}

// Adds, changes or removes a profile's PIN; the account password confirms it's the account holder
function ProfileLockForm({ profile }) {
  const { setProfilePin } = useAuth()
  const { markUnlocked } = useProfile()
  const blank = { pin: '', confirm: '', password: '' }
  const [open, setOpen] = useState(null) // null | 'set' | 'remove'
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const updateField = (key, digitsOnly = false) => (e) => {
    const value = digitsOnly ? e.target.value.replace(/\D/g, '') : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const formElement = e.currentTarget
    const next = {}
    if (open === 'set') {
      if (!PIN_PATTERN.test(form.pin)) next.pin = 'A PIN is four digits.'
      else if (form.confirm !== form.pin) next.confirm = 'PINs don’t match.'
    }
    if (!form.password) next.password = 'Please enter the account password.'
    if (!Object.keys(next).length) {
      setBusy(true)
      const failed = await setProfilePin(profile.id, open === 'set' ? form.pin : null, form.password)
      setBusy(false)
      if (failed) next.password = failed
    }
    setErrors(next)
    if (Object.keys(next).length) return focusFirstError(formElement)
    // Locking the profile that's watching shouldn't send this device back to Who's watching
    markUnlocked(profile.id)
    setStatus(open === 'set' ? `${profile.name} is locked with a PIN` : `PIN removed from ${profile.name}`)
    setForm(blank)
    setOpen(null)
  }

  return (
    <section className="settings-card" aria-labelledby="lock-heading">
      <h2 id="lock-heading">Profile lock</h2>
      <p className="muted">{profile.locked ? `${profile.name} needs a four-digit PIN to open.` : `Anyone can open ${profile.name}. Add a PIN to keep it to yourself.`}</p>
      {open
        ? (
          <form className="lock-form" onSubmit={submit} noValidate aria-label={open === 'set' ? 'Set a PIN' : 'Remove the PIN'}>
            {open === 'set' && (
              <>
                <Field label="New PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={form.pin}
                  onChange={updateField('pin', true)} error={errors.pin} hint="Four digits." />
                <Field label="Confirm PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={form.confirm}
                  onChange={updateField('confirm', true)} error={errors.confirm} />
              </>
            )}
            <Field label="Account password" type="password" autoComplete="current-password" value={form.password}
              onChange={updateField('password')} error={errors.password} />
            <button type="submit" className={open === 'set' ? 'cta' : 'cta delete-fill'} disabled={busy}>{open === 'set' ? 'Save PIN' : 'Remove PIN'}</button>
            <button type="button" className="ghost-cta" onClick={() => { setOpen(null); setErrors({}); setForm(blank) }}>Cancel</button>
          </form>
        )
        : (
          <>
            <button type="button" className="ghost-cta" onClick={() => { setOpen('set'); setStatus('') }}>{profile.locked ? 'Change PIN' : 'Add a PIN'}</button>
            {profile.locked && <button type="button" className="ghost-cta" onClick={() => { setOpen('remove'); setStatus('') }}>Remove PIN</button>}
          </>
        )}
      <p className="save-status" role="status">{status && <><span aria-hidden="true">✓</span> {status}</>}</p>
    </section>
  )
}

// A daily viewing limit for the profile (meant for Kids profiles); the account password confirms it's a grown-up
function ScreenTimeForm({ profile }) {
  const { setScreenTimeLimit } = useAuth()
  const { profile: watching } = useProfile()
  const { usedSeconds } = useScreenTime()
  const [minutes, setMinutes] = useState(profile.dailyLimit ? String(profile.dailyLimit) : '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const unchanged = (minutes ? Number(minutes) : null) === (profile.dailyLimit ?? null)

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    let problem = password ? null : 'Please enter the account password.'
    if (!problem) {
      setBusy(true)
      problem = await setScreenTimeLimit(profile.id, minutes ? Number(minutes) : null, password)
      setBusy(false)
    }
    setError(problem)
    if (problem) return focusFirstError(form)
    setPassword('')
    setStatus(minutes ? `${profile.name} can watch ${formatMinutes(Number(minutes))} a day` : `No daily limit for ${profile.name}`)
  }

  return (
    <section className="settings-card" aria-labelledby="screen-time-heading">
      <h2 id="screen-time-heading">Screen time</h2>
      <p className="muted">
        {profile.dailyLimit
          ? `${profile.name} can watch ${formatMinutes(profile.dailyLimit)} a day. When it’s used up, the player stops until tomorrow unless a grown-up allows more time.`
          : `${profile.name} can watch as long as they like. Set a daily limit to stop the player once the time is used up.`}
        {profile.dailyLimit && profile.id === watching?.id ? ` Watched today: ${formatMinutes(Math.floor(usedSeconds / 60))}.` : ''}
      </p>
      <form className="lock-form" onSubmit={submit} noValidate aria-label="Set a daily limit">
        <label className="select-row">
          <span className="switch-label">Daily limit</span>
          <select value={minutes} onChange={(e) => { const { value } = e.target; setMinutes(value); setStatus('') }}>
            <option value="">No limit</option>
            {LIMIT_CHOICES.map((m) => <option key={m} value={m}>{formatMinutes(m)} a day</option>)}
          </select>
        </label>
        {!unchanged && (
          <>
            <Field label="Account password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} error={error} />
            <button type="submit" className="cta" disabled={busy}>Save daily limit</button>
          </>
        )}
      </form>
      <p className="save-status" role="status">{status && <><span aria-hidden="true">✓</span> {status}</>}</p>
    </section>
  )
}

// "Who's watching?": pick a profile, or manage them (add, rename, recolour, change the maturity rating, delete)
export function Profiles() {
  const { profiles, chooseProfile, isUnlocked } = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('choose') // 'choose' | 'manage' | 'add' | a profile id being edited
  // A locked profile asking for its PIN before it opens ('watch') or before it can be edited ('edit')
  const [asking, setAsking] = useState(null) // { id, then } | null
  const editing = profiles.find((p) => p.id === mode)
  const askingFor = profiles.find((p) => p.id === asking?.id)
  const managing = mode === 'manage'

  const watch = (id) => {
    chooseProfile(id)
    const from = location.state?.from
    navigate(from && from.pathname !== '/profiles' ? `${from.pathname}${from.search ?? ''}` : '/', { replace: true })
  }

  const pick = (p) => {
    if (p.locked && !isUnlocked(p.id)) return setAsking({ id: p.id, then: managing ? 'edit' : 'watch' })
    if (managing) setMode(p.id)
    else watch(p.id)
  }

  if (askingFor) {
    const unlocked = () => {
      setAsking(null)
      if (asking.then === 'edit') setMode(askingFor.id)
      else watch(askingFor.id)
    }
    return (
      <>
        <PageHeader title="Profiles" />
        <div className="settings">
          <PinPrompt key={askingFor.id} profile={askingFor} onUnlocked={unlocked} onCancel={() => setAsking(null)} />
        </div>
      </>
    )
  }

  if (mode === 'add' || editing) {
    return (
      <>
        <PageHeader title="Profiles" />
        <div className="settings">
          <GrownUpGate what="profile settings">
            <ProfileForm key={mode} profile={editing} others={profiles.filter((p) => p.id !== editing?.id)} onDone={() => setMode('manage')} />
            {editing && <ProfileLockForm profile={editing} />}
            {editing && <ScreenTimeForm key={editing.id} profile={editing} />}
          </GrownUpGate>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Profiles" />
      <section className="profiles" aria-labelledby="profiles-heading">
        <h2 id="profiles-heading">{managing ? 'Manage profiles' : 'Who’s watching?'}</h2>
        <ul className="profile-grid">
          {profiles.map((p) => (
            <li key={p.id}>
              <button type="button" className="profile-tile" onClick={() => pick(p)}
                aria-label={`${managing ? `Edit ${p.name}` : p.name}${p.locked ? ' (locked)' : ''}`}>
                <ProfileAvatar profile={p} large />
                <span className="profile-name">{p.locked && <Icon name="lock" />}{p.name}</span>
                {p.maturity === 'kids' && <span className="profile-badge">Kids</span>}
              </button>
            </li>
          ))}
          {profiles.length < MAX_PROFILES && (
            <li>
              <button type="button" className="profile-tile add" onClick={() => setMode('add')}>
                <span className="profile-add" aria-hidden="true">+</span>
                <span className="profile-name">Add profile</span>
              </button>
            </li>
          )}
        </ul>
        <button type="button" className="ghost-cta profiles-manage" onClick={() => setMode(managing ? 'choose' : 'manage')}>
          {managing ? 'Done' : 'Manage profiles'}
        </button>
      </section>
    </>
  )
}

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Field } from '../components/Field.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import { MAX_PROFILES, MAX_PROFILE_NAME, avatarColors, maturityChoices, profileNameProblem } from '../data/profiles.js'
import { useAuth } from '../state/authContext.js'
import { useProfile } from '../state/profileContext.js'
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
        onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <fieldset className="avatar-choices">
        <legend>Avatar colour</legend>
        {avatarColors.map((a) => (
          <label key={a.key} className="avatar-choice">
            <input type="radio" name="avatar" value={a.key} checked={form.avatar === a.key} onChange={() => setForm({ ...form, avatar: a.key })} />
            <ProfileAvatar profile={{ avatar: a.key }} /><span>{a.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="select-row">
        <span className="switch-label">Maturity rating</span>
        <select value={form.maturity} onChange={(e) => setForm({ ...form, maturity: e.target.value })}>
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

// "Who's watching?": pick a profile, or manage them (add, rename, recolour, change the maturity rating, delete)
export function Profiles() {
  const { profiles, chooseProfile } = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('choose') // 'choose' | 'manage' | 'add' | a profile id being edited
  const editing = profiles.find((p) => p.id === mode)

  const watch = (id) => {
    chooseProfile(id)
    const from = location.state?.from
    navigate(from && from.pathname !== '/profiles' ? `${from.pathname}${from.search ?? ''}` : '/', { replace: true })
  }

  if (mode === 'add' || editing) {
    return (
      <>
        <PageHeader title="Profiles" />
        <div className="settings">
          <ProfileForm key={mode} profile={editing} others={profiles.filter((p) => p.id !== editing?.id)} onDone={() => setMode('manage')} />
        </div>
      </>
    )
  }

  const managing = mode === 'manage'
  return (
    <>
      <PageHeader title="Profiles" />
      <section className="profiles" aria-labelledby="profiles-heading">
        <h2 id="profiles-heading">{managing ? 'Manage profiles' : 'Who’s watching?'}</h2>
        <ul className="profile-grid">
          {profiles.map((p) => (
            <li key={p.id}>
              <button type="button" className="profile-tile" onClick={() => (managing ? setMode(p.id) : watch(p.id))}
                aria-label={managing ? `Edit ${p.name}` : p.name}>
                <ProfileAvatar profile={p} large />
                <span className="profile-name">{p.name}</span>
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

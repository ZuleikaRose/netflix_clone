import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLibrary } from '../../state/libraryContext.js'
import { useCatalog } from '../../state/useCatalog.js'
import { focusFirstError } from '../formUtils.js'

const types = ['Playback problem', 'Video or audio quality', 'Captions or accessibility', 'App bug', 'Account or sign-in', 'Billing', 'Data removal request', 'Other']
// Links can preselect a type, e.g. /info/report-issue?type=data-removal from Delete account
const typeParams = { 'data-removal': 'Data removal request', accessibility: 'Captions or accessibility' }

// Attached automatically so support can reproduce the problem
const deviceSummary = () => `${navigator.userAgentData?.platform || navigator.platform || 'Unknown OS'} · ${window.innerWidth}×${window.innerHeight} · ${navigator.onLine ? 'online' : 'offline'}`

const blank = { type: types[0], titleId: '', summary: '', steps: '' }

export function ReportIssue() {
  const { issues, addIssue } = useLibrary()
  const { all: catalog, findTitle } = useCatalog()
  const [params] = useSearchParams()
  const [form, setForm] = useState(() => ({ ...blank, type: typeParams[params.get('type')] ?? blank.type }))
  const [errors, setErrors] = useState({})
  const [justFiled, setJustFiled] = useState(null)
  const updateField = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (form.summary.trim().length < 5) next.summary = 'Please describe the issue in a few words.'
    setErrors(next)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    const ticket = { ...form, id: `NF-${48210 + issues.length}`, device: deviceSummary(), status: 'Open' }
    addIssue(ticket)
    setJustFiled(ticket.id)
    setForm(blank)
  }

  return (
    <div className="settings">
      {justFiled && <p className="form-success" role="status"><span aria-hidden="true">✓</span> Report <b>{justFiled}</b> received. We’ll follow up by email.</p>}

      <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="report-heading">
        <h2 id="report-heading">Report an issue</h2>

        <label className="select-row">
          <span className="switch-label">Type of issue</span>
          <select value={form.type} onChange={updateField('type')}>{types.map((t) => <option key={t}>{t}</option>)}</select>
        </label>

        <label className="select-row">
          <span className="switch-label">Related title (optional)</span>
          <select value={form.titleId} onChange={updateField('titleId')}>
            <option value="">None</option>
            {catalog.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>

        <div className={errors.summary ? 'field has-error' : 'field'}>
          <label htmlFor="issue-summary">What went wrong?</label>
          <input id="issue-summary" value={form.summary} onChange={updateField('summary')} aria-invalid={Boolean(errors.summary)} aria-describedby={errors.summary ? 'summary-error' : undefined} placeholder="e.g. Video freezes after 10 minutes" />
          {errors.summary && <p id="summary-error" className="field-error"><span aria-hidden="true">⚠</span> {errors.summary}</p>}
        </div>

        <div className="field">
          <label htmlFor="issue-steps">Steps to reproduce (optional)</label>
          <textarea id="issue-steps" rows="4" value={form.steps} onChange={updateField('steps')} placeholder={'1. Open a title\n2. Press Play\n3. …'} />
        </div>

        <p className="muted">Device info is attached automatically: {deviceSummary()}</p>
        <button type="submit" className="cta">Submit report</button>
      </form>

      {issues.length > 0 && (
        <section className="settings-card" aria-labelledby="my-reports">
          <h2 id="my-reports">Your reports</h2>
          <ul className="ticket-list">
            {issues.map((t) => (
              <li key={t.id}>
                <p><b>{t.id}</b> <span className="ticket-status">{t.status}</span></p>
                <p>{t.summary}</p>
                <p className="muted">{t.type}{t.titleId && ` · ${findTitle(t.titleId)?.title}`}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

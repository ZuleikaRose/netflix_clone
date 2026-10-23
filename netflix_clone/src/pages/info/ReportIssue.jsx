import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TicketConversation } from '../../components/TicketConversation.jsx'
import { useAuth } from '../../state/authContext.js'
import { useLibrary } from '../../state/libraryContext.js'
import { useCatalog } from '../../state/useCatalog.js'
import { useT } from '../../state/useT.js'
import { focusFirstError } from '../formUtils.js'

const types = ['Playback problem', 'Video or audio quality', 'Captions or accessibility', 'App bug', 'Account or sign-in', 'Billing', 'Data removal request', 'Other']
// Links can preselect a type, e.g. /info/report-issue?type=data-removal from Delete account
const typeParams = { 'data-removal': 'Data removal request', accessibility: 'Captions or accessibility' }

// Attached automatically so support can reproduce the problem
const deviceSummary = () => `${navigator.userAgentData?.platform || navigator.platform || 'Unknown OS'} · ${window.innerWidth}×${window.innerHeight} · ${navigator.onLine ? 'online' : 'offline'}`

const blank = { type: types[0], titleId: '', summary: '', steps: '' }
const stepsPlaceholder = '1. Open a title\n2. Press Play\n3. …'

export function ReportIssue() {
  const t = useT()
  const { issues, addIssue, replyToIssue } = useLibrary()
  const { user } = useAuth()
  const { all: catalog, findTitle } = useCatalog()
  const [params] = useSearchParams()
  const [form, setForm] = useState(() => ({ ...blank, type: typeParams[params.get('type')] ?? blank.type }))
  const [errors, setErrors] = useState({}) // English messages, shown in the interface language
  const [justFiled, setJustFiled] = useState(null)
  const updateField = (key) => (e) => { const { value } = e.target; setForm((f) => ({ ...f, [key]: value })) }

  // The ticket number sits inside the sentence, in bold
  const [filedBefore, filedAfter] = t('Report {ticket} received. We’ll follow up by email.').split('{ticket}')

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (form.summary.trim().length < 5) next.summary = 'Please describe the issue in a few words.'
    setErrors(next)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    try {
      // The ticket number comes back from the library (the database numbers it when Supabase is connected)
      const filed = await addIssue({ ...form, device: deviceSummary(), status: 'Open' })
      setJustFiled(filed.id)
      setForm(blank)
    } catch {
      setErrors({ summary: 'Your report couldn’t be sent. Please try again.' })
    }
  }

  return (
    <div className="settings">
      {justFiled && <p className="form-success" role="status"><span aria-hidden="true">✓</span> {filedBefore}<b>{justFiled}</b>{filedAfter}</p>}

      <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="report-heading">
        <h2 id="report-heading">{t('Report an issue')}</h2>

        <label className="select-row">
          <span className="switch-label">{t('Type of issue')}</span>
          <select value={form.type} onChange={updateField('type')}>{types.map((type) => <option key={type} value={type}>{t(type)}</option>)}</select>
        </label>

        <label className="select-row">
          <span className="switch-label">{t('Related title (optional)')}</span>
          <select value={form.titleId} onChange={updateField('titleId')}>
            <option value="">{t('None')}</option>
            {catalog.map((title) => <option key={title.id} value={title.id}>{title.title}</option>)}
          </select>
        </label>

        <div className={errors.summary ? 'field has-error' : 'field'}>
          <label htmlFor="issue-summary">{t('What went wrong?')}</label>
          <input id="issue-summary" value={form.summary} onChange={updateField('summary')} aria-invalid={Boolean(errors.summary)} aria-describedby={errors.summary ? 'summary-error' : undefined} placeholder={t('e.g. Video freezes after 10 minutes')} />
          {errors.summary && <p id="summary-error" className="field-error"><span aria-hidden="true">⚠</span> {t(errors.summary)}</p>}
        </div>

        <div className="field">
          <label htmlFor="issue-steps">{t('Steps to reproduce (optional)')}</label>
          <textarea id="issue-steps" rows="4" value={form.steps} onChange={updateField('steps')} placeholder={t(stepsPlaceholder)} />
        </div>

        <p className="muted">{t('Device info is attached automatically: {device}', { device: deviceSummary() })}</p>
        <button type="submit" className="cta">{t('Submit report')}</button>
      </form>

      {issues.length > 0 && (
        <section className="settings-card" aria-labelledby="my-reports">
          <h2 id="my-reports">{t('Your reports')}</h2>
          <ul className="ticket-list">
            {issues.map((issue) => (
              <li key={issue.id}>
                <p><b>{issue.id}</b> <span className="ticket-status">{t(issue.status)}</span></p>
                <p>{issue.summary}</p>
                <p className="muted">{t(issue.type)}{issue.titleId && ` · ${findTitle(issue.titleId)?.title}`}</p>
                <TicketConversation ticketNumber={issue.id} replies={issue.replies ?? []} label={t('Add to {ticket}', { ticket: issue.id })}
                  send={(body) => replyToIssue(issue.ticketId, body, { author: user.name })} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

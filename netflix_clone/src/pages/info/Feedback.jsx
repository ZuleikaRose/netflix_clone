import { useState } from 'react'
import { useLibrary } from '../../state/libraryContext.js'
import { useT } from '../../state/useT.js'
import { focusFirstError } from '../formUtils.js'

const scores = [
  { value: 1, label: 'Very poor', face: '😞' },
  { value: 2, label: 'Poor', face: '🙁' },
  { value: 3, label: 'Okay', face: '😐' },
  { value: 4, label: 'Good', face: '🙂' },
  { value: 5, label: 'Excellent', face: '😍' },
]
const areas = ['Browsing & search', 'Title pages', 'Playback', 'My List & Favorites', 'Account & billing', 'Something else']
const blank = { score: 0, area: areas[0], message: '' }

export function Feedback() {
  const t = useT()
  const { feedback, addFeedback } = useLibrary()
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({}) // English messages, shown in the interface language
  const [sent, setSent] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!form.score) next.score = 'Please choose a rating.'
    if (form.message.trim().length < 10) next.message = 'Please write at least 10 characters.'
    setErrors(next)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    addFeedback({ ...form, message: form.message.trim(), at: new Date() })
    setForm(blank)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="settings">
        <section className="settings-card thanks" role="status">
          <p className="big-check" aria-hidden="true">✓</p>
          <h2>{t('Thanks for the feedback!')}</h2>
          <p className="muted">
            {feedback.length === 1
              ? t('Our team reads every message. You’ve shared feedback {count} time this session.', { count: feedback.length })
              : t('Our team reads every message. You’ve shared feedback {count} times this session.', { count: feedback.length })}
          </p>
          <button type="button" className="ghost-cta" onClick={() => setSent(false)}>{t('Send more feedback')}</button>
        </section>
      </div>
    )
  }

  return (
    <div className="settings">
      <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="feedback-heading">
        <h2 id="feedback-heading">{t('How’s your experience?')}</h2>

        <fieldset className="score-picker" aria-describedby={errors.score ? 'score-error' : undefined}>
          <legend>{t('Overall rating')}</legend>
          <div className="score-row">
            {scores.map((s) => (
              <label key={s.value} className={form.score === s.value ? 'score on' : 'score'}>
                <input type="radio" name="score" value={s.value} checked={form.score === s.value} aria-invalid={Boolean(errors.score)} onChange={() => setForm((f) => ({ ...f, score: s.value }))} />
                <span aria-hidden="true">{s.face}</span><span className="sr-only">{t(s.label)}</span>
              </label>
            ))}
          </div>
          {errors.score && <p id="score-error" className="field-error"><span aria-hidden="true">⚠</span> {t(errors.score)}</p>}
        </fieldset>

        <label className="select-row">
          <span className="switch-label">{t('What’s it about?')}</span>
          <select value={form.area} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, area: value })) }}>
            {areas.map((a) => <option key={a} value={a}>{t(a)}</option>)}
          </select>
        </label>

        <div className={errors.message ? 'field has-error' : 'field'}>
          <label htmlFor="feedback-message">{t('Your feedback')}</label>
          <textarea id="feedback-message" rows="5" value={form.message} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'message-error' : undefined} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, message: value })) }} placeholder={t('What did you like? What should we improve?')} />
          {errors.message && <p id="message-error" className="field-error"><span aria-hidden="true">⚠</span> {t(errors.message)}</p>}
        </div>

        <button type="submit" className="cta">{t('Send feedback')}</button>
      </form>
    </div>
  )
}

import { useState } from 'react'
import { useLibrary } from '../../state/libraryContext.js'
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
  const { feedback, addFeedback } = useLibrary()
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
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
          <h2>Thanks for the feedback!</h2>
          <p className="muted">Our team reads every message. You’ve shared feedback {feedback.length} time{feedback.length === 1 ? '' : 's'} this session.</p>
          <button type="button" className="ghost-cta" onClick={() => setSent(false)}>Send more feedback</button>
        </section>
      </div>
    )
  }

  return (
    <div className="settings">
      <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="feedback-heading">
        <h2 id="feedback-heading">How’s your experience?</h2>

        <fieldset className="score-picker" aria-describedby={errors.score ? 'score-error' : undefined}>
          <legend>Overall rating</legend>
          <div className="score-row">
            {scores.map((s) => (
              <label key={s.value} className={form.score === s.value ? 'score on' : 'score'}>
                <input type="radio" name="score" value={s.value} checked={form.score === s.value} aria-invalid={Boolean(errors.score)} onChange={() => setForm({ ...form, score: s.value })} />
                <span aria-hidden="true">{s.face}</span><span className="sr-only">{s.label}</span>
              </label>
            ))}
          </div>
          {errors.score && <p id="score-error" className="field-error"><span aria-hidden="true">⚠</span> {errors.score}</p>}
        </fieldset>

        <label className="select-row">
          <span className="switch-label">What’s it about?</span>
          <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>

        <div className={errors.message ? 'field has-error' : 'field'}>
          <label htmlFor="feedback-message">Your feedback</label>
          <textarea id="feedback-message" rows="5" value={form.message} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'message-error' : undefined} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="What did you like? What should we improve?" />
          {errors.message && <p id="message-error" className="field-error"><span aria-hidden="true">⚠</span> {errors.message}</p>}
        </div>

        <button type="submit" className="cta">Send feedback</button>
      </form>
    </div>
  )
}

import { useId, useState } from 'react'
import { helpfulLabel, reviewOrders, sortReviews } from '../data/helpfulVotes.js'
import { MAX_REPORT_DETAILS, reportReasons } from '../data/reviewReports.js'
import { useAuth } from '../state/authContext.js'
import { useLibrary } from '../state/libraryContext.js'
import { useReviews } from '../state/useReviews.js'

function StarRating({ value, onChange, label }) {
  return (
    <fieldset className="stars">
      <legend>{label}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= value ? 'star on' : 'star'}>
          <input type="radio" name={label} value={n} checked={value === n} onChange={() => onChange(n)} />
          <span aria-hidden="true">★</span><span className="sr-only">{n} star{n > 1 ? 's' : ''}</span>
        </label>
      ))}
    </fieldset>
  )
}

// "Report" under another member's review: a reason and optional details go to support staff (data/reviewReports.js)
function ReportReview({ review, report }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (review.reported) return <p className="muted review-reported" role="status">Reported. Our support team will take a look.</p>
  if (!open) {
    return <button type="button" className="text-button" onClick={() => setOpen(true)} aria-label={`Report ${review.author}’s review`}>Report</button>
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!reason) return setError('Choose a reason.')
    setBusy(true)
    const problem = await report(review, reason, details.trim())
    setBusy(false)
    setError(problem)
  }

  return (
    <form className="report-form" onSubmit={submit} noValidate aria-label={`Report ${review.author}’s review`}>
      <fieldset className="choice-group">
        <legend>What’s wrong with this review?</legend>
        <div className="choice-options">
          {reportReasons.map((r) => (
            <label key={r.value} className="choice">
              <input type="radio" name={`${id}-reason`} value={r.value} checked={reason === r.value}
                onChange={() => { setReason(r.value); setError(null) }} />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${id}-details`}>Anything else? (optional)</label>
      <textarea id={`${id}-details`} rows="2" maxLength={MAX_REPORT_DETAILS} value={details} onChange={(e) => setDetails(e.target.value)} />
      {error && <p className="form-alert" role="alert">{error}</p>}
      <div className="report-actions">
        <button type="submit" className="cta" disabled={busy}>Send report</button>
        <button type="button" className="ghost-cta" onClick={() => { setOpen(false); setError(null) }}>Cancel</button>
      </div>
    </form>
  )
}

// "Helpful" under another member's review: a toggle (pressed once voted) with the count; your own review shows the count
function HelpfulVote({ review, toggleHelpful }) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  if (review.mine) return review.helpful > 0 ? <p className="muted review-helpful-count">{helpfulLabel(review.helpful)}</p> : null

  const vote = async () => {
    setBusy(true)
    setError(await toggleHelpful(review))
    setBusy(false)
  }
  return (
    <>
      <button type="button" className="text-button helpful-button" aria-pressed={review.votedHelpful} disabled={busy} onClick={vote}
        aria-label={`Helpful: ${review.author}’s review, ${helpfulLabel(review.helpful)}`}>
        <span aria-hidden="true">👍</span> Helpful{review.helpful > 0 && <span aria-hidden="true"> ({review.helpful})</span>}
      </button>
      {error && <p className="form-alert" role="alert">{error}</p>}
    </>
  )
}

// Ratings & Reviews for a catalog or TMDB title. `beforeSave` (optional) runs before the first rating or review is
// saved and resolves to false when the title can't be stored (a TMDB title must be a `titles` row first).
export function Reviews({ title, beforeSave }) {
  const { ratings, rate } = useLibrary()
  const { user } = useAuth()
  const { reviews, addReview, report, toggleHelpful } = useReviews(title)
  const [order, setOrder] = useState('helpful')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const myRating = ratings[title.id] ?? 0
  const notSaved = 'Couldn’t save this title. Please try again.'

  const changeRating = async (stars) => {
    setError(null)
    if (beforeSave && !(await beforeSave())) return setError(notSaved)
    rate(title.id, stars)
  }
  const submitReview = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    if (beforeSave && !(await beforeSave())) return setError(notSaved)
    const problem = await addReview({ author: user.name, stars: myRating || null, text: draft.trim() })
    setError(problem ?? null)
    if (!problem) setDraft('')
  }

  return (
    <section className="reviews" aria-labelledby="reviews-heading">
      <h3 id="reviews-heading">Ratings &amp; Reviews</h3>
      <StarRating label="Your rating" value={myRating} onChange={changeRating} />
      <form className="review-form" onSubmit={submitReview}>
        <label htmlFor="review">Write a review</label>
        <textarea id="review" rows="3" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What did you think?" />
        <button type="submit" className="play wide" disabled={!draft.trim()}>Post review</button>
        {error && <p className="form-alert" role="alert">{error}</p>}
      </form>
      {reviews.length === 0
        ? <p className="muted">No reviews yet — be the first.</p>
        : (
          <>
            {reviews.length > 1 && (
              <div className="field review-sort">
                <label htmlFor="review-order">Sort reviews</label>
                <select id="review-order" value={order} onChange={(e) => { const { value } = e.target; setOrder(value) }}>
                  {reviewOrders.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            <ul className="review-list">
              {sortReviews(reviews, order).map((r) => (
                <li key={r.id}>
                  <p><b>{r.author}</b>{r.stars && <span className="review-stars" aria-label={`${r.stars} out of 5 stars`}>{'★'.repeat(r.stars)}</span>}</p>
                  <p>{r.text}</p>
                  <div className="review-actions">
                    <HelpfulVote review={r} toggleHelpful={toggleHelpful} />
                    {!r.mine && <ReportReview review={r} report={report} />}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
    </section>
  )
}

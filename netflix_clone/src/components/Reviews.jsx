import { useState } from 'react'
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

// Ratings & Reviews for a catalog or TMDB title. `beforeSave` (optional) runs before the first rating or review is
// saved and resolves to false when the title can't be stored (a TMDB title must be a `titles` row first).
export function Reviews({ title, beforeSave }) {
  const { ratings, rate } = useLibrary()
  const { user } = useAuth()
  const { reviews, addReview } = useReviews(title)
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
          <ul className="review-list">
            {reviews.map((r, i) => (
              <li key={`${r.author}-${i}`}>
                <p><b>{r.author}</b>{r.stars && <span className="review-stars" aria-label={`${r.stars} out of 5 stars`}>{'★'.repeat(r.stars)}</span>}</p>
                <p>{r.text}</p>
              </li>
            ))}
          </ul>
        )}
    </section>
  )
}

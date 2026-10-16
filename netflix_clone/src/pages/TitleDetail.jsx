import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { Player } from '../components/Player.jsx'
import { Preview } from '../components/Preview.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { ShareButton } from '../components/ShareButton.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { describeLength, findTitle } from '../data/catalog.js'
import { useCatalog } from '../state/useCatalog.js'
import { useAuth } from '../state/authContext.js'
import { useLibrary } from '../state/libraryContext.js'
import { NotFound } from './NotFound.jsx'

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

export function TitleDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { myList, favorites, ratings, reviews, toggleMyList, toggleFavorite, rate, addReview } = useLibrary()
  const { user } = useAuth()
  const [draft, setDraft] = useState('')
  const { titles: catalog, isAllowed } = useCatalog()

  const title = findTitle(id)
  // Runs after PageHeader's effect (parents run last), so the tab shows the show's name, not "TV Show"
  useDocumentTitle(title?.title)
  if (!title) return <NotFound />
  if (!isAllowed(title)) {
    return (
      <>
        <PageHeader title="Restricted" back />
        <div className="empty">
          <p>{title.title} is rated {title.maturity}, which is above this profile’s maturity setting.</p>
          <Link to="/account" className="play wide">Change in Account</Link>
        </div>
      </>
    )
  }

  const playing = params.get('play') === '1'
  const saved = myList.includes(id)
  const favorite = favorites.includes(id)
  const myRating = ratings[id] ?? 0
  const allReviews = [...(reviews[id] ?? []), ...title.reviews]
  const related = catalog.filter((t) => t.id !== id && t.genres.some((g) => title.genres.includes(g)))

  const submitReview = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    addReview(id, { author: user.name, stars: myRating || null, text: draft.trim() })
    setDraft('')
  }

  return (
    <>
      <PageHeader title={title.type === 'show' ? 'TV Show' : 'Movie'} back />

      {playing
        ? <Player title={title} onClose={() => setParams({}, { replace: true })} />
        : (
          <div className="detail-art">
            <Preview title={title} />
            <div className="hero-shade" />
          </div>
        )}

      <div className="detail-body">
        <p className="eyebrow"><b>N</b> {title.type === 'show' ? 'SERIES' : 'FILM'}</p>
        <h2 className="detail-title">{title.title.toUpperCase()}</h2>
        <p className="detail-meta">
          <span>{title.year}</span><span className="maturity">{title.maturity}</span><span>{describeLength(title)}</span>
        </p>

        <div className="detail-actions">
          <button className="play wide" onClick={() => setParams({ play: '1' }, { replace: true })}><span aria-hidden="true">▶</span> {title.progress ? 'Resume' : 'Play'}</button>
          <div className="action-row">
            <button className={saved ? 'ghost-action on' : 'ghost-action'} aria-pressed={saved} onClick={() => toggleMyList(id)}>
              <Icon name={saved ? 'check' : 'plus'} /><span>My List</span>
            </button>
            <button className={favorite ? 'ghost-action on' : 'ghost-action'} aria-pressed={favorite} onClick={() => toggleFavorite(id)}>
              <Icon name="heart" filled={favorite} /><span>Favorite</span>
            </button>
            <ShareButton title={title} />
          </div>
        </div>

        <p className="synopsis">{title.synopsis}</p>
        <p className="credits"><span>Starring:</span> {title.cast.join(', ')}</p>
        <p className="credits"><span>Director:</span> {title.crew.director} · <span>Writer:</span> {title.crew.writer}</p>
        <p className="credits"><span>Genres:</span> {title.genres.join(', ')}</p>

        <section className="reviews" aria-labelledby="reviews-heading">
          <h3 id="reviews-heading">Ratings &amp; Reviews</h3>
          <StarRating label="Your rating" value={myRating} onChange={(n) => rate(id, n)} />
          <form className="review-form" onSubmit={submitReview}>
            <label htmlFor="review">Write a review</label>
            <textarea id="review" rows="3" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What did you think?" />
            <button type="submit" className="play wide" disabled={!draft.trim()}>Post review</button>
          </form>
          {allReviews.length === 0
            ? <p className="muted">No reviews yet — be the first.</p>
            : (
              <ul className="review-list">
                {allReviews.map((r, i) => (
                  <li key={`${r.author}-${i}`}>
                    <p><b>{r.author}</b>{r.stars && <span className="review-stars" aria-label={`${r.stars} out of 5 stars`}>{'★'.repeat(r.stars)}</span>}</p>
                    <p>{r.text}</p>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>

      {related.length > 0 && (
        <section className="row-section">
          <div className="section-heading"><h2>More Like This</h2></div>
          <div className="rail">{related.map((t) => <PosterCard key={t.id} title={t} />)}</div>
        </section>
      )}
    </>
  )
}

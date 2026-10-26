import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { TmdbCredit } from '../components/TmdbCredit.jsx'
import { describeLength } from '../data/catalog.js'
import { formatReleaseDay } from '../data/notifications.js'
import { useCatalog } from '../state/useCatalog.js'
import { useReminder } from '../state/useReminder.js'
import { useTmdbLists } from '../state/useTmdb.js'
import { useT } from '../state/useT.js'

function RemindButton({ title, reminder, day }) {
  const t = useT()
  const on = reminder.isSet(title)
  return (
    <button className={on ? 'ghost-action on' : 'ghost-action'} aria-pressed={on} aria-label={t('Remind me about {title}', { title: title.title })}
      onClick={() => reminder.toggle(title, day)}>
      <Icon name={on ? 'check' : 'bell'} /><span>{on ? t('Reminder set') : t('Remind Me')}</span>
    </button>
  )
}

function FeedItem({ title, meta, children }) {
  const t = useT()
  return (
    <li className="feed-item">
      <Link to={title.path ?? `/title/${title.id}`} className="feed-art">
        {title.source === 'tmdb'
          ? <img src={title.backdrop ?? title.image} alt="" loading="lazy" />
          : <img src={title.image} alt="" style={{ filter: title.tint }} />}
        <span className="sr-only">{title.title}</span>
      </Link>
      <div className="feed-copy">
        <div className="feed-head">
          <h3>{title.title}</h3>
          {children}
        </div>
        {meta}
        <p className="muted">{t(title.synopsis)}</p>
      </div>
    </li>
  )
}

// New & Hot: movies coming soon (from TMDB, with reminders that the bell announces on release day) and what's new here
export function NewHot() {
  const t = useT()
  const { titles: catalog, isAllowed } = useCatalog()
  const reminder = useReminder()
  const comingSoon = (useTmdbLists()?.upcomingMovies ?? []).filter(isAllowed)
  const fresh = catalog.filter((t) => t.isNew).sort((a, b) => b.popularity - a.popularity)

  return (
    <>
      <PageHeader title={t('New & Hot')} />
      {reminder.error && <p className="form-alert page-alert" role="alert">{reminder.error}</p>}
      {comingSoon.length > 0 && (
        <section aria-labelledby="coming-soon-heading">
          <div className="section-heading"><h2 id="coming-soon-heading">{t('Coming Soon')}</h2></div>
          <ul className="feed">
            {comingSoon.map((item) => (
              <FeedItem key={item.id} title={item} meta={<p className="detail-meta"><span>{t('Coming {date}', { date: formatReleaseDay(item.releaseDate) })}</span><span className="maturity">{item.maturity}</span></p>}>
                <RemindButton title={item} reminder={reminder} day={item.releaseDate} />
              </FeedItem>
            ))}
          </ul>
          <TmdbCredit />
        </section>
      )}
      <section aria-labelledby="new-here-heading">
        <div className="section-heading"><h2 id="new-here-heading">{t('New on Netflix Clone')}</h2></div>
        <ul className="feed">
          {fresh.map((t) => (
            <FeedItem key={t.id} title={t} meta={<p className="detail-meta"><span>{t.year}</span><span className="maturity">{t.maturity}</span><span>{describeLength(t)}</span></p>}>
              <RemindButton title={t} reminder={reminder} />
            </FeedItem>
          ))}
        </ul>
      </section>
    </>
  )
}

import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { describeLength } from '../data/catalog.js'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'

export function NewHot() {
  const { reminders, toggleReminder } = useLibrary()
  const { titles: catalog } = useCatalog()
  const fresh = catalog.filter((t) => t.isNew).sort((a, b) => b.popularity - a.popularity)

  return (
    <>
      <PageHeader title="New & Hot" />
      <ul className="feed">
        {fresh.map((t) => {
          const on = reminders.includes(t.id)
          return (
            <li key={t.id} className="feed-item">
              <Link to={`/title/${t.id}`} className="feed-art">
                <img src={t.image} alt="" style={{ filter: t.tint }} />
                <span className="sr-only">{t.title}</span>
              </Link>
              <div className="feed-copy">
                <div className="feed-head">
                  <h2>{t.title}</h2>
                  <button className={on ? 'ghost-action on' : 'ghost-action'} aria-pressed={on} onClick={() => toggleReminder(t.id)}>
                    <Icon name={on ? 'check' : 'bell'} /><span>{on ? 'Reminder set' : 'Remind Me'}</span>
                  </button>
                </div>
                <p className="detail-meta"><span>{t.year}</span><span className="maturity">{t.maturity}</span><span>{describeLength(t)}</span></p>
                <p className="muted">{t.synopsis}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

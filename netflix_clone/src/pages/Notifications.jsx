import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { isUnread } from '../data/notifications.js'
import { useAuth } from '../state/authContext.js'
import { useProfile } from '../state/profileContext.js'
import { useNotifications } from '../state/useNotifications.js'

const when = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const whenExactly = (date) => date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// /notifications: released reminders and replies from support, then the reminders still to come. Opening it marks
// everything as seen (for this profile, on every device); what was new stays marked until the next visit.
export function Notifications() {
  const { recent, upcoming, seenAt } = useNotifications()
  const { profile } = useProfile()
  const { editProfile } = useAuth()
  const [newSince] = useState(seenAt)

  useEffect(() => {
    editProfile(profile.id, { notificationsSeenAt: new Date().toISOString() })
    // Once per visit
  }, [profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Notifications" back />
      <div className="notifications">
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading">Recent</h2>
          {newSince && recent.length > 0 && (
            <p className="muted notifications-since">New since you last checked, <time dateTime={new Date(newSince).toISOString()}>{whenExactly(new Date(newSince))}</time></p>
          )}
          {recent.length === 0
            ? <p className="muted">You’re all caught up. Set reminders on upcoming titles in <Link to="/new" className="inline-link">New &amp; Hot</Link>.</p>
            : (
              <ul className="notification-list">
                {recent.map((n) => {
                  const fresh = isUnread(n, newSince)
                  return (
                    <li key={n.id} className={fresh ? 'notification new' : 'notification'}>
                      <Icon name={n.kind === 'reply' ? 'chat' : 'bell'} />
                      <Link to={n.to} className="notification-link">
                        <span className="notification-text">{fresh && <span className="sr-only">New: </span>}{n.text}</span>
                        {n.detail && <span className="muted notification-detail">{n.detail}</span>}
                        <time className="muted" dateTime={n.at.toISOString()}>{when(n.at)}</time>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
        </section>
        {upcoming.length > 0 && (
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading">Coming up</h2>
            <ul className="notification-list">
              {upcoming.map((n) => (
                <li key={n.id} className="notification">
                  <Icon name="calendar" />
                  <Link to={n.to} className="notification-link"><span className="notification-text">{n.text}</span></Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}

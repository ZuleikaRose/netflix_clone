import { Link } from 'react-router-dom'
import { useNotifications } from '../state/useNotifications.js'
import { Icon } from './Icon.jsx'

// The header's bell: opens Notifications, with a count of new ones (nothing outside a profile's pages)
export function NotificationBell() {
  const notifications = useNotifications()
  if (!notifications) return null
  const { unread } = notifications
  return (
    <Link to="/notifications" className="icon-button bell" aria-label={unread ? `Notifications (${unread} new)` : 'Notifications'}>
      <Icon name="bell" />
      {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  )
}

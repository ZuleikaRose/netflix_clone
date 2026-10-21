import { buildNotifications, isUnread } from '../data/notifications.js'
import { useLibraryIfAny } from './libraryContext.js'
import { useProfile } from './profileContext.js'
import { useCatalog } from './useCatalog.js'

// The watching profile's notifications and how many are new; null outside a profile's pages
export function useNotifications() {
  const library = useLibraryIfAny()
  const { findTitle } = useCatalog()
  const profile = useProfile()?.profile
  if (!library || !profile) return null
  const { recent, upcoming } = buildNotifications({ ...library, findTitle })
  const seenAt = profile.notificationsSeenAt
  return { recent, upcoming, seenAt, unread: recent.filter((n) => isUnread(n, seenAt)).length }
}

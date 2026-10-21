import { useState } from 'react'
import { useLibrary } from './libraryContext.js'
import { useStoreTitle } from './useStoreTitle.js'

// { isSet(title), toggle(title, day), error } for Remind Me buttons. A TMDB title is stored first (reminders point at
// `titles` rows); `day` ('YYYY-MM-DD') is when it, or a show's next episode, comes out.
export function useReminder() {
  const { reminders, toggleReminder } = useLibrary()
  const store = useStoreTitle()
  const [error, setError] = useState(null)
  return {
    error,
    isSet: (title) => reminders.includes(title.id),
    async toggle(title, day) {
      setError(null)
      if (!reminders.includes(title.id) && !(await store(title))) {
        setError(`Couldn’t set a reminder for ${title.title}. Please try again.`)
        return
      }
      toggleReminder(title.id, day)
    },
  }
}

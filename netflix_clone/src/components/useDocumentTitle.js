import { useEffect } from 'react'

// Per-page tab titles help history, bookmarks and screen readers tell routes apart
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · NetBox` : 'NetBox'
  }, [title])
}

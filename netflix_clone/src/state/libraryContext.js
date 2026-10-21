import { createContext, useContext } from 'react'

export const LibraryContext = createContext(null)

// Watched this far (percent), a title counts as finished and leaves Continue Watching
export const FINISHED_PERCENT = 95

export function useLibrary() {
  const library = useContext(LibraryContext)
  if (!library) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return library
}

// The library, or null outside a profile's pages (e.g. Who's watching?), for things shown on every page
export const useLibraryIfAny = () => useContext(LibraryContext)

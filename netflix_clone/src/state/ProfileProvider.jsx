import { useMemo, useState } from 'react'
import { readStored, writeStored } from '../lib/supabaseConfig.js'
import { useAuth } from './authContext.js'
import { ProfileContext } from './profileContext.js'

// Which profile is watching on this device, remembered per account (like Netflix: each device keeps its own choice).
// An account with a single profile uses it without asking.
const STORAGE_KEY = 'netflix-clone-profile'

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const accountKey = user.id ?? user.email
  const [chosen, setChosen] = useState(() => readStored(STORAGE_KEY)?.[accountKey] ?? null)

  const value = useMemo(() => {
    const remember = (id) => {
      setChosen(id)
      writeStored(STORAGE_KEY, { ...(readStored(STORAGE_KEY) ?? {}), [accountKey]: id })
    }
    const profiles = user.profiles
    const profile = profiles.find((p) => p.id === chosen) ?? (profiles.length === 1 ? profiles[0] : null)
    return { profiles, profile, chooseProfile: remember, forgetProfile: () => remember(null) }
  }, [user.profiles, chosen, accountKey])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

import { useMemo, useState } from 'react'
import { readStored, writeStored } from '../lib/supabaseConfig.js'
import { useAuth } from './authContext.js'
import { ProfileContext } from './profileContext.js'

// Which profile is watching on this device, remembered per account (like Netflix: each device keeps its own choice).
// An account with a single profile uses it without asking.
// A locked profile (one with a PIN) opens only once its PIN was entered, until another profile is chosen; it isn't
// remembered, so the next visit asks again. A Kids profile needs a grown-up's account password before account
// settings and profile management (`grownUp`), also only until the profile changes or the page reloads.
const STORAGE_KEY = 'netflix-clone-profile'

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const accountKey = user.id ?? user.email
  const [chosen, setChosen] = useState(() => readStored(STORAGE_KEY)?.[accountKey] ?? null)
  const [unlocked, setUnlocked] = useState(() => new Set())
  const [grownUpFor, setGrownUpFor] = useState(null)

  const value = useMemo(() => {
    // Switching profiles locks the others again and asks a grown-up again
    const remember = (id) => {
      setChosen(id)
      setUnlocked((ids) => new Set([...ids].filter((x) => x === id)))
      setGrownUpFor(null)
      const locked = user.profiles.find((p) => p.id === id)?.locked
      writeStored(STORAGE_KEY, { ...(readStored(STORAGE_KEY) ?? {}), [accountKey]: locked ? null : id })
    }
    const profiles = user.profiles
    const opens = (p) => p && (!p.locked || unlocked.has(p.id))
    const found = profiles.find((p) => p.id === chosen) ?? (profiles.length === 1 ? profiles[0] : null)
    const profile = opens(found) ? found : null
    return {
      profiles,
      profile,
      chooseProfile: remember,
      forgetProfile: () => remember(null),
      // After unlockProfile() accepted the PIN
      markUnlocked: (id) => setUnlocked((ids) => new Set([...ids, id])),
      isUnlocked: (id) => unlocked.has(id),
      // Kids profiles: true once the account password was given for this profile
      grownUp: profile?.maturity !== 'kids' || grownUpFor === profile.id,
      confirmGrownUp: () => setGrownUpFor(profile?.id ?? null),
    }
  }, [user.profiles, chosen, accountKey, unlocked, grownUpFor])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

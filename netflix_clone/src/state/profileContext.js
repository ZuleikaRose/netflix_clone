import { createContext, useContext } from 'react'

export const ProfileContext = createContext(null)

// { profiles, profile (the one watching, or null until chosen), chooseProfile(id), forgetProfile() }, or null outside
// the signed-in part of the app
export const useProfile = () => useContext(ProfileContext)

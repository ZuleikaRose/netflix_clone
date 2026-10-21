import { avatarColor } from '../data/profiles.js'

// The smiling square avatar, in the profile's colour. Decorative: the profile's name is always next to it.
export function ProfileAvatar({ profile, large = false }) {
  return (
    <span className={large ? 'avatar large' : 'avatar'} style={{ background: avatarColor(profile?.avatar) }} aria-hidden="true">
      <span /><span /><i />
    </span>
  )
}

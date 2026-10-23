import { locale, tr } from '../i18n/index.js'

// What the notifications bell shows, worked out from the profile's library: reminders whose title is out, replies
// from support on the member's reports, and (listed but not counted) reminders still to come.
const DAY_MS = 24 * 60 * 60 * 1000
// Released reminders stay in the list this long
const RECENT_DAYS = 30

// Today in the viewer's time zone, as 'YYYY-MM-DD' (reminder dates are days, not moments)
export function localDay(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const startOf = (day) => new Date(`${day}T00:00:00`)
export const formatReleaseDay = (day) => startOf(day).toLocaleDateString(locale(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

// { recent, upcoming }: recent ones newest first ({ id, kind, at, text, detail?, to }), upcoming soonest first
export function buildNotifications({ reminders, reminderDates, findTitle, issues, now = new Date() }) {
  const today = localDay(now)
  const recent = []
  const upcoming = []
  for (const id of reminders) {
    const day = reminderDates[id]
    const title = findTitle(id)
    if (!day || !title) continue
    const item = { id: `release:${id}`, kind: 'release', at: startOf(day), day, to: title.path ?? `/title/${title.id}` }
    if (day > today) upcoming.push({ ...item, text: tr('{title} comes out {date}', { title: title.title, date: formatReleaseDay(day) }) })
    else if (now - item.at <= RECENT_DAYS * DAY_MS) recent.push({ ...item, text: tr('{title} is out now', { title: title.title }) })
  }
  for (const issue of issues) {
    for (const reply of issue.replies ?? []) {
      if (!reply.fromStaff) continue
      recent.push({ id: `reply:${reply.id}`, kind: 'reply', at: reply.at, text: tr('Support replied to {id}', { id: issue.id }), detail: reply.body, to: '/info/report-issue' })
    }
  }
  return {
    recent: recent.sort((a, b) => b.at - a.at),
    upcoming: upcoming.sort((a, b) => a.at - b.at),
  }
}

// Recent notifications the profile hasn't seen (seenAt: when it last opened them; none = all of them)
export const isUnread = (notification, seenAt) => !seenAt || notification.at > new Date(seenAt)

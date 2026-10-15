// Outline §7 "When things break": downtime is announced with a banner on Home and on Customer Support.
// Set `notice` to null when everything is running normally.
export const serviceStatus = {
  operational: true,
  notice: {
    id: 'maint-2026-10-18',
    title: 'Scheduled maintenance',
    message: 'Sunday 2–3 AM PT. Streaming may pause briefly; your list and settings are safe.',
  },
}

// Reported reviews (migration ..._review_reports): members flag another member's review; support staff keep or
// remove it from the support dashboard. With Supabase the database stamps each report with a copy of the review;
// in memory (no other members) the catalog's sample reviews can be reported and the demo account, who is staff,
// settles them, until the page reloads.

export const reportReasons = [
  { value: 'spoilers', label: 'Spoilers' },
  { value: 'offensive', label: 'Offensive or hateful' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'other', label: 'Something else' },
]
export const reasonLabel = (value) => reportReasons.find((r) => r.value === value)?.label ?? value
export const reportStatuses = ['Open', 'Kept', 'Removed']
export const MAX_REPORT_DETAILS = 500

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

export const sendReviewReport = (supabase, reviewId, reason, details) => supabase.from('review_reports')
  .insert({ review_id: reviewId, reason, details: details || null }).then(unwrap)
// Review ids the member has already reported (RLS: only their own reports)
export const fetchMyReportedReviews = (supabase) => supabase.from('review_reports').select('review_id')
  .not('review_id', 'is', null).then(unwrap).then((rows) => new Set(rows.map((r) => r.review_id)))

const toReport = (r) => ({
  id: r.id, reviewId: r.review_id, titleId: r.title_id, author: r.review_author, text: r.review_body, reason: r.reason,
  details: r.details ?? '', status: r.status, at: new Date(r.created_at), reporter: r.reporter_name,
})
export const fetchReviewReports = (supabase, status) => supabase.rpc('staff_review_reports', { p_status: status })
  .then(unwrap).then((rows) => rows.map(toReport))
export const resolveReviewRow = (supabase, reviewId, remove) => supabase
  .rpc('staff_resolve_review', { p_review: reviewId, p_remove: remove }).then(unwrap)

// A database error on reporting, in members' words
export function reportErrorMessage(error) {
  if (error?.code === '23505') return 'You’ve already reported this review.'
  if (error?.code === 'P0001') return error.message
  return 'Your report couldn’t be sent. Please try again.'
}

// In memory: the session's reports and the reviews removed by "staff"
const listeners = new Set()
let memory = { reports: [], removed: new Set() }
export const memoryReviewReports = () => memory
export function subscribeMemoryReports(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const setMemory = (next) => {
  memory = next
  listeners.forEach((listener) => listener())
}
export function addMemoryReport(report) {
  setMemory({ ...memory, reports: [{ ...report, id: `report-${memory.reports.length + 1}`, status: 'Open', at: new Date() }, ...memory.reports] })
}
export function resolveMemoryReview(reviewId, remove) {
  const reports = memory.reports.map((r) => (r.reviewId === reviewId && r.status === 'Open' ? { ...r, status: remove ? 'Removed' : 'Kept' } : r))
  setMemory({ reports, removed: remove ? new Set([...memory.removed, reviewId]) : memory.removed })
}

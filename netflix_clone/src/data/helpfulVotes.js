// "Helpful" votes on reviews (migration ..._helpful_reviews): a member marks another member's review helpful, once;
// tapping again takes the vote back. review.helpful_count is kept by the database. In memory the catalog's sample
// reviews can be voted on until the page reloads.

export const reviewOrders = [
  { value: 'helpful', label: 'Most helpful' },
  { value: 'newest', label: 'Newest' },
]

// Reviews arrive newest first; "Most helpful" keeps that order between reviews with the same count
export const sortReviews = (reviews, order) => (order === 'helpful'
  ? [...reviews].sort((a, b) => b.helpful - a.helpful)
  : reviews)

export const helpfulLabel = (count) => (count === 1 ? '1 person found this helpful' : `${count} people found this helpful`)

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

// Which of these reviews the member has marked helpful (RLS: only their own votes)
export const fetchMyHelpfulVotes = (supabase, reviewIds) => (reviewIds.length
  ? supabase.from('review_helpful_votes').select('review_id').in('review_id', reviewIds).then(unwrap)
    .then((rows) => new Set(rows.map((r) => r.review_id)))
  : Promise.resolve(new Set()))
export const addHelpfulVote = (supabase, reviewId) => supabase.from('review_helpful_votes').insert({ review_id: reviewId }).then(unwrap)
export const removeHelpfulVote = (supabase, reviewId) => supabase.from('review_helpful_votes').delete().eq('review_id', reviewId).then(unwrap)

// A database error on voting, in members' words
export function voteErrorMessage(error) {
  if (error?.code === 'P0001') return error.message
  return 'Your vote couldn’t be saved. Please try again.'
}

// In memory: the session's votes, by review id
const listeners = new Set()
let memoryVotes = new Set()
export const memoryHelpfulVotes = () => memoryVotes
export function subscribeMemoryVotes(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function toggleMemoryVote(reviewId) {
  const next = new Set(memoryVotes)
  if (next.has(reviewId)) next.delete(reviewId)
  else next.add(reviewId)
  memoryVotes = next
  listeners.forEach((listener) => listener())
}

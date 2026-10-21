// Game leaderboards: the top ten of each game among members who chose to show their scores (Account → Privacy, or
// the switch under each game). With Supabase they come from public.game_leaderboard(), which returns first names
// only; in memory these sample players stand in for other members.

export const LEADERBOARD_SIZE = 10

const samplePlayers = {
  memory: [['Jordan', 11], ['Morgan', 14], ['Dana', 19]],
  trivia: [['Priya', 5], ['Riley', 4], ['Chris', 3]],
  timeline: [['Chris', 3], ['Sam', 2]],
  cast: [['Priya', 5], ['Jordan', 3]],
  'higher-lower': [['Dana', 9], ['Sam', 6], ['Riley', 4]],
  scramble: [['Jordan', 5], ['Chris', 4]],
}

// [{ place, player, score, isMe }] best first; better: 'low' (fewest moves) or 'high' (most points). Ties keep the
// earlier entry first, as the database does (whoever got there first).
export function rankScores(entries, better) {
  return [...entries]
    .sort((a, b) => (better === 'low' ? a.score - b.score : b.score - a.score))
    .slice(0, LEADERBOARD_SIZE)
    .map((entry, i) => ({ ...entry, place: i + 1 }))
}

// The in-memory leaderboard: the sample players, plus the user's own best when they've opted in
export function sampleLeaderboard(game, better, me) {
  const others = (samplePlayers[game] ?? []).map(([player, score]) => ({ player, score, isMe: false }))
  return rankScores(me ? [...others, { ...me, isMe: true }] : others, better)
}

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

export const fetchLeaderboard = (supabase, game) => supabase.rpc('game_leaderboard', { p_game: game }).then(unwrap)
  .then((rows) => rows.map((r) => ({ place: r.place, player: r.player, score: r.best_score, isMe: r.is_me })))

// A signed-in user's library in Supabase, in the shapes LibraryProvider keeps in state. RLS limits every query to the
// user's own rows; user_id is still sent because PostgREST needs a filter on UPDATE and DELETE. Watch list, favorites,
// reminders, watch progress and game scores belong to one profile (`profileId`); ratings, reports and the rest are
// the account's.

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

// Custom lists with their titles, oldest first
const listColumns = 'id, name, description, is_public, share_slug, custom_list_items(title_id, added_at)'
const toList = (r) => ({
  id: r.id, name: r.name, description: r.description ?? '', isPublic: r.is_public, slug: r.share_slug,
  titleIds: [...r.custom_list_items].sort((a, b) => a.added_at.localeCompare(b.added_at)).map((i) => i.title_id),
})
const toListRow = (p) => Object.fromEntries(Object.entries({
  name: p.name?.trim(), description: p.description === undefined ? undefined : p.description.trim() || null, is_public: p.isPublic,
}).filter(([, value]) => value !== undefined))

// Viewing activity shows this many entries, newest first
const HISTORY_LIMIT = 500
export const RECENT_SEARCHES = 10

// A reply on a ticket, oldest first in each conversation
export const toReply = (r) => ({ id: r.id, body: r.body, fromStaff: r.from_staff, author: r.author_name, at: new Date(r.created_at) })
const replyColumns = 'id, body, from_staff, author_name, created_at'
const ticketColumns = `id, ticket_number, issue_type, title_id, summary, steps, device, status, created_at, ticket_replies(${replyColumns})`
const toIssue = (t) => ({
  id: t.ticket_number, ticketId: t.id, type: t.issue_type, titleId: t.title_id ?? '', summary: t.summary, steps: t.steps ?? '',
  device: t.device, status: t.status, at: new Date(t.created_at),
  replies: (t.ticket_replies ?? []).map(toReply).sort((a, b) => a.at - b.at),
})
const toProgress = (r) => ({ percent: r.progress_percent, episode: r.episode, seconds: Number(r.position_seconds) })
const toFeedback = (f) => ({ score: f.score, area: f.area, message: f.message, at: new Date(f.created_at) })

// No hyphen: /signup?ref= keeps letters and digits only
const READABLE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const randomSuffix = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => READABLE[b % READABLE.length]).join('')

export function libraryApi(supabase, userId, profileId) {
  const mine = (table, columns) => supabase.from(table).select(columns).eq('user_id', userId)
  const profiles = (table, columns) => mine(table, columns).eq('profile_id', profileId)

  const countReferrals = (affiliateId, kind) => supabase.from('referrals')
    .select('id', { count: 'exact', head: true }).eq('affiliate_id', affiliateId).eq('kind', kind)
    .then(({ count, error }) => {
      if (error) throw error
      return count ?? 0
    })

  async function loadAffiliate() {
    const row = await supabase.from('affiliates').select('*').eq('user_id', userId).maybeSingle().then(unwrap)
    if (!row) return null
    const [clicks, signups] = await Promise.all([countReferrals(row.id, 'click'), countReferrals(row.id, 'signup')])
    return {
      code: row.referral_code,
      site: row.website_url ?? '',
      audience: row.audience_size,
      channels: row.channels ? row.channels.split(', ') : [],
      payout: row.payout_method,
      clicks,
      signups,
    }
  }

  // Watch list, favorites and reminders are sets of title ids (a reminder also keeps its release date: `extra`)
  const titleSet = (table) => ({
    add: (titleId, extra = {}) => supabase.from(table)
      .upsert({ user_id: userId, profile_id: profileId, title_id: titleId, ...extra }, { onConflict: 'profile_id,title_id', ignoreDuplicates: true }).then(unwrap),
    remove: (titleId) => supabase.from(table).delete().eq('user_id', userId).eq('profile_id', profileId).eq('title_id', titleId).then(unwrap),
  })

  return {
    async load() {
      const [list, favorites, reminders, ratings, feedback, tickets, scores, account, affiliate, progress, lists, searches, reactions] = await Promise.all([
        profiles('watch_list_tables', 'title_id').order('added_at').then(unwrap),
        profiles('favorites', 'title_id').order('added_at').then(unwrap),
        profiles('reminders', 'title_id, release_date').order('created_at').then(unwrap),
        mine('review', 'title_id, rating').is('body', null).not('rating', 'is', null).order('created_at').then(unwrap),
        mine('feedback', 'score, area, message, created_at').order('created_at', { ascending: false }).then(unwrap),
        mine('tickets', ticketColumns).order('created_at', { ascending: false }).then(unwrap),
        profiles('game_scores', 'game, best_score').then(unwrap),
        supabase.from('netflix_tables').select('data_opt_out').eq('id', userId).single().then(unwrap),
        loadAffiliate(),
        profiles('watch_progress', 'title_id, episode, position_seconds, progress_percent').order('updated_at', { ascending: false }).then(unwrap),
        profiles('custom_lists', listColumns).order('created_at').then(unwrap),
        profiles('recent_searches', 'query').order('searched_at', { ascending: false }).limit(RECENT_SEARCHES).then(unwrap),
        profiles('title_reactions', 'title_id, reaction').order('updated_at').then(unwrap),
      ])
      return {
        myList: list.map((r) => r.title_id),
        favorites: favorites.map((r) => r.title_id),
        reminders: reminders.map((r) => r.title_id),
        reminderDates: Object.fromEntries(reminders.filter((r) => r.release_date).map((r) => [r.title_id, r.release_date])),
        ratings: Object.fromEntries(ratings.map((r) => [r.title_id, r.rating])),
        feedback: feedback.map(toFeedback),
        issues: tickets.map(toIssue),
        bestScores: Object.fromEntries(scores.map((s) => [s.game, s.best_score])),
        doNotSell: account.data_opt_out,
        affiliate,
        progress: Object.fromEntries(progress.map((r) => [r.title_id, toProgress(r)])),
        lists: lists.map(toList),
        recentSearches: searches.map((r) => r.query),
        reactions: Object.fromEntries(reactions.map((r) => [r.title_id, r.reaction])),
      }
    },

    myList: titleSet('watch_list_tables'),
    favorites: titleSet('favorites'),
    reminders: titleSet('reminders'),

    // A rating without a review is a review row with no body; keep one per title
    async rate(titleId, stars) {
      const updated = await supabase.from('review').update({ rating: stars })
        .eq('user_id', userId).eq('title_id', titleId).is('body', null).select('id').then(unwrap)
      if (!updated.length) await supabase.from('review').insert({ user_id: userId, title_id: titleId, rating: stars }).then(unwrap)
    },

    // Thumbs ratings: one per profile and title; null removes it
    react: (titleId, reaction) => (reaction
      ? supabase.from('title_reactions').upsert(
        { user_id: userId, profile_id: profileId, title_id: titleId, reaction, updated_at: new Date().toISOString() },
        { onConflict: 'profile_id,title_id' },
      )
      : supabase.from('title_reactions').delete().eq('user_id', userId).eq('profile_id', profileId).eq('title_id', titleId)).then(unwrap),

    addFeedback: (entry) => supabase.from('feedback')
      .insert({ user_id: userId, score: entry.score, area: entry.area, message: entry.message }).then(unwrap),

    // The database numbers the ticket (NF-48400, NF-48401…), so two users never get the same one
    addIssue: (issue) => supabase.from('tickets')
      .insert({ user_id: userId, issue_type: issue.type, title_id: issue.titleId || null, summary: issue.summary, steps: issue.steps || null, device: issue.device, status: issue.status })
      .select(ticketColumns).single().then(unwrap).then(toIssue),

    // The member's own reply on their ticket (staff replies come from the support dashboard)
    replyToIssue: (ticketId, body) => supabase.from('ticket_replies').insert({ ticket_id: ticketId, user_id: userId, body })
      .select(replyColumns).single().then(unwrap).then(toReply),

    setDoNotSell: (value) => supabase.from('netflix_tables').update({ data_opt_out: value }).eq('id', userId).then(unwrap),

    saveScore: (game, value) => supabase.from('game_scores')
      .upsert({ user_id: userId, profile_id: profileId, game, best_score: value, updated_at: new Date().toISOString() }, { onConflict: 'profile_id,game' }).then(unwrap),

    // Where the member stopped in a title ({ percent, episode, seconds }); one row per title
    saveProgress: (titleId, p) => supabase.from('watch_progress').upsert({
      user_id: userId, profile_id: profileId, title_id: titleId, episode: p.episode, position_seconds: Math.round(p.seconds * 10) / 10,
      progress_percent: p.percent, updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,title_id' }).then(unwrap),
    // Viewing history: one row per title and episode (0 for movies) per day; watched_at moves to the latest viewing
    recordViewing: (entry) => supabase.from('viewing_history').upsert({
      user_id: userId, profile_id: profileId, title_id: entry.titleId, episode: entry.episode, watched_on: entry.day,
      watched_at: entry.at.toISOString(),
    }, { onConflict: 'profile_id,title_id,episode,watched_on' }).then(unwrap),
    loadHistory: () => profiles('viewing_history', 'id, title_id, episode, watched_on, watched_at')
      .order('watched_at', { ascending: false }).limit(HISTORY_LIMIT).then(unwrap)
      .then((rows) => rows.map((r) => ({ id: r.id, titleId: r.title_id, episode: r.episode, day: r.watched_on, at: new Date(r.watched_at) }))),
    // Year in Review: the year's history summed up by public.year_in_review() (shape in data/yearInReview.js)
    loadYear: (year) => supabase.rpc('year_in_review', { p_profile: profileId, p_year: year }).then(unwrap),
    hideFromHistory: (id) => supabase.from('viewing_history').delete().eq('user_id', userId).eq('id', id).then(unwrap),
    clearHistory: () => supabase.from('viewing_history').delete().eq('user_id', userId).eq('profile_id', profileId).then(unwrap),

    // Custom lists (the profile's own; the database makes the share slug)
    createList: (name) => supabase.from('custom_lists').insert({ user_id: userId, profile_id: profileId, name: name.trim() })
      .select(listColumns).single().then(unwrap).then(toList),
    updateList: (id, patch) => supabase.from('custom_lists').update(toListRow(patch)).eq('user_id', userId).eq('id', id).then(unwrap),
    deleteList: (id) => supabase.from('custom_lists').delete().eq('user_id', userId).eq('id', id).then(unwrap),
    addToList: (listId, titleId) => supabase.from('custom_list_items')
      .upsert({ list_id: listId, title_id: titleId, user_id: userId }, { onConflict: 'list_id,title_id', ignoreDuplicates: true }).then(unwrap),
    removeFromList: (listId, titleId) => supabase.from('custom_list_items').delete()
      .eq('user_id', userId).eq('list_id', listId).eq('title_id', titleId).then(unwrap),

    // Recent searches: the same words (any case) move to the top instead of repeating; the database keeps ten
    rememberSearch: (query) => supabase.from('recent_searches').upsert(
      { user_id: userId, profile_id: profileId, query, searched_at: new Date().toISOString() },
      { onConflict: 'profile_id,query_key' },
    ).then(unwrap),
    clearSearches: () => supabase.from('recent_searches').delete().eq('user_id', userId).eq('profile_id', profileId).then(unwrap),

    clearProgress: (titleId) => supabase.from('watch_progress').delete().eq('user_id', userId).eq('profile_id', profileId).eq('title_id', titleId).then(unwrap),

    // Codes are unique across all accounts (many demo users are called Alex), so add a random suffix
    async joinAffiliate(application) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = `${application.code}${randomSuffix()}`
        const { error } = await supabase.from('affiliates').insert({
          user_id: userId, referral_code: code, website_url: application.site || null, channels: application.channels.join(', '),
          accepted_terms: application.agree, audience_size: application.audience, payout_method: application.payout, tier: 'Starter',
        })
        if (!error) return loadAffiliate()
        if (error.code !== '23505') throw error
      }
      throw new Error('Could not create a unique referral code')
    },
  }
}

// Public reviews for a title, newest first, as { author, stars, text }
export const fetchReviews = (supabase, titleId) => supabase.from('review')
  .select('author_name, rating, body').eq('title_id', titleId).not('body', 'is', null)
  .order('created_at', { ascending: false }).limit(50).then(unwrap)
  .then((rows) => rows.map((r) => ({ author: r.author_name, stars: r.rating, text: r.body })))

export const postReview = (supabase, userId, titleId, review) => supabase.from('review')
  .insert({ user_id: userId, title_id: titleId, rating: review.stars, body: review.text }).then(unwrap)

import { callFunction } from './accountApi.js'

// A signed-in user's library in Supabase, in the shapes LibraryProvider keeps in state. RLS limits every query to the
// user's own rows; user_id is still sent because PostgREST needs a filter on UPDATE and DELETE.

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

const toIssue = (t) => ({ id: t.ticket_number, type: t.issue_type, titleId: t.title_id ?? '', summary: t.summary, steps: t.steps ?? '', device: t.device, status: t.status })
const toFeedback = (f) => ({ score: f.score, area: f.area, message: f.message, at: new Date(f.created_at) })

// No hyphen: /signup?ref= keeps letters and digits only
const READABLE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const randomSuffix = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => READABLE[b % READABLE.length]).join('')

export function libraryApi(supabase, userId) {
  const mine = (table, columns) => supabase.from(table).select(columns).eq('user_id', userId)

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

  // Watch list, favorites and reminders are sets of title ids
  const titleSet = (table) => ({
    add: (titleId) => supabase.from(table)
      .upsert({ user_id: userId, title_id: titleId }, { onConflict: 'user_id,title_id', ignoreDuplicates: true }).then(unwrap),
    remove: (titleId) => supabase.from(table).delete().eq('user_id', userId).eq('title_id', titleId).then(unwrap),
  })

  return {
    async load() {
      const [list, favorites, reminders, ratings, feedback, tickets, scores, account, affiliate] = await Promise.all([
        mine('watch_list_tables', 'title_id').order('added_at').then(unwrap),
        mine('favorites', 'title_id').order('added_at').then(unwrap),
        mine('reminders', 'title_id').order('created_at').then(unwrap),
        mine('review', 'title_id, rating').is('body', null).not('rating', 'is', null).order('created_at').then(unwrap),
        mine('feedback', 'score, area, message, created_at').order('created_at', { ascending: false }).then(unwrap),
        mine('tickets', 'ticket_number, issue_type, title_id, summary, steps, device, status').order('created_at', { ascending: false }).then(unwrap),
        mine('game_scores', 'game, best_score').then(unwrap),
        supabase.from('netflix_tables').select('data_opt_out').eq('id', userId).single().then(unwrap),
        loadAffiliate(),
      ])
      return {
        myList: list.map((r) => r.title_id),
        favorites: favorites.map((r) => r.title_id),
        reminders: reminders.map((r) => r.title_id),
        ratings: Object.fromEntries(ratings.map((r) => [r.title_id, r.rating])),
        feedback: feedback.map(toFeedback),
        issues: tickets.map(toIssue),
        bestScores: Object.fromEntries(scores.map((s) => [s.game, s.best_score])),
        doNotSell: account.data_opt_out,
        affiliate,
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

    addFeedback: (entry) => supabase.from('feedback')
      .insert({ user_id: userId, score: entry.score, area: entry.area, message: entry.message }).then(unwrap),

    // The database numbers the ticket (NF-48400, NF-48401…), so two users never get the same one
    addIssue: (issue) => supabase.from('tickets')
      .insert({ user_id: userId, issue_type: issue.type, title_id: issue.titleId || null, summary: issue.summary, steps: issue.steps || null, device: issue.device, status: issue.status })
      .select('ticket_number, issue_type, title_id, summary, steps, device, status').single().then(unwrap).then(toIssue),

    setDoNotSell: (value) => supabase.from('netflix_tables').update({ data_opt_out: value }).eq('id', userId).then(unwrap),

    saveScore: (game, value) => supabase.from('game_scores')
      .upsert({ user_id: userId, game, best_score: value }, { onConflict: 'user_id,game' }).then(unwrap),

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

    // The same Edge Function a visitor's click on the referral link calls
    async recordClick(code) {
      const { error } = await callFunction(supabase, 'record-referral', { code })
      if (error) throw new Error(error)
      return loadAffiliate()
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

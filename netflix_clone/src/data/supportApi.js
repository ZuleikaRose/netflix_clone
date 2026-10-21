// The support dashboard's queries (Supabase). Only staff may call them: staff_tickets() and
// staff_set_ticket_status() raise an error for anyone else, and RLS shows staff every ticket's replies.
import { toReply } from './libraryApi.js'

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

export const ticketStatuses = ['Open', 'In progress', 'Resolved']

const toTicket = (t) => ({
  ticketId: t.id, id: t.ticket_number, type: t.issue_type, titleId: t.title_id ?? '', summary: t.summary, steps: t.steps ?? '',
  device: t.device, status: t.status, at: new Date(t.created_at), member: t.member_name, email: t.member_email,
  replyCount: Number(t.replies),
})

// The queue, newest first (status null = every ticket)
export const fetchStaffTickets = (supabase, status) => supabase.rpc('staff_tickets', { p_status: status }).then(unwrap)
  .then((rows) => rows.map(toTicket))

export const fetchReplies = (supabase, ticketId) => supabase.from('ticket_replies')
  .select('id, body, from_staff, author_name, created_at').eq('ticket_id', ticketId).order('created_at').then(unwrap)
  .then((rows) => rows.map(toReply))

export const setTicketStatus = (supabase, ticketId, status) =>
  supabase.rpc('staff_set_ticket_status', { p_ticket: ticketId, p_status: status }).then(unwrap)

export const postStaffReply = (supabase, userId, ticketId, body) => supabase.from('ticket_replies')
  .insert({ ticket_id: ticketId, user_id: userId, body }).select('id, body, from_staff, author_name, created_at')
  .single().then(unwrap).then(toReply)

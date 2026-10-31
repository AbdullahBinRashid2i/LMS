import { adminSupabase } from '../config/supabase.js';
import type { TicketInput } from '../validators/apiSchemas.js';

export async function createStudentTicket(studentId: string, ticket: TicketInput) {
  const { data, error } = await adminSupabase!.from('support_tickets')
    .insert({ ...ticket, student_id: studentId }).select('id,status,created_at').single();
  if (error) throw error;
  return data;
}

export async function listTickets(userId: string, isAdmin: boolean) {
  const query = adminSupabase!.from('support_tickets').select('id,subject,message,category,status,created_at,updated_at,student_id').order('created_at', { ascending: false }).limit(100);
  const { data, error } = isAdmin ? await query : await query.eq('student_id', userId);
  if (error) throw error;
  return data ?? [];
}

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './lib/api';

type Ticket = { id: string; subject: string; message: string; category: string; status: string; created_at: string; student_id: string };
export default function SupportWorkspace({ token, userId, role }: { token: string; userId: string; role: string }) {
  const cache = useQueryClient();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('technical');
  const [message, setMessage] = useState('');
  const tickets = useQuery({ queryKey: ['support-tickets', userId], queryFn: () => apiRequest<{ tickets: Ticket[] }>('/api/support/tickets', token) });
  const create = useMutation({
    mutationFn: () => apiRequest('/api/support/tickets', token, { method: 'POST', body: JSON.stringify({ subject, category, message }) }),
    onSuccess: () => { setSubject(''); setMessage(''); cache.invalidateQueries({ queryKey: ['support-tickets', userId] }); },
  });
  function submit(event: FormEvent) { event.preventDefault(); create.mutate(); }
  return <div className="section-view"><div className="section-overline">STUDENT SUPPORT</div><div className="section-view-head"><div><h1>Help desk</h1><p>Send a request and follow its status from your account.</p></div></div>
    {role !== 'admin' && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>New support request</h2><p>Describe the issue with enough detail for staff to help.</p></div></div><form className="admin-course-form" onSubmit={submit}><label>Subject<input required minLength={4} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)}/></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="technical">Technical</option><option value="billing">Billing</option><option value="grading">Grading</option><option value="other">Other</option></select></label><label>Details<textarea required minLength={10} maxLength={5000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)}/></label>{create.isError && <div className="auth-message">{create.error instanceof Error ? create.error.message : 'Could not send your request.'}</div>}<button className="primary-button" disabled={create.isPending}>{create.isPending ? 'Sending…' : 'Send request'}</button></form></section>}
    <section className="admin-panel"><div className="admin-panel-heading"><div><h2>{role === 'admin' ? 'Recent requests' : 'Your requests'}</h2><p>{role === 'admin' ? 'Student requests are listed below.' : 'Only you and authorized staff can see your requests.'}</p></div></div>{tickets.isLoading ? <p className="admin-empty">Loading requests…</p> : tickets.isError ? <div className="auth-message">Could not load support requests.</div> : tickets.data?.tickets.length ? <div className="ticket-list">{tickets.data.tickets.map((ticket) => <article className="ticket-row" key={ticket.id}><div><strong>{ticket.subject}</strong><p>{ticket.message}</p><small>{ticket.category} · {new Date(ticket.created_at).toLocaleString()}{role === 'admin' ? ` · Student ${ticket.student_id.slice(0, 8)}` : ''}</small></div><span className={`role-pill ${ticket.status}`}>{ticket.status.replace('_', ' ')}</span></article>)}</div> : <p className="admin-empty">No support requests yet.</p>}</section>
  </div>;
}

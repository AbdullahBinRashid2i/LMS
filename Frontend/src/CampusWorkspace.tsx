import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, Send } from 'lucide-react';
import { supabase } from './lib/supabase';
import StudyRoom from './StudyRoom';

type Course = { id: string; title: string };
type CampusSection = 'Resources' | 'Announcements' | 'Study room';
export default function CampusWorkspace({ section, courses, userId, role, token }: { section: CampusSection; courses: Course[]; userId: string; role: string; token: string }) {
  if (section === 'Resources') return <ResourcesWorkspace courses={courses} userId={userId} role={role}/>;
  if (section === 'Announcements') return <AnnouncementsWorkspace courses={courses} userId={userId} role={role}/>;
  return <><StudyRoom token={token}/><ChatWorkspace courses={courses} userId={userId}/></>;
}

function ResourcesWorkspace({ courses, userId, role }: { courses: Course[]; userId: string; role: string }) {
  const cache = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const courseIds = courses.map((course) => course.id);
  const query = useQuery({ queryKey: ['resources', courseIds], enabled: Boolean(supabase && courseIds.length), queryFn: async () => {
    const { data, error } = await supabase!.from('resources').select('id,course_id,title,file_url,ai_summary,created_at').in('course_id', courseIds).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }});
  const upload = useMutation({ mutationFn: async (file: File) => {
    if (!supabase || !courseId) throw new Error('Choose a course first.');
    if (file.size > 50 * 1024 * 1024) throw new Error('Choose a file smaller than 50 MB.');
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${courseId}/resources/${userId}/${crypto.randomUUID()}-${cleanName}`;
    const stored = await supabase.storage.from('course-materials').upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (stored.error) throw stored.error;
    const result = await supabase.from('resources').insert({ course_id: courseId, title: title.trim() || file.name, file_url: path, uploaded_by: userId }).select('id').single();
    if (result.error) throw result.error;
  }, onSuccess: () => { setTitle(''); setMessage('Resource uploaded. AI summaries require an AI provider key and are not enabled yet.'); cache.invalidateQueries({ queryKey: ['resources'] }); }, onError: (error) => setMessage(error instanceof Error ? error.message : 'Upload failed.') });
  async function download(path: string) { const result = await supabase!.storage.from('course-materials').createSignedUrl(path, 300); if (result.error) setMessage(result.error.message); else window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer'); }
  return <div className="section-view"><div className="section-overline">COURSE LIBRARY</div><div className="section-view-head"><div><h1>Resources</h1><p>Private course files available to enrolled students and instructors.</p></div></div>
    {(role === 'teacher' || role === 'admin') && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Upload course material</h2><p>Files are stored in the private Supabase course bucket.</p></div></div>{!courses.length ? <p className="admin-empty">Create a course first in Course management.</p> : <div className="resource-upload"><label>Course<select value={courseId} required onChange={(event) => setCourseId(event.target.value)}><option value="">Choose course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Display title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional; defaults to filename"/></label><label className="file-submit"><FileUp size={15}/> Choose file<input type="file" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) { setMessage(''); upload.mutate(file); event.currentTarget.value = ''; } }}/></label></div>}{upload.isPending && <p className="admin-empty">Uploading securely…</p>}{message && <div className={upload.isError ? 'auth-message' : 'admin-success'}>{message}</div>}</section>}
    {query.isLoading ? <p className="admin-empty">Loading resources…</p> : query.isError ? <div className="auth-message">Could not load resources. Check your course enrollment and database setup.</div> : query.data?.length ? <div className="resource-list">{query.data.map((resource) => <article className="resource-row" key={resource.id}><div><span className="course-code">{courses.find((course) => course.id === resource.course_id)?.title}</span><strong>{resource.title}</strong><small>{new Date(resource.created_at).toLocaleDateString()}</small></div><button className="secondary-button" onClick={() => download(resource.file_url)}><Download size={14}/> Download</button></article>)}</div> : <div className="feature-placeholder"><h2>No resources yet</h2><p>Materials shared by your course instructors appear here.</p></div>}
  </div>;
}

function AnnouncementsWorkspace({ courses, userId, role }: { courses: Course[]; userId: string; role: string }) {
  const cache = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('general');
  const [notice, setNotice] = useState('');
  const ids = courses.map((course) => course.id);
  const query = useQuery({ queryKey: ['announcements', ids], enabled: Boolean(supabase), queryFn: async () => {
    const base = supabase!.from('announcements').select('id,course_id,title,body,priority,created_at');
    const result = ids.length ? await base.or(`course_id.is.null,course_id.in.(${ids.join(',')})`).order('created_at', { ascending: false }) : await base.is('course_id', null).order('created_at', { ascending: false });
    if (result.error) throw result.error;
    return result.data ?? [];
  }});
  useEffect(() => { const client = supabase; if (!client) return; const channel = client.channel('lms-announcements').on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => { cache.invalidateQueries({ queryKey: ['announcements'] }); }).subscribe(); return () => { void client.removeChannel(channel); }; }, [cache]);
  const publish = useMutation({ mutationFn: async () => {
    if (!supabase) throw new Error('Database is not connected.');
    const { error } = await supabase.from('announcements').insert({ course_id: courseId || null, title: title.trim(), body: body.trim(), priority, created_by: userId });
    if (error) throw error;
  }, onSuccess: () => { setTitle(''); setBody(''); setNotice('Announcement published.'); cache.invalidateQueries({ queryKey: ['announcements'] }); }, onError: (error) => setNotice(error instanceof Error ? error.message : 'Could not publish announcement.') });
  function submit(event: FormEvent) { event.preventDefault(); setNotice(''); publish.mutate(); }
  return <div className="section-view"><div className="section-overline">CAMPUS UPDATES</div><div className="section-view-head"><div><h1>Announcements</h1><p>Course updates and urgent campus notices.</p></div></div>{(role === 'teacher' || role === 'admin') && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Publish an announcement</h2><p>Students see updates for their enrolled courses.</p></div></div><form className="admin-course-form" onSubmit={submit}><label>Audience<select value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Campus-wide {role === 'admin' ? 'announcement' : '(choose a course)'}</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="general">General</option><option value="exam">Exam</option><option value="urgent">Urgent</option></select></label><label>Title<input required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>Message<textarea required minLength={3} maxLength={5000} rows={3} value={body} onChange={(event) => setBody(event.target.value)}/></label>{notice && <div className={publish.isError ? 'auth-message' : 'admin-success'}>{notice}</div>}<button className="primary-button" disabled={publish.isPending}>{publish.isPending ? 'Publishing…' : 'Publish update'}</button></form></section>}
    {query.isLoading ? <p className="admin-empty">Loading updates…</p> : query.isError ? <div className="auth-message">Could not load announcements.</div> : query.data?.length ? <div className="announcement-list">{query.data.map((item) => <article className="announcement-card" key={item.id}><span className={`announcement-priority ${item.priority}`}>{item.priority}</span><h2>{item.title}</h2><p>{item.body}</p><small>{item.course_id ? courses.find((course) => course.id === item.course_id)?.title ?? 'Course update' : 'Campus-wide'} · {new Date(item.created_at).toLocaleString()}</small></article>)}</div> : <div className="feature-placeholder"><h2>No announcements yet</h2><p>Updates from your courses will appear here.</p></div>}
  </div>;
}

function ChatWorkspace({ courses, userId }: { courses: Course[]; userId: string }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [body, setBody] = useState('');
  const cache = useQueryClient();
  useEffect(() => { const client = supabase; if (!courseId || !client) return; const channel = client.channel(`course-chat-${courseId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `course_id=eq.${courseId}` }, () => { cache.invalidateQueries({ queryKey: ['chat', courseId] }); }).subscribe(); return () => { void client.removeChannel(channel); }; }, [courseId, cache]);
  const query = useQuery({ queryKey: ['chat', courseId], enabled: Boolean(courseId && supabase), queryFn: async () => { const { data, error } = await supabase!.from('chat_messages').select('id,author_id,body,is_ai,created_at').eq('course_id', courseId).order('created_at').limit(100); if (error) throw error; return data ?? []; } });
  const send = useMutation({ mutationFn: async () => { if (!supabase) throw new Error('Database is not connected.'); const { error } = await supabase.from('chat_messages').insert({ course_id: courseId, author_id: userId, body: body.trim(), is_ai: false }); if (error) throw error; }, onSuccess: () => { setBody(''); cache.invalidateQueries({ queryKey: ['chat', courseId] }); } });
  function submit(event: FormEvent) { event.preventDefault(); send.mutate(); }
  return <div className="section-view"><div className="section-overline">LIVE COURSE DISCUSSION</div><div className="section-view-head"><div><h1>Study room</h1><p>Discuss course topics with classmates and instructors.</p></div>{courses.length > 0 && <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select>}</div>{!courses.length ? <div className="feature-placeholder"><h2>Join a course to use the study room</h2><p>Your instructor or administrator can enroll your account.</p></div> : <section className="chat-panel"><div className="chat-messages">{query.isLoading ? <p className="admin-empty">Loading discussion…</p> : query.isError ? <div className="auth-message">Could not load course messages.</div> : query.data?.length ? query.data.map((message) => <article className={`chat-message ${message.author_id === userId ? 'mine' : ''}`} key={message.id}><p>{message.body}</p><small>{message.is_ai ? 'AI assistant' : message.author_id === userId ? 'You' : `Member ${message.author_id.slice(0, 6)}`} · {new Date(message.created_at).toLocaleTimeString()}</small></article>) : <p className="admin-empty">Start the conversation with a question or helpful note.</p>}</div><form className="chat-compose" onSubmit={submit}><input required maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Message this course…"/><button className="primary-button" disabled={send.isPending}><Send size={15}/><span>Send</span></button></form>{send.isError && <div className="auth-message">{send.error instanceof Error ? send.error.message : 'Message could not be sent.'}</div>}<small className="chat-note">Messages containing @AI are not processed until an AI provider is configured.</small></section>}</div>;
}

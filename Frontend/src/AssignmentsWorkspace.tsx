import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Download, FileUp } from 'lucide-react';
import { apiRequest } from './lib/api';
import { supabase } from './lib/supabase';

type Assignment = { id: string; course_id: string; title: string; description: string | null; due_date: string; max_marks: number; course?: { title: string }; submissions: { id: string; student_id: string; submission_file: string; file_url: string; marks: number | null; feedback: string | null; submitted_at: string }[] };
type Course = { id: string; title: string };

export default function AssignmentsWorkspace({ token, role, userId }: { token: string; role: string; userId: string }) {
  const cache = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxMarks, setMaxMarks] = useState(100);
  const [message, setMessage] = useState('');
  const assignmentQuery = useQuery({ queryKey: ['assignments', userId], queryFn: () => apiRequest<{ assignments: Assignment[] }>('/api/assignments', token) });
  const courseQuery = useQuery({ queryKey: ['courses', 'managed'], enabled: role === 'teacher' || role === 'admin', queryFn: () => apiRequest<{ courses: Course[] }>('/api/courses', token) });
  const createMutation = useMutation({
    mutationFn: () => apiRequest('/api/assignments', token, { method: 'POST', body: JSON.stringify({ course_id: courseId, title, description, due_date: new Date(dueDate).toISOString(), max_marks: maxMarks }) }),
    onSuccess: () => { setTitle(''); setDescription(''); setDueDate(''); setMessage('Assignment created.'); cache.invalidateQueries({ queryKey: ['assignments'] }); cache.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not create assignment.'),
  });
  const submitMutation = useMutation({
    mutationFn: async ({ assignment, file }: { assignment: Assignment; file: File }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      if (file.size > 50 * 1024 * 1024) throw new Error('Choose a file smaller than 50 MB.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${assignment.course_id}/submissions/${userId}/${assignment.id}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('course-materials').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;
      return apiRequest(`/api/assignments/${assignment.id}/submissions`, token, { method: 'POST', body: JSON.stringify({ file_path: path }) });
    },
    onSuccess: () => { setMessage('Your work was submitted.'); cache.invalidateQueries({ queryKey: ['assignments', userId] }); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not submit this assignment.'),
  });
  const gradeMutation = useMutation({
    mutationFn: ({ id, marks, feedback }: { id: string; marks: number; feedback: string }) => apiRequest(`/api/submissions/${id}/grade`, token, { method: 'PATCH', body: JSON.stringify({ marks, feedback }) }),
    onSuccess: () => { setMessage('Grade saved.'); cache.invalidateQueries({ queryKey: ['assignments', userId] }); cache.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not save grade.'),
  });
  function createAssignment(event: FormEvent) { event.preventDefault(); setMessage(''); createMutation.mutate(); }

  return <div className="section-view"><div className="section-overline">COURSE WORK</div><div className="section-view-head"><div><h1>Assignments</h1><p>Deadlines, submissions, and instructor feedback.</p></div></div>
    {(role === 'teacher' || role === 'admin') && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Create an assignment</h2><p>Students enrolled in the course can submit work before the deadline.</p></div></div>{!courseQuery.data?.courses.length ? <p className="admin-empty">Create a course first in Course management.</p> : <form className="admin-course-form assignment-form" onSubmit={createAssignment}><label>Course<select required value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Choose course</option>{courseQuery.data?.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Title<input required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>Instructions<textarea maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)}/></label><div className="assignment-fields"><label>Due date and time<input type="datetime-local" required value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label><label>Maximum marks<input type="number" min={1} max={10000} value={maxMarks} onChange={(event) => setMaxMarks(Number(event.target.value))}/></label></div><button className="primary-button" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Publish assignment'}</button></form>}</section>}
    {message && <div className={submitMutation.isError || createMutation.isError || gradeMutation.isError ? 'auth-message' : 'admin-success'}>{message}</div>}
    {assignmentQuery.isLoading ? <p className="admin-empty">Loading assignments…</p> : assignmentQuery.isError ? <div className="auth-message">Could not load assignments. Check that the latest database migration is applied.</div> : assignmentQuery.data?.assignments.length ? <div className="assignment-list">{assignmentQuery.data.assignments.map((assignment) => {
      const mySubmission = assignment.submissions.find((submission) => submission.student_id === userId);
      const isOpen = new Date(assignment.due_date).getTime() > Date.now();
      return <article className="assignment-card" key={assignment.id}><div className="assignment-card-head"><div><span className="course-code">{assignment.course?.title ?? 'COURSE'}</span><h2>{assignment.title}</h2></div><span className="score-chip">{assignment.max_marks} marks</span></div>{assignment.description && <p>{assignment.description}</p>}<div className="assignment-due"><CalendarDays size={14}/> Due {new Date(assignment.due_date).toLocaleString()} · {isOpen ? 'Open' : 'Closed'}</div>
        {role === 'student' && <div className="submission-area">{mySubmission ? <div className="submission-status"><span>{mySubmission.marks === null ? 'Submitted · awaiting review' : `Graded: ${mySubmission.marks}/${assignment.max_marks}`}</span><a href={mySubmission.file_url} target="_blank" rel="noreferrer"><Download size={14}/> View submission</a>{mySubmission.feedback && <p>{mySubmission.feedback}</p>}</div> : isOpen ? <label className="file-submit"><FileUp size={15}/> Upload your work<input type="file" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) { setMessage(''); submitMutation.mutate({ assignment, file }); event.currentTarget.value = ''; } }}/></label> : <span className="admin-empty">Deadline passed. This assignment is closed.</span>}</div>}
        {(role === 'teacher' || role === 'admin') && <div className="submission-list"><strong>{assignment.submissions.length} submission{assignment.submissions.length === 1 ? '' : 's'}</strong>{assignment.submissions.map((submission) => <GradeRow key={submission.id} submission={submission} maxMarks={assignment.max_marks} onGrade={(marks, feedback) => gradeMutation.mutate({ id: submission.id, marks, feedback })} busy={gradeMutation.isPending}/>)}</div>}
      </article>;
    })}</div> : <div className="feature-placeholder"><h2>No assignments yet</h2><p>Assignments for your enrolled courses will appear here.</p></div>}
  </div>;
}

function GradeRow({ submission, maxMarks, onGrade, busy }: { submission: Assignment['submissions'][number]; maxMarks: number; onGrade: (marks: number, feedback: string) => void; busy: boolean }) {
  const [marks, setMarks] = useState(submission.marks === null ? '' : String(submission.marks));
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  return <div className="grade-row"><a href={submission.file_url} target="_blank" rel="noreferrer">Submission · {new Date(submission.submitted_at).toLocaleDateString()} <Download size={13}/></a><input aria-label="Marks" type="number" min={0} max={maxMarks} value={marks} onChange={(event) => setMarks(event.target.value)} placeholder={`/${maxMarks}`}/><input aria-label="Feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Instructor feedback"/><button className="secondary-button" disabled={busy || marks === ''} onClick={() => onGrade(Number(marks), feedback)}>Save grade</button></div>;
}

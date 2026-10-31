import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './lib/api';

type UserRow = { id: string; email: string; full_name: string; role: 'admin' | 'teacher' | 'student'; created_at: string };

export default function AdminPanel({ token, role }: { token: string; role: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [message, setMessage] = useState('');
  const usersQuery = useQuery({
    queryKey: ['admin-users'], enabled: role === 'admin',
    queryFn: () => apiRequest<{ users: UserRow[] }>('/api/admin/users', token),
  });
  const coursesQuery = useQuery({
    queryKey: ['courses', 'managed'], enabled: role === 'admin' || role === 'teacher',
    queryFn: () => apiRequest<{ courses: { id: string; title: string }[] }>('/api/courses', token),
  });
  const studentsQuery = useQuery({
    queryKey: ['student-directory'], enabled: role === 'admin',
    queryFn: () => apiRequest<{ users: UserRow[] }>('/api/students', token),
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, role: nextRole }: { id: string; role: 'student' | 'teacher' }) =>
      apiRequest(`/api/admin/users/${id}/role`, token, { method: 'PATCH', body: JSON.stringify({ role: nextRole }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  const courseMutation = useMutation({
    mutationFn: () => apiRequest('/api/courses', token, { method: 'POST', body: JSON.stringify({ title, description }) }),
    onSuccess: () => { setTitle(''); setDescription(''); setMessage('Course created.'); queryClient.invalidateQueries({ queryKey: ['courses'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not create course.'),
  });
  const enrollmentMutation = useMutation({
    mutationFn: () => apiRequest(`/api/courses/${courseId}/enrollments`, token, { method: 'POST', body: JSON.stringify(role === 'admin' ? { student_id: studentId } : { student_email: studentEmail }) }),
    onSuccess: () => { setMessage('Student enrolled in the course.'); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not enroll this student.'),
  });
  function createCourse(event: FormEvent) { event.preventDefault(); setMessage(''); courseMutation.mutate(); }

  return <div className="section-view admin-workspace">
    <div className="section-overline">GUTECH WORKSPACE</div>
    <div className="section-view-head"><div><h1>{role === 'admin' ? 'Administration' : 'Course management'}</h1><p>{role === 'admin' ? 'Manage registered accounts and assign teaching access.' : 'Create courses for your students.'}</p></div></div>
    {role === 'admin' && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>People and access</h2><p>New accounts start as students. Assign teacher access here.</p></div><span>{usersQuery.data?.users.length ?? '—'} accounts</span></div>
      {usersQuery.isError ? <div className="auth-message">Could not load accounts. Confirm the database migration is applied and your account has the admin role.</div> : usersQuery.isLoading ? <p className="admin-empty">Loading accounts…</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>{(usersQuery.data?.users ?? []).map((user) => <tr key={user.id}><td>{user.full_name || 'Name not provided'}</td><td>{user.email}</td><td>{user.role === 'admin' ? <span className="role-pill admin">Admin</span> : <select aria-label={`Role for ${user.email}`} value={user.role} disabled={roleMutation.isPending} onChange={(event) => roleMutation.mutate({ id: user.id, role: event.target.value as 'student' | 'teacher' })}><option value="student">Student</option><option value="teacher">Teacher</option></select>}</td><td>{new Date(user.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
      {roleMutation.isError && <div className="auth-message">{roleMutation.error instanceof Error ? roleMutation.error.message : 'Could not update account role.'}</div>}
    </section>}
    {(role === 'admin' || role === 'teacher') && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Enroll a student</h2><p>{role === 'admin' ? 'Choose a student account to add them to a course.' : 'Enter the email address the student used to create their account.'}</p></div></div><form className="admin-course-form" onSubmit={(event) => { event.preventDefault(); setMessage(''); enrollmentMutation.mutate(); }}><label>Course<select required value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select a course</option>{coursesQuery.data?.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>{role === 'admin' ? <label>Student<select required value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Select a student</option>{studentsQuery.data?.users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email} · {user.email}</option>)}</select></label> : <label>Student email<input type="email" required value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} placeholder="student@example.com" /></label>}<button className="primary-button" disabled={enrollmentMutation.isPending}>{enrollmentMutation.isPending ? 'Enrolling…' : 'Enroll student'}</button></form>{(enrollmentMutation.isError || enrollmentMutation.isSuccess) && <div className={enrollmentMutation.isError ? 'auth-message' : 'admin-success'}>{enrollmentMutation.isError && !message ? enrollmentMutation.error instanceof Error ? enrollmentMutation.error.message : 'Could not enroll this student.' : message}</div>}{role === 'admin' && studentsQuery.isError && <div className="auth-message">Could not load the student directory.</div>}</section>}
    {(role === 'admin' || role === 'teacher') && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Create a course</h2><p>Courses you create appear in your live course list.</p></div></div><form className="admin-course-form" onSubmit={createCourse}><label>Course name<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Introduction to Computing"/></label><label>Description<textarea maxLength={3000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will students learn?" rows={3}/></label>{message && <div className={courseMutation.isError ? 'auth-message' : 'admin-success'}>{message}</div>}<button className="primary-button" disabled={courseMutation.isPending}>{courseMutation.isPending ? 'Creating…' : 'Create course'}</button></form></section>}
  </div>;
}

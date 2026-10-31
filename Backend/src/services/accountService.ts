import { adminSupabase } from '../config/supabase.js';
export type UserRole = 'admin' | 'teacher' | 'student';

export async function findProfile(userId: string) {
  const { data, error } = await adminSupabase!.from('profiles')
    .select('id,email,role,full_name,avatar_url,created_at').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listEnrolledCourses(studentId: string) {
  const { data: profile, error: profileError } = await adminSupabase!.from('profiles').select('role').eq('id', studentId).single();
  if (profileError) throw profileError;
  if (profile.role === 'admin') {
    const { data, error } = await adminSupabase!.from('courses').select('id,title,description,created_at,created_by').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
  if (profile.role === 'teacher') {
    const { data, error } = await adminSupabase!.from('courses').select('id,title,description,created_at,created_by').eq('created_by', studentId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
  const { data, error } = await adminSupabase!.from('course_enrollments')
    .select('course:courses(id,title,description,created_at,created_by)').eq('student_id', studentId);
  if (error) throw error;
  return (data ?? []).flatMap((enrollment) => {
    if (!enrollment.course) return [];
    return Array.isArray(enrollment.course) ? enrollment.course : [enrollment.course];
  });
}

export async function getDashboardData(userId: string) {
  const courses = await listEnrolledCourses(userId);
  const courseIds = courses.map((course) => course.id);
  const [profile, sessionRows, upcomingRows, attemptRows, submissionsRows] = await Promise.all([
    findProfile(userId),
    adminSupabase!.from('study_sessions').select('duration_seconds').eq('student_id', userId).not('finished_at', 'is', null),
    courseIds.length ? adminSupabase!.from('assignments').select('id,title,due_date,course_id,max_marks').in('course_id', courseIds).gte('due_date', new Date().toISOString()).order('due_date').limit(10) : Promise.resolve({ data: [], error: null }),
    adminSupabase!.from('quiz_attempts').select('score').eq('student_id', userId).not('submitted_at', 'is', null),
    adminSupabase!.from('assignment_submissions').select('id').eq('student_id', userId),
  ]);
  for (const result of [sessionRows, upcomingRows, attemptRows, submissionsRows]) if (result.error) throw result.error;
  const totalSeconds = (sessionRows.data ?? []).reduce((total, row) => total + row.duration_seconds, 0);
  const scored = (attemptRows.data ?? []).map((row) => Number(row.score)).filter(Number.isFinite);
  const submittedIds = new Set((submissionsRows.data ?? []).map((row) => row.id));
  return {
    profile,
    metrics: {
      activeCourses: courses.length,
      hoursLearned: Math.round((totalSeconds / 3600) * 10) / 10,
      averageScore: scored.length ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length) : null,
      upcomingAssignments: upcomingRows.data?.length ?? 0,
    },
    courses,
    upcomingAssignments: upcomingRows.data ?? [],
    submittedCount: submittedIds.size,
  };
}

export async function listUsers() {
  const { data, error } = await adminSupabase!.from('profiles').select('id,email,full_name,role,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listStudents() {
  const { data, error } = await adminSupabase!.from('profiles').select('id,email,full_name,role').eq('role', 'student').order('full_name');
  if (error) throw error;
  return data ?? [];
}

export async function changeUserRole(userId: string, actorId: string, role: Exclude<UserRole, 'admin'>) {
  if (userId === actorId) throw Object.assign(new Error('You cannot change your own administrator access.'), { statusCode: 400 });
  const { data, error } = await adminSupabase!.from('profiles').update({ role }).eq('id', userId).select('id,email,full_name,role').single();
  if (error) throw error;
  return data;
}

export async function createCourse(input: { title: string; description?: string }, creatorId: string) {
  const { data, error } = await adminSupabase!.from('courses').insert({ ...input, created_by: creatorId }).select('id,title,description,created_at,created_by').single();
  if (error) throw error;
  return data;
}

export async function listAssignments(userId: string) {
  const courses = await listEnrolledCourses(userId);
  const ids = courses.map((course) => course.id);
  if (!ids.length) return [];
  const profile = await findProfile(userId);
  const query = adminSupabase!.from('assignments')
    .select('id,course_id,title,description,due_date,max_marks,created_at')
    .in('course_id', ids).order('due_date', { ascending: true });
  const { data: assignments, error } = await query;
  if (error) throw error;
  if (!assignments?.length) return [];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const submissionQuery = adminSupabase!.from('assignment_submissions')
    .select('id,assignment_id,student_id,submission_file,marks,feedback,submitted_at')
    .in('assignment_id', assignmentIds);
  const { data: submissions, error: submissionError } = profile?.role === 'student'
    ? await submissionQuery.eq('student_id', userId)
    : await submissionQuery;
  if (submissionError) throw submissionError;
  return Promise.all(assignments.map(async (assignment) => ({
    ...assignment,
    course: courses.find((course) => course.id === assignment.course_id),
    submissions: await Promise.all((submissions ?? []).filter((submission) => submission.assignment_id === assignment.id).map(async (submission) => {
      const { data, error } = await adminSupabase!.storage.from('course-materials').createSignedUrl(submission.submission_file, 300);
      if (error) throw error;
      return { ...submission, file_url: data.signedUrl };
    })),
  })));
}

export async function createAssignment(input: { course_id: string; title: string; description?: string; due_date: string; max_marks: number }, actorId: string) {
  await assertCourseManager(input.course_id, actorId);
  const { data, error } = await adminSupabase!.from('assignments').insert(input).select('id,course_id,title,description,due_date,max_marks,created_at').single();
  if (error) throw error;
  return data;
}

export async function submitAssignment(assignmentId: string, studentId: string, filePath: string) {
  const profile = await findProfile(studentId);
  if (profile?.role !== 'student') throw Object.assign(new Error('Only student accounts can submit assignments.'), { statusCode: 403 });
  const { data: assignment, error: assignmentError } = await adminSupabase!.from('assignments').select('id,course_id,due_date').eq('id', assignmentId).single();
  if (assignmentError) throw assignmentError;
  if (new Date(assignment.due_date).getTime() < Date.now()) throw Object.assign(new Error('The deadline has passed; this assignment can no longer be submitted.'), { statusCode: 409 });
  const courses = await listEnrolledCourses(studentId);
  if (!courses.some((course) => course.id === assignment.course_id)) throw Object.assign(new Error('You are not enrolled in this course.'), { statusCode: 403 });
  const expectedPrefix = `${assignment.course_id}/submissions/${studentId}/`;
  if (!filePath.startsWith(expectedPrefix)) throw Object.assign(new Error('This file does not belong to your account and course.'), { statusCode: 403 });
  const { data, error } = await adminSupabase!.from('assignment_submissions').upsert({ assignment_id: assignmentId, student_id: studentId, submission_file: filePath, submitted_at: new Date().toISOString() }, { onConflict: 'assignment_id,student_id' }).select('id,assignment_id,submitted_at').single();
  if (error) throw error;
  return data;
}

export async function gradeSubmission(submissionId: string, actorId: string, marks: number, feedback?: string) {
  const { data: submission, error: submissionError } = await adminSupabase!.from('assignment_submissions').select('id,assignment_id').eq('id', submissionId).single();
  if (submissionError) throw submissionError;
  const { data: assignment, error: assignmentError } = await adminSupabase!.from('assignments').select('course_id,max_marks').eq('id', submission.assignment_id).single();
  if (assignmentError) throw assignmentError;
  await assertCourseManager(assignment.course_id, actorId);
  if (marks > assignment.max_marks) throw Object.assign(new Error(`Marks cannot be higher than ${assignment.max_marks}.`), { statusCode: 400 });
  const { data, error } = await adminSupabase!.from('assignment_submissions').update({ marks, feedback: feedback ?? '' }).eq('id', submissionId).select('id,marks,feedback').single();
  if (error) throw error;
  return data;
}

export async function listCourseEnrollments(courseId: string, actorId: string) {
  await assertCourseManager(courseId, actorId);
  const { data, error } = await adminSupabase!.from('course_enrollments').select('student_id,enrolled_at,profile:profiles(id,email,full_name,role)').eq('course_id', courseId).order('enrolled_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function enrollStudent(courseId: string, studentId: string, actorId: string) {
  await assertCourseManager(courseId, actorId);
  const { data: student, error: studentError } = await adminSupabase!.from('profiles').select('id,role').eq('id', studentId).single();
  if (studentError) throw studentError;
  if (student.role !== 'student') throw Object.assign(new Error('Only student accounts can be enrolled in a course.'), { statusCode: 400 });
  const { data, error } = await adminSupabase!.from('course_enrollments').upsert({ course_id: courseId, student_id: studentId }, { onConflict: 'course_id,student_id' }).select('id,course_id,student_id,enrolled_at').single();
  if (error) throw error;
  return data;
}

export async function enrollStudentByEmail(courseId: string, email: string, actorId: string) {
  await assertCourseManager(courseId, actorId);
  const { data: student, error: studentError } = await adminSupabase!.from('profiles').select('id,role').eq('email', email.trim().toLowerCase()).single();
  if (studentError) { if (studentError.code === 'PGRST116') throw Object.assign(new Error('No account was found with that email. Ask the student to sign up first.'), { statusCode: 404 }); throw studentError; }
  if (student.role !== 'student') throw Object.assign(new Error('Only student accounts can be enrolled in a course.'), { statusCode: 400 });
  const { data, error } = await adminSupabase!.from('course_enrollments').upsert({ course_id: courseId, student_id: student.id }, { onConflict: 'course_id,student_id' }).select('id,course_id,student_id,enrolled_at').single();
  if (error) throw error;
  return data;
}

async function assertCourseManager(courseId: string, actorId: string) {
  const [{ data: actor, error: actorError }, { data: course, error: courseError }] = await Promise.all([
    adminSupabase!.from('profiles').select('role').eq('id', actorId).single(),
    adminSupabase!.from('courses').select('created_by').eq('id', courseId).single(),
  ]);
  if (actorError) throw actorError;
  if (courseError) throw courseError;
  if (actor.role !== 'admin' && (actor.role !== 'teacher' || course.created_by !== actorId)) throw Object.assign(new Error('You can manage this only for courses you own.'), { statusCode: 403 });
}

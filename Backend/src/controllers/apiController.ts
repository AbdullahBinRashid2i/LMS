import type { RequestHandler } from 'express';
import { changeUserRole, createAssignment, createCourse, enrollStudent, enrollStudentByEmail, findProfile, getDashboardData, gradeSubmission, listAssignments, listCourseEnrollments, listEnrolledCourses, listStudents, listUsers, submitAssignment, type UserRole } from '../services/accountService.js';
import { createStudentTicket, listTickets } from '../services/supportService.js';
import type { TicketInput } from '../validators/apiSchemas.js';
import { adminSupabase } from '../config/supabase.js';
import { createQuiz, getQuiz, listQuizzes, startQuiz, submitQuizAttempt } from '../services/quizService.js';

export const getCurrentProfile: RequestHandler = (req, res, next) => {
  void findProfile(req.user!.id).then((profile) => {
    if (!profile) { res.status(404).json({ error: 'Profile not found. Complete profile setup in Supabase.' }); return; }
    res.json({ profile });
  }).catch(next);
};

export const getEnrolledCourses: RequestHandler = (req, res, next) => {
  void listEnrolledCourses(req.user!.id).then((courses) => res.json({ courses })).catch(next);
};

export const getDashboard: RequestHandler = (req, res, next) => {
  void getDashboardData(req.user!.id).then((dashboard) => res.json(dashboard)).catch(next);
};

export const getAdminUsers: RequestHandler = (_req, res, next) => {
  void listUsers().then((users) => res.json({ users })).catch(next);
};

export const getStudentDirectory: RequestHandler = (_req, res, next) => {
  void listStudents().then((users) => res.json({ users })).catch(next);
};

export const updateUserRole: RequestHandler = (req, res, next) => {
  void changeUserRole(req.params.id!, req.user!.id, (req.body as { role: Exclude<UserRole, 'admin'> }).role)
    .then((user) => res.json({ user })).catch(next);
};

export const postCourse: RequestHandler = (req, res, next) => {
  void createCourse(req.body as { title: string; description?: string }, req.user!.id)
    .then((course) => res.status(201).json({ course })).catch(next);
};

export const postStudySession: RequestHandler = (req, res, next) => {
  void (async () => {
    const { course_id } = req.body as { course_id?: string | null };
    const { data: openSessions, error: openError } = await adminSupabase!.from('study_sessions').select('id,created_at').eq('student_id', req.user!.id).is('finished_at', null);
    if (openError) throw openError;
    for (const open of openSessions ?? []) {
      const elapsed = Math.max(1, Math.min(14400, Math.floor((Date.now() - new Date(open.created_at).getTime()) / 1000)));
      const { error } = await adminSupabase!.from('study_sessions').update({ duration_seconds: elapsed, finished_at: new Date().toISOString() }).eq('id', open.id).is('finished_at', null);
      if (error) throw error;
    }
    const { data, error } = await adminSupabase!.from('study_sessions').insert({ student_id: req.user!.id, course_id: course_id ?? null, duration_seconds: 0 })
      .select('id,duration_seconds,created_at').single();
    if (error) throw error;
    res.status(201).json({ session: data });
  })().catch(next);
};

export const finishStudySession: RequestHandler = (req, res, next) => {
  void (async () => {
    const { data: session, error: readError } = await adminSupabase!.from('study_sessions').select('id,created_at,finished_at').eq('id', req.params.sessionId!).eq('student_id', req.user!.id).single();
    if (readError) throw readError;
    if (session.finished_at) throw Object.assign(new Error('This study session is already finished.'), { statusCode: 409 });
    const elapsed = Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000);
    if (elapsed < 1) throw Object.assign(new Error('Study for at least one second before finishing.'), { statusCode: 400 });
    if (elapsed > 14400) throw Object.assign(new Error('This session exceeded four hours. Please finish study sessions before then.'), { statusCode: 400 });
    const { data, error } = await adminSupabase!.from('study_sessions').update({ duration_seconds: elapsed, finished_at: new Date().toISOString() }).eq('id', session.id).is('finished_at', null).select('id,duration_seconds,created_at,finished_at').single();
    if (error) throw error;
    res.json({ session: data });
  })().catch(next);
};

export const getCourseEnrollments: RequestHandler = (req, res, next) => {
  void listCourseEnrollments(req.params.courseId!, req.user!.id).then((enrollments) => res.json({ enrollments })).catch(next);
};

export const postEnrollment: RequestHandler = (req, res, next) => {
  const input = req.body as { student_id?: string; student_email?: string };
  const enroll = input.student_id
    ? enrollStudent(req.params.courseId!, input.student_id, req.user!.id)
    : enrollStudentByEmail(req.params.courseId!, input.student_email!, req.user!.id);
  void enroll.then((enrollment) => res.status(201).json({ enrollment })).catch(next);
};

export const getAssignments: RequestHandler = (req, res, next) => {
  void listAssignments(req.user!.id).then((assignments) => res.json({ assignments })).catch(next);
};

export const postAssignment: RequestHandler = (req, res, next) => {
  void createAssignment(req.body as { course_id: string; title: string; description?: string; due_date: string; max_marks: number }, req.user!.id)
    .then((assignment) => res.status(201).json({ assignment })).catch(next);
};

export const postAssignmentSubmission: RequestHandler = (req, res, next) => {
  void submitAssignment(req.params.assignmentId!, req.user!.id, (req.body as { file_path: string }).file_path)
    .then((submission) => res.status(201).json({ submission })).catch(next);
};

export const patchSubmissionGrade: RequestHandler = (req, res, next) => {
  void gradeSubmission(req.params.submissionId!, req.user!.id, (req.body as { marks: number; feedback?: string }).marks, (req.body as { feedback?: string }).feedback)
    .then((submission) => res.json({ submission })).catch(next);
};

export const createSupportTicket: RequestHandler = (req, res, next) => {
  void createStudentTicket(req.user!.id, req.body as TicketInput)
    .then((ticket) => res.status(201).json({ ticket })).catch(next);
};

export const getSupportTickets: RequestHandler = (req, res, next) => {
  void findProfile(req.user!.id).then((profile) => listTickets(req.user!.id, profile?.role === 'admin'))
    .then((tickets) => res.json({ tickets })).catch(next);
};

export const getQuizzes: RequestHandler = (req, res, next) => {
  void listQuizzes(req.user!.id).then((quizzes) => res.json({ quizzes })).catch(next);
};

export const getQuizDetails: RequestHandler = (req, res, next) => {
  void getQuiz(req.params.quizId!, req.user!.id).then((quiz) => res.json({ quiz })).catch(next);
};

export const postQuiz: RequestHandler = (req, res, next) => {
  void createQuiz(req.body, req.user!.id).then((quiz) => res.status(201).json({ quiz })).catch(next);
};

export const postQuizAttempt: RequestHandler = (req, res, next) => {
  void startQuiz(req.params.quizId!, req.user!.id).then((attempt) => res.status(201).json({ attempt })).catch(next);
};

export const submitQuiz: RequestHandler = (req, res, next) => {
  void submitQuizAttempt(req.params.attemptId!, req.user!.id, (req.body as { answers: Record<string, number> }).answers)
    .then((result) => res.json(result)).catch(next);
};

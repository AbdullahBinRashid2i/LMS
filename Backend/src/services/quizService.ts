import { adminSupabase } from '../config/supabase.js';
import { findProfile, listEnrolledCourses } from './accountService.js';
import { randomUUID } from 'node:crypto';

export async function listQuizzes(userId: string) {
  const courses = await listEnrolledCourses(userId);
  const ids = courses.map((course) => course.id);
  if (!ids.length) return [];
  const { data, error } = await adminSupabase!.from('quizzes').select('id,course_id,title,time_limit_minutes,created_at').in('course_id', ids).order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map(async (quiz) => {
    const [{ count }, { data: attempts, error: attemptError }] = await Promise.all([
      adminSupabase!.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quiz.id),
      adminSupabase!.from('quiz_attempts').select('id,score,submitted_at').eq('quiz_id', quiz.id).eq('student_id', userId).order('started_at', { ascending: false }).limit(1),
    ]);
    if (attemptError) throw attemptError;
    return { ...quiz, question_count: count ?? 0, latest_attempt: attempts?.[0] ?? null, course: courses.find((course) => course.id === quiz.course_id) };
  }));
}

export async function createQuiz(input: { course_id: string; title: string; time_limit_minutes?: number | null; questions: { prompt: string; options: string[]; correct_index: number; rationale?: string }[] }, actorId: string) {
  const { data: actor, error: actorError } = await adminSupabase!.from('profiles').select('role').eq('id', actorId).single();
  if (actorError) throw actorError;
  const { data: course, error: courseError } = await adminSupabase!.from('courses').select('created_by').eq('id', input.course_id).single();
  if (courseError) throw courseError;
  if (actor.role !== 'admin' && (actor.role !== 'teacher' || course.created_by !== actorId)) throw Object.assign(new Error('You can create quizzes only for courses you own.'), { statusCode: 403 });
  const { data: quiz, error } = await adminSupabase!.from('quizzes').insert({ course_id: input.course_id, title: input.title, time_limit_minutes: input.time_limit_minutes ?? null, created_by: actorId }).select('id,course_id,title,time_limit_minutes,created_at').single();
  if (error) throw error;
  const rows = input.questions.map((question, position) => ({ id: randomUUID(), quiz_id: quiz.id, prompt: question.prompt, options: question.options, position }));
  const { error: questionError } = await adminSupabase!.from('quiz_questions').insert(rows);
  if (questionError) { await adminSupabase!.from('quizzes').delete().eq('id', quiz.id); throw questionError; }
  const keys = input.questions.map((question, position) => ({ question_id: rows[position]!.id, correct_index: question.correct_index, rationale: question.rationale ?? '' }));
  const { error: keyError } = await adminSupabase!.from('quiz_answer_keys').insert(keys);
  if (keyError) { await adminSupabase!.from('quizzes').delete().eq('id', quiz.id); throw keyError; }
  return quiz;
}

export async function getQuiz(quizId: string, userId: string) {
  const courses = await listEnrolledCourses(userId);
  const { data: quiz, error } = await adminSupabase!.from('quizzes').select('id,course_id,title,time_limit_minutes,created_at').eq('id', quizId).single();
  if (error) throw error;
  if (!courses.some((course) => course.id === quiz.course_id)) throw Object.assign(new Error('You are not enrolled in this course.'), { statusCode: 403 });
  const { data: questions, error: questionsError } = await adminSupabase!.from('quiz_questions').select('id,prompt,options,position').eq('quiz_id', quizId).order('position');
  if (questionsError) throw questionsError;
  return { ...quiz, questions: questions ?? [] };
}

export async function startQuiz(quizId: string, userId: string) {
  const profile = await findProfile(userId);
  if (profile?.role !== 'student') throw Object.assign(new Error('Only student accounts can take quizzes.'), { statusCode: 403 });
  await getQuiz(quizId, userId);
  const { data, error } = await adminSupabase!.from('quiz_attempts').insert({ quiz_id: quizId, student_id: userId }).select('id,started_at').single();
  if (error) throw error;
  return data;
}

export async function submitQuizAttempt(attemptId: string, userId: string, answers: Record<string, number>) {
  const { data: attempt, error: attemptError } = await adminSupabase!.from('quiz_attempts').select('id,quiz_id,started_at,submitted_at').eq('id', attemptId).eq('student_id', userId).single();
  if (attemptError) throw attemptError;
  if (attempt.submitted_at) throw Object.assign(new Error('This quiz attempt has already been submitted.'), { statusCode: 409 });
  const { data: quiz, error: quizError } = await adminSupabase!.from('quizzes').select('time_limit_minutes').eq('id', attempt.quiz_id).single();
  if (quizError) throw quizError;
  if (quiz.time_limit_minutes && Date.now() > new Date(attempt.started_at).getTime() + quiz.time_limit_minutes * 60_000) throw Object.assign(new Error('The quiz time limit has expired.'), { statusCode: 409 });
  const { data: questions, error: questionsError } = await adminSupabase!.from('quiz_questions').select('id').eq('quiz_id', attempt.quiz_id);
  if (questionsError) throw questionsError;
  const questionIds = new Set((questions ?? []).map((question) => question.id));
  if (Object.keys(answers).some((id) => !questionIds.has(id))) throw Object.assign(new Error('The submitted answers include a question outside this quiz.'), { statusCode: 400 });
  const { data: keys, error: keysError } = await adminSupabase!.from('quiz_answer_keys').select('question_id,correct_index,rationale').in('question_id', [...questionIds]);
  if (keysError) throw keysError;
  const correct = (keys ?? []).filter((key) => answers[key.question_id] === key.correct_index).length;
  const score = questionIds.size ? Math.round((correct / questionIds.size) * 10000) / 100 : 0;
  const { error: updateError } = await adminSupabase!.from('quiz_attempts').update({ answers, score, submitted_at: new Date().toISOString() }).eq('id', attemptId).eq('student_id', userId).is('submitted_at', null);
  if (updateError) throw updateError;
  return { score, correct, total: questionIds.size, rationales: keys ?? [] };
}

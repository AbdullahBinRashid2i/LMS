import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './lib/api';

type Course = { id: string; title: string };
type QuestionInput = { prompt: string; options: string[]; correct_index: number; rationale: string };
type QuizItem = { id: string; course_id: string; title: string; time_limit_minutes: number | null; question_count: number; latest_attempt: { score: number | null; submitted_at: string | null } | null; course?: Course };
type QuizDetail = { id: string; title: string; time_limit_minutes: number | null; questions: { id: string; prompt: string; options: string[]; position: number }[] };
type Result = { score: number; correct: number; total: number; rationales: { question_id: string; correct_index: number; rationale: string }[] };
const emptyQuestions = (): QuestionInput[] => Array.from({ length: 5 }, () => ({ prompt: '', options: ['', '', '', ''], correct_index: 0, rationale: '' }));

export default function QuizzesWorkspace({ token, role, courses, userId }: { token: string; role: string; courses: Course[]; userId: string }) {
  const cache = useQueryClient();
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [questions, setQuestions] = useState(emptyQuestions);
  const [active, setActive] = useState<{ quiz: QuizDetail; attemptId: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState('');
  const quizzes = useQuery({ queryKey: ['quizzes', userId], queryFn: () => apiRequest<{ quizzes: QuizItem[] }>('/api/quizzes', token) });
  const create = useMutation({ mutationFn: () => apiRequest('/api/quizzes', token, { method: 'POST', body: JSON.stringify({ course_id: courseId, title, time_limit_minutes: minutes, questions }) }), onSuccess: () => { setTitle(''); setQuestions(emptyQuestions()); setNotice('Quiz published.'); cache.invalidateQueries({ queryKey: ['quizzes'] }); }, onError: (error) => setNotice(error instanceof Error ? error.message : 'Could not create quiz.') });
  const start = useMutation({ mutationFn: async (id: string) => {
    const started = await apiRequest<{ attempt: { id: string; started_at: string } }>(`/api/quizzes/${id}/attempts`, token, { method: 'POST' });
    const detail = await apiRequest<{ quiz: QuizDetail }>(`/api/quizzes/${id}`, token);
    return { quiz: detail.quiz, attemptId: started.attempt.id };
  }, onSuccess: (data) => { setActive(data); setAnswers({}); setResult(null); setSecondsLeft((data.quiz.time_limit_minutes ?? 15) * 60); setNotice(''); }, onError: (error) => setNotice(error instanceof Error ? error.message : 'Could not start quiz.') });
  const submit = useMutation({ mutationFn: () => apiRequest<Result>(`/api/quiz-attempts/${active!.attemptId}/submit`, token, { method: 'POST', body: JSON.stringify({ answers }) }), onSuccess: (data) => { setResult(data); setActive(null); setNotice('Quiz submitted.'); cache.invalidateQueries({ queryKey: ['quizzes', userId] }); cache.invalidateQueries({ queryKey: ['dashboard'] }); }, onError: (error) => setNotice(error instanceof Error ? error.message : 'Could not submit quiz.') });
  useEffect(() => {
    if (!active || result || submit.isPending || submit.isError) return;
    if (secondsLeft <= 0) { submit.mutate(); return; }
    const timer = window.setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [active, result, secondsLeft, submit.isPending]);
  function publishQuiz(event: FormEvent) { event.preventDefault(); setNotice(''); create.mutate(); }
  function updateQuestion(index: number, field: keyof QuestionInput, value: string | number, optionIndex?: number) {
    setQuestions((current) => current.map((question, i) => {
      if (i !== index) return question;
      if (field === 'options' && optionIndex !== undefined) { const options = [...question.options]; options[optionIndex] = String(value); return { ...question, options }; }
      return { ...question, [field]: value } as QuestionInput;
    }));
  }
  const remaining = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  return <div className="section-view"><div className="section-overline">ASSESSMENT STUDIO</div><div className="section-view-head"><div><h1>Quizzes</h1><p>Take timed quizzes or publish instructor-created assessments.</p></div></div>
    {(role === 'teacher' || role === 'admin') && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Create a quiz</h2><p>Add five multiple-choice questions with four options each. Answer keys stay private on the server.</p></div></div>{!courses.length ? <p className="admin-empty">Create a course first in Course management.</p> : <form className="admin-course-form quiz-builder" onSubmit={publishQuiz}><label>Course<select required value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Choose course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Quiz title<input required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>Time limit in minutes<input type="number" min={1} max={240} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}/></label>{questions.map((question, index) => <fieldset className="quiz-question-editor" key={index}><legend>Question {index + 1}</legend><label>Question<input required minLength={3} value={question.prompt} onChange={(event) => updateQuestion(index, 'prompt', event.target.value)}/></label><div className="quiz-option-grid">{question.options.map((option, optionIndex) => <label key={optionIndex}>Option {optionIndex + 1}<input required value={option} onChange={(event) => updateQuestion(index, 'options', event.target.value, optionIndex)}/></label>)}</div><div className="quiz-question-bottom"><label>Correct answer<select value={question.correct_index} onChange={(event) => updateQuestion(index, 'correct_index', Number(event.target.value))}>{question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>)}</select></label><label>Explanation<input value={question.rationale} onChange={(event) => updateQuestion(index, 'rationale', event.target.value)} placeholder="Why is this correct?"/></label></div></fieldset>)}{notice && <div className={create.isError ? 'auth-message' : 'admin-success'}>{notice}</div>}<button className="primary-button" disabled={create.isPending}>{create.isPending ? 'Publishing…' : 'Publish quiz'}</button></form>}</section>}
    {active ? <section className="admin-panel quiz-active"><div className="admin-panel-heading"><div><h2>{active.quiz.title}</h2><p>Choose one answer for every question.</p></div><span className="quiz-timer">{remaining}</span></div>{active.quiz.questions.map((question, index) => <fieldset className="quiz-live-question" key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option, optionIndex) => <label key={optionIndex}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}/>{option}</label>)}</fieldset>)}<button className="primary-button" disabled={submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? 'Submitting…' : 'Submit answers'}</button></section> : result ? <section className="admin-panel quiz-result"><h2>Your score: {result.score}%</h2><p>{result.correct} correct out of {result.total}. Your score is saved to your account.</p>{result.rationales.map((item) => <p key={item.question_id}>{item.rationale || 'Review this question and the correct answer.'}</p>)}</section> : null}
    {notice && !active && !result && <div className={start.isError || submit.isError ? 'auth-message' : 'admin-success'}>{notice}</div>}
    {quizzes.isLoading ? <p className="admin-empty">Loading quizzes…</p> : quizzes.isError ? <div className="auth-message">Could not load quizzes. Check the database migration.</div> : quizzes.data?.quizzes.length ? <div className="quiz-list">{quizzes.data.quizzes.map((quiz) => <article className="assignment-card" key={quiz.id}><div className="assignment-card-head"><div><span className="course-code">{quiz.course?.title ?? 'COURSE'}</span><h2>{quiz.title}</h2></div><span className="score-chip">{quiz.question_count} questions</span></div><p>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} minute time limit` : 'No time limit'}{quiz.latest_attempt?.submitted_at ? ` · Latest score ${quiz.latest_attempt.score ?? 0}%` : ''}</p>{role === 'student' && <button className="primary-button" disabled={start.isPending || Boolean(active)} onClick={() => start.mutate(quiz.id)}>{start.isPending ? 'Starting…' : quiz.latest_attempt?.submitted_at ? 'Take again' : 'Start quiz'}</button>}</article>)}</div> : <div className="feature-placeholder"><h2>No quizzes yet</h2><p>Quizzes for your courses will be listed here.</p></div>}
  </div>;
}


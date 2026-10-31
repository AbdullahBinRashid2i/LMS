import { z } from 'zod';

export const ticketSchema = z.object({
  subject: z.string().trim().min(4).max(120),
  message: z.string().trim().min(10).max(5000),
  category: z.enum(['technical', 'billing', 'grading', 'other']),
});
export type TicketInput = z.infer<typeof ticketSchema>;

export const courseSchema = z.object({ title: z.string().trim().min(3).max(120), description: z.string().trim().max(3000).optional() });
export const roleSchema = z.object({ role: z.enum(['student', 'teacher']) });
export const studySessionSchema = z.object({ course_id: z.string().uuid().nullable().optional() });
export const enrollmentSchema = z.union([z.object({ student_id: z.string().uuid() }).strict(), z.object({ student_email: z.string().trim().email().max(320) }).strict()]);
export const assignmentSchema = z.object({ course_id: z.string().uuid(), title: z.string().trim().min(3).max(160), description: z.string().trim().max(5000).optional(), due_date: z.string().datetime(), max_marks: z.number().int().min(1).max(10000).default(100) });
export const submissionSchema = z.object({ file_path: z.string().trim().min(1).max(1024) });
export const gradeSchema = z.object({ marks: z.number().min(0).max(10000), feedback: z.string().trim().max(5000).optional() });
export const quizSchema = z.object({ course_id: z.string().uuid(), title: z.string().trim().min(3).max(160), time_limit_minutes: z.number().int().min(1).max(240).nullable().optional(), questions: z.array(z.object({ prompt: z.string().trim().min(3).max(2000), options: z.array(z.string().trim().min(1).max(500)).length(4), correct_index: z.number().int().min(0).max(3), rationale: z.string().trim().max(2000).optional() })).min(1).max(15) });
export const quizAnswersSchema = z.object({ answers: z.record(z.string().uuid(), z.number().int().min(0).max(3)) });

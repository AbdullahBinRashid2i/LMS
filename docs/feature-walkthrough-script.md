# GUTech Portal walkthrough recording plan (about 4 minutes)

Record only after the Supabase migrations are applied and both production URLs work. Use test accounts and sample course data; do not show passwords, email confirmation links, API keys, or Supabase service-role values.

## 0:00–0:25 — Introduction

**Show:** The deployed GUTech portal landing/dashboard.

**Say:** “This is the GUTech Student and Faculty Portal, a React frontend with a Node.js API, Supabase authentication, and a Supabase PostgreSQL database. I’ll show the student and administrator workflows.”

## 0:25–1:00 — Sign-in and account-specific dashboard

**Show:** Sign in with a student test account; point out the account name, course count, hours, scores, and upcoming work. If there is a second seeded account, switch to it and show its own data.

**Say:** “Authentication is handled by Supabase. Dashboard metrics come from the signed-in user’s records, so accounts see their own courses and activity.”

## 1:00–1:45 — Administrator and enrollment

**Show:** Sign in as the admin test account, open **Administration**, change a test account between student and teacher, then enroll a student in a course.

**Say:** “The admin area is role-gated. Administrators can manage account roles and enroll students. Teachers can manage their own courses and enroll a student using the email registered to the portal.”

## 1:45–2:45 — Learning workflows

**Show:** Open a course, create or open an assignment, submit a sample file as the student, show grading as the teacher, then take a short quiz and show its score.

**Say:** “Course work is stored in Supabase. Private files use the course storage bucket, and quiz scoring happens on the server so answer keys are not sent to students.”

## 2:45–3:20 — Other portal areas

**Show:** Open resources, announcements/chat, and Help Desk. Start and finish a short study timer. Mention the database-connected health state.

**Say:** “The prototype also includes private course resources, announcements, course chat, student support tickets, and server-timed study sessions.”

## 3:20–4:00 — AI-assisted workflow and architecture

**Show:** Briefly show the repository folders, Supabase migration files, README setup/deployment instructions, and the AI-assisted code/review workflow used during development.

**Say:** “AI assistance was used to accelerate scaffolding, implementation, and review. The app is organized into separate Frontend and Backend folders, and Supabase row-level policies protect access. AI tutoring and other AI learning features are future work in this prototype.”

**End card:** Display the public GitHub repository URL and live deployment URL after those URLs exist.
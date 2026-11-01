# GUTech Student & Faculty Portal

A responsive React and Node.js learning portal prototype for GUTech students, instructors, and administrators. Supabase provides authentication, PostgreSQL data, private file storage, and row-level access control.

## Live preview

Public Vercel deployment: https://gutech-lms-portal-two.vercel.app/.

The frontend and Node API are deployed on Vercel. To activate live data, run all three Supabase migrations in `Backend/supabase/migrations/` and set the API's private `SUPABASE_SERVICE_ROLE_KEY` environment variable in Vercel. Until both steps are complete, the site will show a database setup notice.

## Project layout

- `Frontend/` — React 18, TypeScript, Vite, TanStack Query, Supabase Auth, responsive UI.
- `Backend/` — Node.js, Express, TypeScript, Zod validation, Supabase JWT verification, server-only Supabase service client.
- `Backend/supabase/migrations/` — database schema, role-based row-level security, storage policies, realtime configuration.
- `Backend/src/app.ts` — shared Express app for local and Vercel hosting.
- `docs/feature-walkthrough-script.md` — 3–5 minute recording plan.

## Features in this prototype

- Email/password signup, sign-in, and password recovery through Supabase Auth.
- Per-account dashboard metrics and course lists.
- Admin account directory, student/teacher role management, course creation, and enrollment.
- Teacher course management, assignment creation, submissions, and grading.
- Timed quizzes with server-side scoring and private answer keys.
- Private course files, announcements, course chat, support tickets, and server-timed study sessions.

**AI limitation:** AI tutoring, document summaries, generated quizzes, automated grading feedback, ticket triage, and personalized remediation are not implemented yet. Setting an AI provider key alone will not enable those workflows. Do not describe these as available in the submission demo.

## Requirements

Node.js 20 or newer and npm. A Supabase project is required for authentication and live data.

## Local setup

1. Copy `Frontend/.env.example` to `Frontend/.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable/anon key)
   - `VITE_API_URL=http://localhost:4000`
2. Copy `Backend/.env.example` to `Backend/.env` and set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; never add this to the frontend or GitHub)
   - `FRONTEND_URL=http://localhost:5173`
3. In Supabase Dashboard → **SQL Editor**, run these files in order:
   1. `Backend/supabase/migrations/202610300001_initial_schema.sql`
   2. `Backend/supabase/migrations/202610300002_live_lms.sql`
   3. `Backend/supabase/migrations/202611010001_explicit_data_api_grants.sql`
4. In separate terminal windows:
   - `cd Backend`, then `npm ci`, then `npm run dev` (API at `http://localhost:4000`).
   - `cd Frontend`, then `npm ci`, then `npm run dev` (site at `http://localhost:5173`).
5. Open `http://localhost:4000/health`. A working schema should report `connected.database: true`.

### First administrator

There is no default admin password. Sign up and confirm your own account first. In Supabase SQL Editor, run `Backend/supabase/bootstrap_first_admin.sql` after replacing both occurrences of `REPLACE_WITH_YOUR_LOGIN_EMAIL` with that account’s email. Sign out and back in; the Administration navigation appears for that account. New accounts start as students; an admin can promote a student to teacher.

## Production deployment

The public frontend and Express API use separate Vercel projects connected to this GitHub repository.

### Activate Supabase

1. In Supabase Dashboard → **SQL Editor**, run these SQL files in order: `Backend/supabase/migrations/202610300001_initial_schema.sql`, `Backend/supabase/migrations/202610300002_live_lms.sql`, then `Backend/supabase/migrations/202611010001_explicit_data_api_grants.sql`.
2. In Vercel, open the `gutech-lms-api` project → **Settings → Environment Variables**.
3. Add `SUPABASE_SERVICE_ROLE_KEY` as a **Sensitive** variable for **Production**. Get the private service_role/secret key from Supabase Dashboard → **Project Settings → API Keys**. Keep it only in the backend project; never add it to GitHub, the frontend project, or a chat message.
4. Redeploy the API. Check `https://gutech-lms-api-puce.vercel.app/health`; the response should show `connected.database: true`.

The backend project also needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `FRONTEND_URL`. The URL and publishable/anon key have been configured; `FRONTEND_URL` should equal the Vercel frontend origin. The frontend project needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL=https://gutech-lms-api-puce.vercel.app`.

### Smoke-check before recording

- Confirm `/health` reports `connected.database: true`.
- Sign in as the administrator and open **Administration**.
- Create a student and teacher test account; verify the admin can change the role and enroll the student.
- Sign in as the student and confirm the dashboard/course data reflects that account.
- Try one assignment submission and one quiz attempt.
- Do not include passwords, service-role keys, or other secrets in the video or public repository.

## Git safety

The root `.gitignore` excludes `.env`, `.env.local`, dependencies, and build output. Before the first push, verify only `.env.example` files (with placeholders) are included. Never commit live Supabase keys.

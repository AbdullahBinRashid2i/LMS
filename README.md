# GUTech Student & Faculty Portal

A responsive React and Node.js learning portal prototype for GUTech students, instructors, and administrators. Supabase provides authentication, PostgreSQL data, private file storage, and row-level access control.

## Project layout

- `Frontend/` — React 18, TypeScript, Vite, TanStack Query, Supabase Auth, responsive UI.
- `Backend/` — Node.js, Express, TypeScript, Zod validation, Supabase JWT verification, server-only Supabase service client.
- `Backend/supabase/migrations/` — database schema, role-based row-level security, storage policies, realtime configuration.
- `render.yaml` — Render blueprint for the backend API.
- `Frontend/vercel.json` — Vercel SPA route fallback.
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
4. In separate terminal windows:
   - `cd Backend`, then `npm ci`, then `npm run dev` (API at `http://localhost:4000`).
   - `cd Frontend`, then `npm ci`, then `npm run dev` (site at `http://localhost:5173`).
5. Open `http://localhost:4000/health`. A working schema should report `connected.database: true`.

### First administrator

There is no default admin password. Sign up and confirm your own account first. In Supabase SQL Editor, run `Backend/supabase/bootstrap_first_admin.sql` after replacing both occurrences of `REPLACE_WITH_YOUR_LOGIN_EMAIL` with that account’s email. Sign out and back in; the Administration navigation appears for that account. New accounts start as students; an admin can promote a student to teacher.

## Production deployment

The repository is configured for a Vercel frontend and Render API deployment.

### 1. Deploy the API to Render

1. First apply both Supabase migration files above in the same production Supabase project; the API health endpoint intentionally returns an error until the schema exists.
1. Push this repository to GitHub and keep the repository root as the Blueprint location.
2. In Render, choose **New → Blueprint**, select the repository, and approve the `render.yaml` service.
3. In the API service’s Environment settings, provide `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Use the Supabase project URL and keys for the same project where the migrations were run. Keep the service role key only in Render.
4. Deploy and check `https://<your-render-api>/health`.

### 2. Deploy the frontend to Vercel

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `Frontend`; Vercel will use its Vite build and `dist` output.
3. Add these Production environment variables:
   - `VITE_SUPABASE_URL` — same Supabase project URL.
   - `VITE_SUPABASE_ANON_KEY` — publishable/anon key only.
   - `VITE_API_URL` — the full Render API origin, for example `https://your-api.onrender.com` (no trailing slash).
4. Deploy and copy the Vercel production URL.
5. Set Render `FRONTEND_URL` to that exact Vercel origin, redeploy the API, then add the Vercel origin to Supabase Auth → **URL Configuration** → Site URL and Redirect URLs. Include the password-reset route as appropriate.

### 3. Smoke-check before recording

- Confirm `/health` reports `connected.database: true`.
- Sign in as the administrator and open **Administration**.
- Create a student and teacher test account; verify the admin can change the role and enroll the student.
- Sign in as the student and confirm the dashboard/course data reflects that account.
- Try one assignment submission and one quiz attempt.
- Do not include passwords, service-role keys, or other secrets in the video or public repository.

## Git safety

The root `.gitignore` excludes `.env`, `.env.local`, dependencies, and build output. Before the first push, verify only `.env.example` files (with placeholders) are included. Never commit live Supabase keys.

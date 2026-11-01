# GUTech Portal walkthrough recording plan (about 4 minutes)

Before recording:
1. Confirm the API health page shows Supabase configured and database connected: https://gutech-lms-api-puce.vercel.app/health
2. Create and confirm test student and teacher accounts. Follow the first-admin setup in `Backend/supabase/bootstrap_first_admin.sql` to promote your own confirmed account to admin. Never show passwords, confirmation links, API keys, or service-role values.
3. Add a sample course, enroll the student, and create a sample assignment/quiz so the screens contain data.

## 0:00–0:25 — Introduction

**Show:** The deployed GUTech portal.

**Say:** “This is the GUTech Student and Faculty Portal, built with React, a Node.js API, Supabase authentication, and a Supabase database. I’ll show how a student and administrator use it.”

## 0:25–1:00 — Sign-in and student dashboard

**Show:** Sign in to the student test account. Point out its name and the courses or activity you prepared.

**Say:** “Supabase verifies the account, and the portal loads that user’s saved records. The database keeps the information between visits and keeps each account’s data tied to the right user.”

## 1:00–1:45 — Admin and enrollment

**Show:** Sign in to your admin account, open **Administration**, show the account list, and enroll your test student in the sample course. If available, show changing the separate test account to teacher.

**Say:** “The admin area is available to accounts granted the admin role. Administrators can manage portal roles and enrollments. The admin account is created by promoting a confirmed account; there is no shared default admin password.”

## 1:45–2:45 — Learning workflows

**Show:** Open the sample course, submit a sample assignment as the student, then show the submission/grading view as the teacher. Take the sample quiz and show the result if time allows.

**Say:** “Course activity is saved in Supabase. Private course files use protected storage, and quiz scoring is handled by the server.”

## 2:45–3:20 — Other portal areas

**Show:** Briefly show resources, announcements or chat, Help Desk, and the study timer only if each area has sample data and works in your demo.

**Say:** “The prototype includes additional course and student-support areas. The live health check also confirms that the API can reach the database.”

## 3:20–4:00 — AI-assisted workflow and architecture

**Show:** The repository’s Frontend and Backend folders, Supabase migrations, README setup instructions, and a brief example of the AI-assisted development/review process.

**Say:** “AI assistance helped accelerate implementation and review. The project separates the React frontend from the Node.js backend, and Supabase policies control access to saved data. AI tutoring and other AI learning features are future work.”

**End card:**
- Live portal: https://gutech-lms-portal-two.vercel.app/
- GitHub repository: https://github.com/AbdullahBinRashid2i/LMS

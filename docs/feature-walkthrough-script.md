# NotebookLM video script: GUTech Student & Faculty Portal

**Target length:** 3–4 minutes  
**Format:** polished project explainer with narrated screenshots or short screen captures  
**Audience:** instructors and evaluators who have not seen the project  
**Tone:** clear, confident, student-presenter voice; explain technical terms simply  
**Accuracy:** describe only features shown working in the supplied sources. Do not invent usage numbers, sample users, or features.

## Paste this direction into NotebookLM

Create a concise, polished explainer video introducing the GUTech Student & Faculty Portal. Use a modern university technology aesthetic, readable labels, calm pacing, and clear narration. Use the supplied portal screenshots or screen captures as the visual source of truth; do not fabricate interface screens. Explain the student, teacher, and administrator workspaces, how Supabase stores account-specific information, and how the React frontend connects to the Node.js API. Keep AI tutoring clearly identified as future work. End with the live portal and GitHub repository links.

## Before generating

Add this script and the project README as sources. Also add real screenshots or short screen captures of:
- The student dashboard with a test account signed in
- The teacher workspace
- The administrator dashboard and **Administration** page
- A real course or assignment workflow, if available

The live site and database health page can be shown as links or end-card text, but a URL alone may not provide NotebookLM with reliable visuals. Do not include passwords, confirmation emails, API keys, or service-role keys in sources or recordings.

## Narration and visual plan

### Scene 1 — Meet the portal (0:00–0:25)

**Visual:** Open with the GUTech portal title, then a supplied screenshot of the live portal.

**Narration:**  
“Welcome to the GUTech Student and Faculty Portal, a learning platform prototype for students, teachers, and administrators. It brings course activity and support tools into one place, with a different workspace for each role.”

### Scene 2 — Student workspace (0:25–0:55)

**Visual:** Show the signed-in student home screen and a real course or assignment. Use a test account with sample data.

**Narration:**  
“Students can sign in to see their own courses, upcoming work, quizzes, resources, announcements, and study tools. Their dashboard is connected to their account, so the information comes from saved portal data instead of a shared sample profile.”

### Scene 3 — Teacher workspace (0:55–1:30)

**Visual:** Show the teacher role label, faculty home screen, course management, and assignment or grading view, if configured.

**Narration:**  
“Teachers get a faculty workspace focused on teaching. From course management and assignments, they can organize course activity and review student work. The teacher view is separate from the student experience.”

### Scene 4 — Administrator workspace (1:30–2:05)

**Visual:** Show the administrator role label, distinct admin home screen, then open **Administration** and show account roles or enrollment controls.

**Narration:**  
“Administrators have a separate control center for portal management. The Administration area provides account and role controls, while course tools support course setup and enrollment. Access depends on the signed-in account’s administrator role; there is no shared default admin password.”

### Scene 5 — How the data is connected (2:05–2:40)

**Visual:** Show the API health page briefly, then a simple diagram: React frontend → Node.js API → Supabase authentication and database. Show the health result only if it currently reports the database as connected.

**Narration:**  
“The portal uses Supabase to authenticate accounts and store information such as profiles, courses, and learning activity. The React frontend communicates with a Node.js API, which connects to Supabase. This lets the portal load saved information for the signed-in account.”

### Scene 6 — Architecture and honest scope (2:40–3:20)

**Visual:** Show the repository’s Frontend and Backend folders, migration files, and README. Keep screens readable and do not show secret environment values.

**Narration:**  
“The code is organized into a React frontend and a Node.js backend, with Supabase migrations defining the database setup. This is a working prototype. AI tutoring, generated quizzes, and other AI learning features are future work and are not presented as active features.”

### Scene 7 — Close (3:20–3:35)

**Visual:** End card with the project name, portal URL, and GitHub repository.

**Narration:**  
“This is the GUTech Student and Faculty Portal: one connected platform with distinct student, teacher, and administrator experiences.”

**End card links:**
- Live portal: https://gutech-lms-portal-two.vercel.app/
- API health: https://gutech-lms-api-puce.vercel.app/health
- GitHub repository: https://github.com/AbdullahBinRashid2i/LMS

## Final review checklist

Before sharing the generated video, check that:
- It uses the real supplied interface images and labels all three roles correctly.
- No text claims AI tutoring is already available.
- The database connection is described as confirmed only if the health page still reports `connected.database: true`.
- No private credentials, user passwords, or personal student information are visible.
- The live portal and repository links are readable on the end card.

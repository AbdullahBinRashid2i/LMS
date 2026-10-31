-- Live dashboard activity and access hardening. Apply after 202610300001_initial_schema.sql.
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.study_sessions add column if not exists finished_at timestamptz;
alter table public.study_sessions alter column duration_seconds set default 0;
update public.study_sessions set duration_seconds = least(greatest(duration_seconds, 0), 14400), finished_at = coalesce(finished_at, created_at) where finished_at is null or duration_seconds < 0 or duration_seconds > 14400;
alter table public.study_sessions drop constraint if exists study_sessions_duration_seconds_check;
alter table public.study_sessions add constraint study_sessions_duration_seconds_check check (duration_seconds between 0 and 14400);
create index if not exists study_sessions_student_created_idx on public.study_sessions(student_id, created_at desc);
create unique index if not exists study_sessions_one_open_per_student_idx on public.study_sessions(student_id) where finished_at is null;
alter table public.study_sessions enable row level security;
drop policy if exists "study_sessions_read_owner_or_staff" on public.study_sessions;
drop policy if exists "study_sessions_insert_self" on public.study_sessions;
drop policy if exists "study_sessions_finish_self" on public.study_sessions;
create policy "study_sessions_read_owner_or_staff" on public.study_sessions for select to authenticated
  using (student_id = (select auth.uid()) or public.current_role() = 'admin' or
    (course_id is not null and public.can_manage_course(course_id)));
create policy "study_sessions_insert_self" on public.study_sessions for insert to authenticated
  with check (student_id = (select auth.uid()) and duration_seconds = 0 and finished_at is null and (course_id is null or public.is_course_member(course_id)));
create policy "study_sessions_finish_self" on public.study_sessions for update to authenticated
  using (student_id = (select auth.uid()) and finished_at is null) with check (student_id = (select auth.uid()));
revoke insert, update on public.study_sessions from authenticated;
grant insert (student_id, course_id) on public.study_sessions to authenticated;

-- Course managers must own the course; enrollment alone grants read access only.
drop policy if exists "enrollments_read_self_or_staff" on public.course_enrollments;
create policy "enrollments_read_self_or_staff" on public.course_enrollments for select to authenticated using (student_id = (select auth.uid()) or public.can_manage_course(course_id));
drop policy if exists "submissions_read_owner_or_staff" on public.assignment_submissions;
create policy "submissions_read_owner_or_staff" on public.assignment_submissions for select to authenticated using (student_id = (select auth.uid()) or exists(select 1 from public.assignments a where a.id = assignment_id and public.can_manage_course(a.course_id)));
drop policy if exists "attempts_read_owner_or_staff" on public.quiz_attempts;
create policy "attempts_read_owner_or_staff" on public.quiz_attempts for select to authenticated using (student_id = (select auth.uid()) or exists(select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id)));
drop policy if exists "enrollments_manage_staff" on public.course_enrollments;
create policy "enrollments_manage_staff" on public.course_enrollments for all to authenticated using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));
drop policy if exists "resources_manage_staff" on public.resources;
create policy "resources_manage_staff" on public.resources for all to authenticated using (uploaded_by = (select auth.uid()) and public.can_manage_course(course_id)) with check (uploaded_by = (select auth.uid()) and public.can_manage_course(course_id));
drop policy if exists "assignments_manage_staff" on public.assignments;
create policy "assignments_manage_staff" on public.assignments for all to authenticated using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));
drop policy if exists "submissions_grade_staff" on public.assignment_submissions;
create policy "submissions_grade_staff" on public.assignment_submissions for update to authenticated using (exists(select 1 from public.assignments a where a.id = assignment_id and public.can_manage_course(a.course_id))) with check (exists(select 1 from public.assignments a where a.id = assignment_id and public.can_manage_course(a.course_id)));
drop policy if exists "quizzes_manage_staff" on public.quizzes;
create policy "quizzes_manage_staff" on public.quizzes for all to authenticated using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));
drop policy if exists "questions_manage_staff" on public.quiz_questions;
create policy "questions_manage_staff" on public.quiz_questions for all to authenticated using (exists(select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id))) with check (exists(select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id)));
drop policy if exists "answers_read_staff" on public.quiz_answer_keys;
create policy "answers_read_staff" on public.quiz_answer_keys for select to authenticated using (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and public.can_manage_course(q.course_id)));
drop policy if exists "answers_manage_staff" on public.quiz_answer_keys;
create policy "answers_manage_staff" on public.quiz_answer_keys for all to authenticated using (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and public.can_manage_course(q.course_id))) with check (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and public.can_manage_course(q.course_id)));
drop policy if exists "announcements_read_members" on public.announcements;
create policy "announcements_read_members" on public.announcements for select to authenticated using (course_id is null or public.is_course_member(course_id));
drop policy if exists "announcements_manage_staff" on public.announcements;
create policy "announcements_manage_staff" on public.announcements for all to authenticated using (public.current_role() = 'admin' or (course_id is not null and public.can_manage_course(course_id))) with check (public.current_role() = 'admin' or (course_id is not null and public.can_manage_course(course_id)));
drop policy if exists "course_materials_upload_teacher" on storage.objects;
drop policy if exists "course_materials_update_teacher" on storage.objects;
drop policy if exists "course_materials_delete_teacher" on storage.objects;
create policy "course_materials_upload_teacher" on storage.objects for insert to authenticated with check (bucket_id = 'course-materials' and public.can_manage_course(public.try_uuid((storage.foldername(name))[1])));
create policy "course_materials_update_teacher" on storage.objects for update to authenticated using (bucket_id = 'course-materials' and public.can_manage_course(public.try_uuid((storage.foldername(name))[1]))) with check (bucket_id = 'course-materials' and public.can_manage_course(public.try_uuid((storage.foldername(name))[1])));
create policy "course_materials_delete_teacher" on storage.objects for delete to authenticated using (bucket_id = 'course-materials' and public.can_manage_course(public.try_uuid((storage.foldername(name))[1])));

-- Students may update only their visible profile fields, never role or email.
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = public.current_role());
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- Students can upload only into their own submission folder inside an enrolled course.
drop policy if exists "assignment_files_upload_self" on storage.objects;
create policy "assignment_files_upload_self" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-materials'
    and public.current_role() = 'student'
    and (storage.foldername(name))[2] = 'submissions'
    and (storage.foldername(name))[3] = (select auth.uid())::text
    and public.is_course_member(public.try_uuid((storage.foldername(name))[1])));
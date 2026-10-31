-- GUTech Learn LMS schema. Apply this in the Supabase SQL Editor.
create extension if not exists "pgcrypto";
do $$ begin create type public.user_role as enum ('admin','teacher','student'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_status as enum ('open','in_progress','resolved','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.announcement_priority as enum ('general','exam','urgent'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_category as enum ('technical','billing','grading','other'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, email text not null unique,
 role public.user_role not null default 'student', full_name text not null default '', avatar_url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.courses (
 id uuid primary key default gen_random_uuid(), title text not null, description text,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.course_enrollments (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, enrolled_at timestamptz not null default now(), unique(course_id,student_id)
);
create table if not exists public.resources (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 title text not null, file_url text not null, ai_summary jsonb, uploaded_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.assignments (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 title text not null, description text, due_date timestamptz not null, max_marks int not null default 100 check (max_marks > 0), created_at timestamptz not null default now()
);
create table if not exists public.assignment_submissions (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, submission_file text not null,
 marks numeric(5,2) check (marks is null or marks >= 0), feedback text, ai_evaluation jsonb,
 submitted_at timestamptz not null default now(), unique(assignment_id,student_id)
);
create table if not exists public.quizzes (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 title text not null, time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
-- Keep answer keys out of the question rows exposed to enrolled students.
create table if not exists public.quiz_questions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 prompt text not null, options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
 position int not null default 0
);
create table if not exists public.quiz_answer_keys (
 question_id uuid primary key references public.quiz_questions(id) on delete cascade,
 correct_index smallint not null check (correct_index between 0 and 3), rationale text
);
create table if not exists public.quiz_attempts (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, answers jsonb not null default '{}',
 score numeric(5,2), submitted_at timestamptz, started_at timestamptz not null default now()
);
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(), course_id uuid references public.courses(id) on delete cascade,
 title text not null, body text not null, priority public.announcement_priority not null default 'general',
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.chat_messages (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade, body text not null check (char_length(body) between 1 and 5000),
 is_ai boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
 subject text not null check (char_length(subject) between 4 and 120), message text not null check (char_length(message) between 10 and 5000),
 category public.ticket_category not null, status public.ticket_status not null default 'open', sentiment numeric(3,2) check (sentiment is null or sentiment between -1 and 1),
 ai_draft text, assigned_to uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists enrollments_student_idx on public.course_enrollments(student_id);
create index if not exists resources_course_idx on public.resources(course_id);
create index if not exists assignments_course_due_idx on public.assignments(course_id,due_date);
create index if not exists announcements_created_idx on public.announcements(created_at desc);
create index if not exists chat_course_created_idx on public.chat_messages(course_id,created_at);
create index if not exists tickets_student_created_idx on public.support_tickets(student_id,created_at desc);

create or replace function public.try_uuid(value text) returns uuid language plpgsql immutable set search_path = '' as $$ begin return value::uuid; exception when invalid_text_representation then return null; end; $$;

create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path = '' as $$ select role from public.profiles where id = (select auth.uid()) $$;
create or replace function public.is_course_member(target_course uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.course_enrollments e where e.course_id = target_course and e.student_id = (select auth.uid())) or exists(select 1 from public.courses c where c.id = target_course and c.created_by = (select auth.uid())) or public.current_role() = 'admin' $$;
create or replace function public.can_manage_course(target_course uuid) returns boolean language sql stable security definer set search_path = '' as $$ select public.current_role() = 'admin' or exists(select 1 from public.courses c where c.id = target_course and c.created_by = (select auth.uid()) and public.current_role() = 'teacher') $$;

create or replace function public.provision_profile() returns trigger language plpgsql security definer set search_path = '' as $$ begin insert into public.profiles(id,email,full_name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name','')) on conflict (id) do update set email = excluded.email; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.provision_profile();
-- If the schema is installed after Auth users already exist, provision their profiles too.
insert into public.profiles(id,email,full_name)
select id,email,coalesce(raw_user_meta_data->>'full_name','') from auth.users
on conflict (id) do update set email = excluded.email;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.resources enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.announcements enable row level security;
alter table public.chat_messages enable row level security;
alter table public.support_tickets enable row level security;

-- Re-running this starter migration refreshes the known policy set cleanly.
drop policy if exists "profiles_read_self_or_staff" on public.profiles;
drop policy if exists "profiles_read_course_relationships" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "courses_read_members" on public.courses;
drop policy if exists "courses_manage_staff" on public.courses;
drop policy if exists "enrollments_read_self_or_staff" on public.course_enrollments;
drop policy if exists "enrollments_manage_staff" on public.course_enrollments;
drop policy if exists "resources_read_members" on public.resources;
drop policy if exists "resources_manage_staff" on public.resources;
drop policy if exists "assignments_read_members" on public.assignments;
drop policy if exists "assignments_manage_staff" on public.assignments;
drop policy if exists "submissions_read_owner_or_staff" on public.assignment_submissions;
drop policy if exists "submissions_insert_self_before_deadline" on public.assignment_submissions;
drop policy if exists "submissions_update_owner_before_deadline" on public.assignment_submissions;
drop policy if exists "submissions_grade_staff" on public.assignment_submissions;
drop policy if exists "quizzes_read_members" on public.quizzes;
drop policy if exists "quizzes_manage_staff" on public.quizzes;
drop policy if exists "questions_read_members" on public.quiz_questions;
drop policy if exists "questions_manage_staff" on public.quiz_questions;
drop policy if exists "answers_read_staff" on public.quiz_answer_keys;
drop policy if exists "answers_manage_staff" on public.quiz_answer_keys;
drop policy if exists "attempts_read_owner_or_staff" on public.quiz_attempts;
drop policy if exists "attempts_insert_self" on public.quiz_attempts;
drop policy if exists "attempts_update_self" on public.quiz_attempts;
drop policy if exists "announcements_read_members" on public.announcements;
drop policy if exists "announcements_manage_staff" on public.announcements;
drop policy if exists "chat_read_members" on public.chat_messages;
drop policy if exists "chat_insert_self" on public.chat_messages;
drop policy if exists "tickets_read_owner_or_staff" on public.support_tickets;
drop policy if exists "tickets_insert_self" on public.support_tickets;
drop policy if exists "tickets_update_staff" on public.support_tickets;

create policy "profiles_read_course_relationships" on public.profiles for select to authenticated using (
 id = (select auth.uid())
 or public.current_role() = 'admin'
 or exists (
   select 1 from public.course_enrollments own_enrollment
   join public.courses c on c.id = own_enrollment.course_id
   where own_enrollment.student_id = (select auth.uid()) and c.created_by = public.profiles.id
 )
 or public.current_role() = 'teacher' and exists (
   select 1 from public.course_enrollments roster
   join public.courses c on c.id = roster.course_id
   where roster.student_id = public.profiles.id and c.created_by = (select auth.uid())
 )
);
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = public.current_role());
create policy "courses_read_members" on public.courses for select to authenticated using (public.is_course_member(id));
create policy "courses_manage_staff" on public.courses for all to authenticated using ((created_by = (select auth.uid()) and public.current_role() in ('teacher','admin')) or public.current_role() = 'admin') with check ((created_by = (select auth.uid()) and public.current_role() in ('teacher','admin')) or public.current_role() = 'admin');
create policy "enrollments_read_self_or_staff" on public.course_enrollments for select to authenticated using (student_id = (select auth.uid()) or public.can_manage_course(course_id));
create policy "enrollments_manage_staff" on public.course_enrollments for all to authenticated using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));
create policy "resources_read_members" on public.resources for select to authenticated using (public.is_course_member(course_id));
create policy "resources_manage_staff" on public.resources for all to authenticated using (uploaded_by = (select auth.uid()) and public.can_manage_course(course_id)) with check (uploaded_by = (select auth.uid()) and public.can_manage_course(course_id));
create policy "assignments_read_members" on public.assignments for select to authenticated using (public.is_course_member(course_id));
create policy "assignments_manage_staff" on public.assignments for all to authenticated using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));
create policy "submissions_read_owner_or_staff" on public.assignment_submissions for select to authenticated using (student_id = (select auth.uid()) or exists(select 1 from public.assignments a where a.id = assignment_id and public.can_manage_course(a.course_id)));
create policy "submissions_insert_self_before_deadline" on public.assignment_submissions for insert to authenticated with check (student_id = (select auth.uid()) and exists(select 1 from public.assignments a where a.id = assignment_id and public.is_course_member(a.course_id) and now() <= a.due_date));
create policy "submissions_update_owner_before_deadline" on public.assignment_submissions for update to authenticated using (student_id = (select auth.uid()) and exists(select 1 from public.assignments a where a.id = assignment_id and now() <= a.due_date)) with check (student_id = (select auth.uid()) and exists(select 1 from public.assignments a where a.id = assignment_id and now() <= a.due_date));
create policy "submissions_grade_staff" on public.assignment_submissions for update to authenticated using (exists(select 1 from public.assignments a where a.id = assignment_id and public.can_manage_course(a.course_id))) with check (exists(select 1 from public.assignments a where a.id = assignment_id and public.can_manage_course(a.course_id)));
create policy "quizzes_read_members" on public.quizzes for select to authenticated using (public.is_course_member(course_id));
create policy "quizzes_manage_staff" on public.quizzes for all to authenticated using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));
create policy "questions_read_members" on public.quiz_questions for select to authenticated using (exists(select 1 from public.quizzes q where q.id = quiz_id and public.is_course_member(q.course_id)));
create policy "questions_manage_staff" on public.quiz_questions for all to authenticated using (exists(select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id))) with check (exists(select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id)));
create policy "answers_read_staff" on public.quiz_answer_keys for select to authenticated using (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and public.can_manage_course(q.course_id)));
create policy "answers_manage_staff" on public.quiz_answer_keys for all to authenticated using (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and public.can_manage_course(q.course_id))) with check (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and public.can_manage_course(q.course_id)));
create policy "attempts_read_owner_or_staff" on public.quiz_attempts for select to authenticated using (student_id = (select auth.uid()) or exists(select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id)));
create policy "attempts_insert_self" on public.quiz_attempts for insert to authenticated with check (student_id = (select auth.uid()) and public.is_course_member((select course_id from public.quizzes where id = quiz_id)));
create policy "attempts_update_self" on public.quiz_attempts for update to authenticated using (student_id = (select auth.uid()) and submitted_at is null) with check (student_id = (select auth.uid()));
create policy "announcements_read_members" on public.announcements for select to authenticated using (course_id is null or public.is_course_member(course_id));
create policy "announcements_manage_staff" on public.announcements for all to authenticated using (public.current_role() = 'admin' or (course_id is not null and public.can_manage_course(course_id))) with check (public.current_role() = 'admin' or (course_id is not null and public.can_manage_course(course_id)));
create policy "chat_read_members" on public.chat_messages for select to authenticated using (public.is_course_member(course_id));
create policy "chat_insert_self" on public.chat_messages for insert to authenticated with check (author_id = (select auth.uid()) and public.is_course_member(course_id) and is_ai = false);
create policy "tickets_read_owner_or_staff" on public.support_tickets for select to authenticated using (student_id = (select auth.uid()) or public.current_role() = 'admin');
create policy "tickets_insert_self" on public.support_tickets for insert to authenticated with check (student_id = (select auth.uid()));
create policy "tickets_update_staff" on public.support_tickets for update to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- Keep grades server-managed. Students can only replace their submission object before its deadline.
revoke insert, update on public.assignment_submissions from authenticated;
grant insert (assignment_id, student_id, submission_file) on public.assignment_submissions to authenticated;
grant update (submission_file) on public.assignment_submissions to authenticated;
revoke insert, update on public.quiz_attempts from authenticated;
grant insert (quiz_id, student_id, answers) on public.quiz_attempts to authenticated;
grant update (answers, submitted_at) on public.quiz_attempts to authenticated;

-- Private course files; first storage path segment is the course UUID.
insert into storage.buckets (id, name, public, file_size_limit) values ('course-materials','course-materials',false,52428800) on conflict (id) do nothing;
drop policy if exists "course_materials_read_member" on storage.objects;
drop policy if exists "course_materials_upload_teacher" on storage.objects;
drop policy if exists "course_materials_update_teacher" on storage.objects;
drop policy if exists "course_materials_delete_teacher" on storage.objects;
create policy "course_materials_read_member" on storage.objects for select to authenticated using (bucket_id = 'course-materials' and public.is_course_member(public.try_uuid((storage.foldername(name))[1])));
create policy "course_materials_upload_teacher" on storage.objects for insert to authenticated with check (bucket_id = 'course-materials' and public.can_manage_course(public.try_uuid((storage.foldername(name))[1])));
create policy "course_materials_update_teacher" on storage.objects for update to authenticated using (bucket_id = 'course-materials' and public.can_manage_course(public.try_uuid((storage.foldername(name))[1]))) with check (bucket_id = 'course-materials' and public.can_manage_course(public.try_uuid((storage.foldername(name))[1])));
create policy "course_materials_delete_teacher" on storage.objects for delete to authenticated using (bucket_id = 'course-materials' and public.can_manage_course(public.try_uuid((storage.foldername(name))[1])));

-- Add live feeds where the managed Realtime publication is available.
do $$ begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; when undefined_object then null; end $$;

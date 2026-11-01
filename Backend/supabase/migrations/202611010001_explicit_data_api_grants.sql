-- Grant Data API table privileges explicitly for Supabase projects that disable
-- automatic exposure of new tables. RLS policies below each grant continue to
-- enforce per-user access; service_role is used only by the trusted Node API.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- Helper functions used by RLS expressions must be executable by signed-in users.
grant execute on function public.current_role() to authenticated, service_role;
grant execute on function public.is_course_member(uuid) to authenticated, service_role;
grant execute on function public.can_manage_course(uuid) to authenticated, service_role;
grant execute on function public.try_uuid(text) to authenticated, service_role;

-- Preserve the column-level security rules from the earlier migrations.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

revoke insert, update on public.assignment_submissions from authenticated;
grant insert (assignment_id, student_id, submission_file) on public.assignment_submissions to authenticated;
grant update (submission_file) on public.assignment_submissions to authenticated;

revoke insert, update on public.quiz_attempts from authenticated;
grant insert (quiz_id, student_id, answers) on public.quiz_attempts to authenticated;
grant update (answers, submitted_at) on public.quiz_attempts to authenticated;

revoke insert, update on public.study_sessions from authenticated;
grant insert (student_id, course_id) on public.study_sessions to authenticated;

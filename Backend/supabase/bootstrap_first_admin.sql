-- 1) Create your account through the LMS and confirm its email.
-- 2) Replace the email below with that exact account email, then run this once
--    in Supabase Dashboard > SQL Editor. Do not put a password in this file.
update public.profiles
set role = 'admin'
where lower(email) = lower('REPLACE_WITH_YOUR_LOGIN_EMAIL');

-- Confirm the change (the result should show your account and role = admin).
select email, full_name, role
from public.profiles
where lower(email) = lower('REPLACE_WITH_YOUR_LOGIN_EMAIL');

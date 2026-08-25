revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
-- RLS policies evaluate as the caller's role; authenticated users need execute
-- so the policy can check admin status. The function is SECURITY DEFINER, so it
-- safely reads admin_profiles as the owner regardless.
grant execute on function public.is_admin() to authenticated;

alter function public.is_admin() set search_path = public;

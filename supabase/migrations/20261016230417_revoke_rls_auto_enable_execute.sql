-- public.rls_auto_enable() is the project's event-trigger helper that turns on RLS for new tables in public.
-- As a SECURITY DEFINER function in an exposed schema it was listed at /rest/v1/rpc/rls_auto_enable (advisor lints
-- 0028/0029). Event triggers don't need callers to hold EXECUTE, so revoking it keeps the trigger working.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

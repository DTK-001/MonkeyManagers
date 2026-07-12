-- These SECURITY DEFINER helpers are invoked by the season trigger and server-side operations.
-- They must not be callable directly by browser database roles.
revoke execute on function public.enable_real_competitions_for_season(uuid) from public;
revoke execute on function public.enable_real_competitions_for_season(uuid) from anon;
revoke execute on function public.enable_real_competitions_for_season(uuid) from authenticated;
grant execute on function public.enable_real_competitions_for_season(uuid) to service_role;

revoke execute on function public.enable_real_competitions_after_season_create() from public;
revoke execute on function public.enable_real_competitions_after_season_create() from anon;
revoke execute on function public.enable_real_competitions_after_season_create() from authenticated;
grant execute on function public.enable_real_competitions_after_season_create() to service_role;

-- Fix security definer views by setting them to SECURITY INVOKER
alter view public.v_daily_active_scanners set (security_invoker = on);
alter view public.v_matches_per_scan set (security_invoker = on);
alter view public.v_funnel_rates set (security_invoker = on);
alter view public.v_time_to_submit set (security_invoker = on);
alter view public.v_time_to_paid set (security_invoker = on);
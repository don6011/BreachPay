-- Fix infinite recursion: replace self-referencing RLS policy on partner_users
-- with a SECURITY DEFINER helper function

CREATE OR REPLACE FUNCTION public.get_partner_ids_for_user(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id FROM public.partner_users WHERE user_id = p_user_id;
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "partner_users_org_read" ON public.partner_users;

-- Recreate it using the security definer function (no recursion)
CREATE POLICY "partner_users_org_read" ON public.partner_users
  FOR SELECT TO authenticated
  USING (
    partner_id IN (SELECT public.get_partner_ids_for_user(auth.uid()))
  );
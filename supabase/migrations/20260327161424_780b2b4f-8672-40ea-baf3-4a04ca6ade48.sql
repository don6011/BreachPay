
-- 1. Remove overly permissive referrals insert policy
DROP POLICY IF EXISTS "Users insert referrals" ON public.user_referrals;

-- 2. Fix partner claims SELECT policy to use proper membership check
DROP POLICY IF EXISTS "claims_select_partner" ON public.claims;
CREATE POLICY "claims_select_partner" ON public.claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_users pu
      WHERE pu.partner_id = claims.partner_id
        AND pu.user_id = auth.uid()
    )
  );

-- 3. Fix mutable search_path on trg_validate_raw_ingest_status
CREATE OR REPLACE FUNCTION public.trg_validate_raw_ingest_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('new','parsed','queued','rejected') THEN
    RAISE EXCEPTION 'Invalid raw_ingest status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

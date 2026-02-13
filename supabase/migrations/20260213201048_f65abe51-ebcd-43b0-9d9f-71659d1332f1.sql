-- Add unique constraint on settlement_id for upsert
ALTER TABLE public.settlement_performance_metrics
ADD CONSTRAINT settlement_performance_metrics_settlement_id_key UNIQUE (settlement_id);

-- Trigger function that reads NEW automatically
CREATE OR REPLACE FUNCTION public.trg_update_settlement_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sid uuid;
  v_total_claims integer;
  v_total_approved integer;
  v_total_paid integer;
  v_total_payout numeric;
  v_avg_payout numeric;
  v_conversion numeric;
  v_total_matches integer;
BEGIN
  v_sid := COALESCE(NEW.settlement_id, OLD.settlement_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('approved', 'paid')),
    COUNT(*) FILTER (WHERE status = 'paid'),
    COALESCE(SUM(final_payout) FILTER (WHERE status = 'paid'), 0),
    COALESCE(AVG(final_payout) FILTER (WHERE status = 'paid'), 0)
  INTO v_total_claims, v_total_approved, v_total_paid, v_total_payout, v_avg_payout
  FROM public.claims
  WHERE settlement_id = v_sid;

  SELECT COUNT(*) INTO v_total_matches
  FROM public.settlement_matches
  WHERE settlement_id = v_sid;

  v_conversion := CASE WHEN v_total_claims > 0
    THEN ROUND((v_total_approved::numeric / v_total_claims) * 100, 2)
    ELSE 0 END;

  INSERT INTO public.settlement_performance_metrics (
    settlement_id, total_matches, total_claims_filed, total_approved,
    total_paid, total_payout_amount, avg_payout, conversion_rate
  ) VALUES (
    v_sid, v_total_matches, v_total_claims, v_total_approved,
    v_total_paid, v_total_payout, v_avg_payout, v_conversion
  )
  ON CONFLICT (settlement_id) DO UPDATE SET
    total_matches = v_total_matches,
    total_claims_filed = v_total_claims,
    total_approved = v_total_approved,
    total_paid = v_total_paid,
    total_payout_amount = v_total_payout,
    avg_payout = v_avg_payout,
    conversion_rate = v_conversion,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- Trigger on claims insert
CREATE TRIGGER trg_claims_insert_metrics
AFTER INSERT ON public.claims
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_settlement_metrics();

-- Trigger on claims update (status or payout changes)
CREATE TRIGGER trg_claims_update_metrics
AFTER UPDATE ON public.claims
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.final_payout IS DISTINCT FROM NEW.final_payout)
EXECUTE FUNCTION public.trg_update_settlement_metrics();

-- Also update metrics when settlement_matches are inserted
CREATE TRIGGER trg_matches_insert_metrics
AFTER INSERT ON public.settlement_matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_settlement_metrics();
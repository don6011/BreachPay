-- Enhanced claim status change trigger: enqueue outbox notifications
CREATE OR REPLACE FUNCTION public.on_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settlement_name text;
  v_company text;
  v_template text;
  v_body text;
  v_severity public.risk_level_t;
  v_dedupe text;
  v_email_alerts boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Get settlement info
    SELECT name, company INTO v_settlement_name, v_company
    FROM public.settlements WHERE id = NEW.settlement_id;

    -- Determine notification content by new status
    CASE NEW.status
      WHEN 'submitted' THEN
        v_template := 'claim_submitted';
        v_body := 'Your claim for ' || coalesce(v_settlement_name, 'a settlement') || ' has been submitted and is being processed.';
        v_severity := 'low';
      WHEN 'under_review' THEN
        v_template := 'claim_update';
        v_body := 'Your claim for ' || coalesce(v_settlement_name, 'a settlement') || ' is now under review.';
        v_severity := 'medium';
      WHEN 'approved' THEN
        v_template := 'claim_approved';
        v_body := 'Your claim for ' || coalesce(v_settlement_name, 'a settlement') || ' has been approved! Estimated payout: $' || coalesce(NEW.est_payout::text, '0') || '.';
        v_severity := 'low';
      WHEN 'rejected' THEN
        v_template := 'claim_rejected';
        v_body := 'Your claim for ' || coalesce(v_settlement_name, 'a settlement') || ' was not approved.';
        v_severity := 'high';
      WHEN 'paid' THEN
        v_template := 'claim_paid';
        v_body := 'Your payout for ' || coalesce(v_settlement_name, 'a settlement') || ' has been processed! Amount: $' || coalesce(NEW.final_payout::text, NEW.est_payout::text, '0') || '.';
        v_severity := 'low';
      ELSE
        v_template := 'claim_update';
        v_body := 'Your claim status changed to ' || NEW.status || '.';
        v_severity := 'low';
    END CASE;

    -- Insert alert
    INSERT INTO public.alerts (user_id, type, title, body, severity, related_claim_id, related_settlement_id)
    VALUES (NEW.user_id, 'claim_update', 'Claim status updated', v_body, v_severity, NEW.id, NEW.settlement_id);

    -- In-app notification
    v_dedupe := 'claim_status:' || NEW.user_id || ':' || NEW.id || ':' || NEW.status;
    INSERT INTO public.notification_outbox (user_id, channel, template, payload, dedupe_key)
    VALUES (NEW.user_id, 'in_app', v_template,
      jsonb_build_object(
        'claim_id', NEW.id,
        'settlement_id', NEW.settlement_id,
        'settlement_name', v_settlement_name,
        'company', v_company,
        'new_status', NEW.status,
        'old_status', OLD.status,
        'payout_estimate', NEW.est_payout,
        'final_payout', NEW.final_payout
      ),
      v_dedupe
    ) ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

    -- Email notification (if opted in)
    SELECT email_alerts INTO v_email_alerts FROM public.user_profiles WHERE user_id = NEW.user_id;
    IF coalesce(v_email_alerts, true) AND NEW.status IN ('submitted', 'approved', 'paid') THEN
      INSERT INTO public.notification_outbox (user_id, channel, template, payload, dedupe_key)
      VALUES (NEW.user_id, 'email', v_template,
        jsonb_build_object(
          'claim_id', NEW.id,
          'settlement_id', NEW.settlement_id,
          'settlement_name', v_settlement_name,
          'company', v_company,
          'new_status', NEW.status,
          'payout_estimate', NEW.est_payout,
          'final_payout', NEW.final_payout
        ),
        v_dedupe || ':email'
      ) ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    END IF;

    -- Admin activity log
    INSERT INTO public.admin_activity_logs (admin_user_id, action, entity_type, entity_id, meta)
    VALUES (auth.uid(), 'Updated claim status', 'claim', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $function$;
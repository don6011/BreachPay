
-- Extend the claim status trigger to notify assigned partner users when a claim reaches 'submitted'
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
  v_partner_user record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name, company INTO v_settlement_name, v_company
    FROM public.settlements WHERE id = NEW.settlement_id;

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
        v_body := 'Your payout for ' || coalesce(v_settlement_name, 'a settlement') || ' has been processed! Amount: $' || coalesce(NEW.final_payout::text, '0') || '.';
        v_severity := 'low';
      ELSE
        v_template := 'claim_update';
        v_body := 'Your claim for ' || coalesce(v_settlement_name, 'a settlement') || ' status changed to ' || NEW.status || '.';
        v_severity := 'low';
    END CASE;

    v_dedupe := 'claim_status:' || NEW.user_id || ':' || NEW.id || ':' || NEW.status;

    -- In-app alert for claimant
    INSERT INTO public.alerts(user_id, type, title, body, severity, related_claim_id)
    VALUES (NEW.user_id, 'claim_update', 'Claim status updated', v_body, v_severity, NEW.id);

    -- In-app notification for claimant
    INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
    VALUES (NEW.user_id, 'in_app', v_template,
      jsonb_build_object('claim_id', NEW.id, 'status', NEW.status, 'settlement_name', v_settlement_name, 'company', v_company),
      v_dedupe)
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

    -- Email notification for claimant (if opted in)
    SELECT email_alerts INTO v_email_alerts FROM public.user_profiles WHERE user_id = NEW.user_id;
    IF coalesce(v_email_alerts, false) THEN
      INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
      VALUES (NEW.user_id, 'email', v_template,
        jsonb_build_object('claim_id', NEW.id, 'status', NEW.status, 'settlement_name', v_settlement_name, 'company', v_company),
        v_dedupe || ':email')
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    END IF;

    -- PARTNER WEBHOOK: notify assigned partner users when claim is submitted
    IF NEW.status = 'submitted' THEN
      FOR v_partner_user IN
        SELECT pu.user_id AS partner_user_id, ca.partner_id
        FROM public.claim_assignments ca
        JOIN public.partner_users pu ON pu.partner_id = ca.partner_id
        WHERE ca.claim_id = NEW.id
          AND ca.assignment_status = 'active'
          AND pu.role IN ('admin', 'agent')
      LOOP
        -- In-app alert for partner user
        INSERT INTO public.alerts(user_id, type, title, body, severity, related_claim_id)
        VALUES (v_partner_user.partner_user_id, 'claim_update', 'New claim ready for review',
          'Claim for ' || coalesce(v_settlement_name, 'a settlement') || ' (' || coalesce(v_company, '') || ') has been submitted and is ready for review.',
          'medium', NEW.id);

        -- In-app notification for partner user
        INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
        VALUES (v_partner_user.partner_user_id, 'in_app', 'partner_claim_submitted',
          jsonb_build_object('claim_id', NEW.id, 'settlement_name', v_settlement_name, 'company', v_company, 'partner_id', v_partner_user.partner_id),
          'partner_claim_submitted:' || v_partner_user.partner_user_id || ':' || NEW.id)
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        -- Email notification for partner user
        INSERT INTO public.notification_outbox(user_id, channel, template, payload, dedupe_key)
        VALUES (v_partner_user.partner_user_id, 'email', 'partner_claim_submitted',
          jsonb_build_object('claim_id', NEW.id, 'settlement_name', v_settlement_name, 'company', v_company, 'partner_id', v_partner_user.partner_id),
          'partner_claim_submitted_email:' || v_partner_user.partner_user_id || ':' || NEW.id)
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

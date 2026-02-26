
-- 1. Claim Review Queue
CREATE TABLE public.claim_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
  queue_type text NOT NULL,
  priority int DEFAULT 50,
  status text DEFAULT 'pending',
  assigned_to uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

-- Validation trigger for queue_type
CREATE OR REPLACE FUNCTION public.validate_review_queue_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.queue_type NOT IN ('fraud_review','doc_review','partner_escalation','manual_verification') THEN
    RAISE EXCEPTION 'Invalid queue_type: %', NEW.queue_type;
  END IF;
  IF NEW.status NOT IN ('pending','in_review','resolved','rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_review_queue
BEFORE INSERT OR UPDATE ON public.claim_review_queue
FOR EACH ROW EXECUTE FUNCTION public.validate_review_queue_fields();

ALTER TABLE public.claim_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage review queue"
ON public.claim_review_queue FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Auto-route claims to queue on status change
CREATE OR REPLACE FUNCTION public.auto_route_claim_to_queue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Fraud review if flagged
  IF NEW.flagged = true AND (OLD.flagged IS DISTINCT FROM NEW.flagged) THEN
    INSERT INTO public.claim_review_queue(claim_id, queue_type, priority, notes)
    VALUES (NEW.id, 'fraud_review', 90, coalesce(NEW.flag_reason, 'Auto-flagged'))
    ON CONFLICT DO NOTHING;
  END IF;

  -- Low confidence review
  IF NEW.exposure_confidence < 50 AND NEW.status = 'submitted' THEN
    INSERT INTO public.claim_review_queue(claim_id, queue_type, priority, notes)
    VALUES (NEW.id, 'manual_verification', 60, 'Low exposure confidence: ' || NEW.exposure_confidence)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_route_claim
AFTER INSERT OR UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.auto_route_claim_to_queue();

-- 2. Document AI Analysis
CREATE TABLE public.document_ai_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.claim_documents(id) ON DELETE CASCADE NOT NULL,
  doc_type_detected text,
  confidence_score int DEFAULT 0,
  fraud_flag boolean DEFAULT false,
  fraud_reasons text[],
  extracted_text jsonb DEFAULT '{}'::jsonb,
  name_match_score int,
  completeness_score int,
  analysis_model text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.document_ai_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage doc analysis"
ON public.document_ai_analysis FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users view own doc analysis"
ON public.document_ai_analysis FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.claim_documents cd
    WHERE cd.id = document_ai_analysis.document_id
      AND cd.user_id = auth.uid()
  )
);

-- 3. Partner SLA Metrics
CREATE TABLE public.partner_sla_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  avg_processing_time_hours numeric,
  claims_processed int DEFAULT 0,
  claims_breached_sla int DEFAULT 0,
  sla_target_hours numeric DEFAULT 48,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, period_start, period_end)
);

ALTER TABLE public.partner_sla_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage SLA metrics"
ON public.partner_sla_metrics FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Partners view own SLA metrics"
ON public.partner_sla_metrics FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partner_users pu
    WHERE pu.partner_id = partner_sla_metrics.partner_id
      AND pu.user_id = auth.uid()
  )
);

-- 4. Support Tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text,
  status text DEFAULT 'open',
  priority int DEFAULT 50,
  category text,
  ai_response text,
  ai_resolved boolean DEFAULT false,
  assigned_to uuid,
  related_claim_id uuid REFERENCES public.claims(id),
  related_settlement_id uuid REFERENCES public.settlements(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Validation trigger for support ticket status
CREATE OR REPLACE FUNCTION public.validate_support_ticket_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('open','ai_resolved','escalated','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Invalid support ticket status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_support_ticket
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.validate_support_ticket_status();

CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tickets"
ON public.support_tickets FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage all tickets"
ON public.support_tickets FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- 5. Support ticket messages (thread)
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_ticket_message_sender()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sender_type NOT IN ('user','ai','admin') THEN
    RAISE EXCEPTION 'Invalid sender_type: %', NEW.sender_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ticket_message
BEFORE INSERT OR UPDATE ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_message_sender();

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ticket messages"
ON public.support_ticket_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = support_ticket_messages.ticket_id
      AND st.user_id = auth.uid()
  )
);

CREATE POLICY "Users insert own ticket messages"
ON public.support_ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'user' AND
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = support_ticket_messages.ticket_id
      AND st.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all ticket messages"
ON public.support_ticket_messages FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_review_queue_status ON public.claim_review_queue(status, priority DESC);
CREATE INDEX idx_review_queue_claim ON public.claim_review_queue(claim_id);
CREATE INDEX idx_doc_ai_document ON public.document_ai_analysis(document_id);
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id, status);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status, priority DESC);
CREATE INDEX idx_sla_partner_period ON public.partner_sla_metrics(partner_id, period_start);

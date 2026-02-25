
-- =============================================
-- 1) scan_schedule
-- =============================================
CREATE TABLE public.scan_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'daily',
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  scan_type text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_schedule_select_own" ON public.scan_schedule
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "scan_schedule_insert_own" ON public.scan_schedule
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "scan_schedule_update_own" ON public.scan_schedule
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "scan_schedule_delete_own" ON public.scan_schedule
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "scan_schedule_admin_all" ON public.scan_schedule
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_scan_schedule_user ON public.scan_schedule(user_id);
CREATE INDEX idx_scan_schedule_next_run ON public.scan_schedule(next_run_at) WHERE is_enabled = true;

-- =============================================
-- 2) scan_job_queue
-- =============================================
CREATE TABLE public.scan_job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  schedule_id uuid REFERENCES public.scan_schedule(id) ON DELETE SET NULL,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_job_queue_select_own" ON public.scan_job_queue
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "scan_job_queue_admin_all" ON public.scan_job_queue
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_scan_job_queue_status ON public.scan_job_queue(status, run_at) WHERE status = 'queued';
CREATE INDEX idx_scan_job_queue_user ON public.scan_job_queue(user_id);

-- =============================================
-- 3) notification_outbox
-- =============================================
CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_outbox_select_own" ON public.notification_outbox
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notification_outbox_admin_all" ON public.notification_outbox
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_notification_outbox_user ON public.notification_outbox(user_id);
CREATE INDEX idx_notification_outbox_status ON public.notification_outbox(status) WHERE status = 'pending';

-- =============================================
-- 4) SECURITY DEFINER RPC for cron scan processing
-- =============================================
CREATE OR REPLACE FUNCTION public.proc_cron_scan_jobs(max_jobs int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job record;
  scan_id uuid;
  seed int;
  breach_count int;
  i int;
  bc record;
  score int;
  breaches_inserted int;
  sev text;
  fields text;
  catalog_count int;
  freq_days int;
  next_ts timestamptz;
  processed int := 0;
  failed int := 0;
  payout_est numeric;
  hit boolean;
  results jsonb := '[]'::jsonb;
BEGIN
  -- Get catalog count
  SELECT count(*) INTO catalog_count
  FROM public.breach_catalog WHERE active = true AND verified = true;

  IF catalog_count = 0 THEN
    RETURN jsonb_build_object('processed', 0, 'error', 'no active catalog entries');
  END IF;

  -- Pick up to max_jobs queued jobs that are due
  FOR job IN
    SELECT sjq.*, ss.frequency
    FROM public.scan_job_queue sjq
    LEFT JOIN public.scan_schedule ss ON ss.id = sjq.schedule_id
    WHERE sjq.status = 'queued' AND sjq.run_at <= now()
    ORDER BY sjq.run_at ASC
    LIMIT max_jobs
    FOR UPDATE OF sjq SKIP LOCKED
  LOOP
    -- Mark running
    UPDATE public.scan_job_queue
    SET status = 'running', started_at = now(), attempts = attempts + 1
    WHERE id = job.id;

    BEGIN
      breaches_inserted := 0;
      score := 0;

      -- Determine frequency
      freq_days := CASE job.frequency
        WHEN 'hourly' THEN 0
        WHEN 'daily' THEN 1
        WHEN 'weekly' THEN 7
        ELSE 7
      END;

      -- Create scan run
      INSERT INTO public.scan_runs(user_id, status, started_at, provider)
      VALUES (job.user_id, 'running', now(), 'cron_schedule')
      RETURNING id INTO scan_id;

      -- Deterministic breach selection
      seed := abs(hashtext(job.user_id::text || now()::text));
      breach_count := 2 + (seed % 4);

      FOR i IN 0..(breach_count - 1) LOOP
        SELECT * INTO bc
        FROM public.breach_catalog
        WHERE active = true AND verified = true
        ORDER BY company ASC, breach_year DESC
        OFFSET ((seed + i*13) % catalog_count)
        LIMIT 1;

        IF bc.id IS NULL THEN CONTINUE; END IF;

        INSERT INTO public.breach_events (
          user_id, scan_run_id, breach_catalog_id, source, breach_year,
          risk_level, exposed_fields, details
        )
        SELECT
          job.user_id, scan_id, bc.id, bc.company, bc.breach_year,
          bc.severity::public.risk_level_t,
          string_to_array(replace(bc.exposed_fields, ' ', ''), ','),
          jsonb_build_object('demo', true, 'cron', true)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.breach_events be
          WHERE be.user_id = job.user_id AND be.breach_catalog_id = bc.id
        );

        IF FOUND THEN
          breaches_inserted := breaches_inserted + 1;
          sev := bc.severity;
          fields := lower(coalesce(bc.exposed_fields, ''));
          score := score + CASE sev WHEN 'critical' THEN 22 WHEN 'high' THEN 16 WHEN 'medium' THEN 9 ELSE 5 END;
          IF fields LIKE '%password%' THEN score := score + 10; END IF;
          IF fields LIKE '%ssn%' THEN score := score + 20; END IF;
          IF fields LIKE '%financial%' THEN score := score + 12; END IF;
        END IF;
      END LOOP;

      IF score > 100 THEN score := 100; END IF;
      IF score < 0 THEN score := 0; END IF;

      -- Risk snapshot
      INSERT INTO public.user_risk_snapshots(user_id, risk_score, breaches_detected)
      VALUES (job.user_id, score, breaches_inserted);

      -- Settlement matching
      FOR i IN (
        SELECT s.id, s.company, s.breach_year, s.payout_min, s.payout_max, s.status, s.name, s.deadline
        FROM public.settlements s WHERE s.status IN ('open','pending')
      ) LOOP
        SELECT EXISTS(
          SELECT 1 FROM public.breach_events b
          WHERE b.user_id = job.user_id AND b.scan_run_id = scan_id
            AND (lower(b.source) LIKE '%' || lower(i.company) || '%'
              OR lower(i.company) LIKE '%' || lower(b.source) || '%')
            AND (i.breach_year IS NULL OR b.breach_year IS NULL OR i.breach_year = b.breach_year)
        ) INTO hit;

        IF hit THEN
          payout_est := NULL;
          IF i.payout_min IS NOT NULL AND i.payout_max IS NOT NULL THEN
            payout_est := (i.payout_min + i.payout_max) / 2;
          END IF;

          INSERT INTO public.settlement_matches(user_id, settlement_id, scan_run_id, match_reason, status, payout_estimate)
          VALUES (job.user_id, i.id, scan_id, 'Matched via cron scan', i.status, payout_est)
          ON CONFLICT (user_id, settlement_id) DO NOTHING;

          IF FOUND THEN
            -- Dedupe: no duplicate new_match for same user+settlement within 7 days
            IF NOT EXISTS (
              SELECT 1 FROM public.notification_outbox no
              WHERE no.user_id = job.user_id AND no.template = 'new_match'
                AND (no.payload->>'settlement_id')::text = i.id::text
                AND no.created_at > now() - interval '7 days'
            ) THEN
              INSERT INTO public.notification_outbox(user_id, channel, template, payload)
              VALUES (job.user_id, 'in_app', 'new_match', jsonb_build_object(
                'settlement_id', i.id, 'settlement_name', i.name, 'company', i.company, 'payout_estimate', payout_est
              ));

              INSERT INTO public.alerts(user_id, type, title, body, severity, related_settlement_id, related_scan_run_id)
              VALUES (job.user_id, 'settlement_found', 'New settlement match found',
                'You may qualify for ' || i.name || ' (' || i.company || ')',
                'medium'::public.risk_level_t, i.id, scan_id);
            END IF;

            -- Deadline soon check (14 days)
            IF i.deadline IS NOT NULL AND i.deadline - current_date BETWEEN 0 AND 14 THEN
              IF NOT EXISTS (
                SELECT 1 FROM public.notification_outbox no
                WHERE no.user_id = job.user_id AND no.template = 'deadline_soon'
                  AND (no.payload->>'settlement_id')::text = i.id::text
                  AND no.created_at > now() - interval '7 days'
              ) THEN
                INSERT INTO public.notification_outbox(user_id, channel, template, payload)
                VALUES (job.user_id, 'in_app', 'deadline_soon', jsonb_build_object(
                  'settlement_id', i.id, 'settlement_name', i.name, 'days_left', i.deadline - current_date
                ));

                INSERT INTO public.alerts(user_id, type, title, body, severity, related_settlement_id)
                VALUES (job.user_id, 'deadline_alert', 'Claim deadline approaching',
                  i.company || ': ' || (i.deadline - current_date) || ' days left to file for ' || i.name,
                  CASE WHEN i.deadline - current_date <= 3 THEN 'critical'::public.risk_level_t ELSE 'medium'::public.risk_level_t END,
                  i.id);
              END IF;
            END IF;
          END IF;
        END IF;
      END LOOP;

      -- Complete scan run
      UPDATE public.scan_runs
      SET status = 'completed', breaches_detected = breaches_inserted, risk_score = score,
          completed_at = now(), databases_scanned = 12000
      WHERE id = scan_id;

      -- Enqueue scan_complete notification (dedupe: one per scan)
      INSERT INTO public.notification_outbox(user_id, channel, template, payload)
      VALUES (job.user_id, 'in_app', 'scan_complete', jsonb_build_object(
        'scan_run_id', scan_id, 'breaches', breaches_inserted, 'score', score
      ));

      INSERT INTO public.alerts(user_id, type, title, body, severity, related_scan_run_id)
      VALUES (job.user_id, 'system', 'Scheduled scan complete',
        'Detected ' || breaches_inserted || ' breach exposure(s). Risk score: ' || score,
        CASE WHEN score >= 76 THEN 'critical' WHEN score >= 51 THEN 'high' WHEN score >= 26 THEN 'medium' ELSE 'low' END::public.risk_level_t,
        scan_id);

      -- Mark job success
      UPDATE public.scan_job_queue SET status = 'success', finished_at = now() WHERE id = job.id;

      -- Update schedule next_run_at
      IF job.schedule_id IS NOT NULL THEN
        next_ts := now() + CASE job.frequency
          WHEN 'hourly' THEN interval '1 hour'
          WHEN 'daily' THEN interval '1 day'
          WHEN 'weekly' THEN interval '7 days'
          ELSE interval '7 days'
        END;
        UPDATE public.scan_schedule SET last_run_at = now(), next_run_at = next_ts WHERE id = job.schedule_id;
      END IF;

      processed := processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scan_job_queue SET status = 'failed', last_error = SQLERRM, finished_at = now() WHERE id = job.id;
      IF scan_id IS NOT NULL THEN
        UPDATE public.scan_runs SET status = 'failed', error_message = SQLERRM WHERE id = scan_id;
      END IF;
      failed := failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('processed', processed, 'failed', failed);
END;
$$;

-- =============================================
-- 5) Enqueue jobs from schedules (called by cron)
-- =============================================
CREATE OR REPLACE FUNCTION public.enqueue_due_scan_jobs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sched record;
  enqueued int := 0;
BEGIN
  FOR sched IN
    SELECT id, user_id, frequency, next_run_at
    FROM public.scan_schedule
    WHERE is_enabled = true AND next_run_at <= now()
  LOOP
    -- Don't enqueue if there's already a queued/running job for this schedule
    IF NOT EXISTS (
      SELECT 1 FROM public.scan_job_queue
      WHERE schedule_id = sched.id AND status IN ('queued','running')
    ) THEN
      INSERT INTO public.scan_job_queue(user_id, schedule_id, run_at)
      VALUES (sched.user_id, sched.id, sched.next_run_at);
      enqueued := enqueued + 1;
    END IF;
  END LOOP;
  RETURN enqueued;
END;
$$;

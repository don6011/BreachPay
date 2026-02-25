
-- Replace enqueue function with optimized set-based version
CREATE OR REPLACE FUNCTION public.proc_enqueue_due_jobs(max_jobs int DEFAULT 200)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count int := 0;
BEGIN
  INSERT INTO public.scan_job_queue (user_id, schedule_id, run_at)
  SELECT s.user_id, s.id, s.next_run_at
  FROM public.scan_schedule s
  WHERE s.is_enabled = true
    AND s.next_run_at <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.scan_job_queue q
      WHERE q.schedule_id = s.id
        AND q.status IN ('queued','running')
    )
  LIMIT max_jobs;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE public.scan_schedule s
  SET last_run_at = now(),
      next_run_at = CASE s.frequency
        WHEN 'hourly' THEN now() + interval '1 hour'
        WHEN 'daily'  THEN now() + interval '1 day'
        WHEN 'weekly' THEN now() + interval '7 days'
      END
  WHERE s.is_enabled = true AND s.next_run_at <= now();

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.proc_enqueue_due_jobs(int) FROM public;
GRANT EXECUTE ON FUNCTION public.proc_enqueue_due_jobs(int) TO service_role;

-- Replace job runner with stub that calls scan_complete notification
CREATE OR REPLACE FUNCTION public.proc_run_scheduled_jobs(max_jobs int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job record;
  processed int := 0;
  new_matches int := 0;
BEGIN
  FOR job IN
    SELECT *
    FROM public.scan_job_queue
    WHERE status = 'queued'
      AND run_at <= now()
    ORDER BY run_at ASC
    LIMIT max_jobs
    FOR UPDATE SKIP LOCKED
  LOOP
    processed := processed + 1;

    UPDATE public.scan_job_queue
    SET status = 'running', started_at = now(), attempts = attempts + 1
    WHERE id = job.id;

    BEGIN
      -- In-app "scan complete" notification
      INSERT INTO public.notification_outbox(user_id, channel, template, payload)
      VALUES (
        job.user_id,
        'in_app',
        'scan_complete',
        jsonb_build_object('job_id', job.id, 'completed_at', now())
      );

      UPDATE public.scan_job_queue
      SET status = 'success', finished_at = now()
      WHERE id = job.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scan_job_queue
      SET status = 'failed', finished_at = now(), last_error = SQLERRM
      WHERE id = job.id;
    END;
  END LOOP;

  RETURN processed;
END;
$$;

REVOKE ALL ON FUNCTION public.proc_run_scheduled_jobs(int) FROM public;
GRANT EXECUTE ON FUNCTION public.proc_run_scheduled_jobs(int) TO service_role;

-- Schedule cron jobs every 5 minutes
SELECT cron.schedule(
  'enqueue_due_jobs_5m',
  '*/5 * * * *',
  $$SELECT public.proc_enqueue_due_jobs(200);$$
);

SELECT cron.schedule(
  'run_scheduled_jobs_5m',
  '*/5 * * * *',
  $$SELECT public.proc_run_scheduled_jobs(50);$$
);

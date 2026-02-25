
-- 1. Add advisory lock to proc_run_scheduled_scans_catalog_demo
CREATE OR REPLACE PROCEDURE public.proc_run_scheduled_scans_catalog_demo(IN max_users integer DEFAULT 50)
 LANGUAGE plpgsql
AS $procedure$
declare
  u record;
  scan_id uuid;
  seed int;
  breach_count int;
  i int;
  bc record;
  score int;
  breaches_inserted int;
  sev text;
  fields text;
  plan text;
  freq_days int;
  next_ts timestamptz;
  catalog_count int;
  v_log_id uuid;
  v_processed int := 0;
  v_alerts int := 0;
begin
  -- Advisory lock: prevent overlapping cron runs
  perform pg_advisory_lock(hashtext('breachpay:scheduled_scans'));

  -- Insert run log
  insert into public.scan_run_log(status) values ('running') returning id into v_log_id;

  select count(*) into catalog_count
  from public.breach_catalog
  where active = true and verified = true;

  if catalog_count = 0 then
    update public.scan_run_log set status='success', finished_at=now(), processed_users=0 where id=v_log_id;
    perform pg_advisory_unlock(hashtext('breachpay:scheduled_scans'));
    return;
  end if;

  for u in
    select user_id, plan, monitoring_enabled, next_scan_at
    from public.user_profiles
    where monitoring_enabled = true
      and next_scan_at <= now()
    order by next_scan_at asc
    limit max_users
  loop
    breaches_inserted := 0;
    score := 0;
    plan := coalesce(u.plan, 'free');

    if plan = 'premium' then
      freq_days := 1;
    else
      freq_days := 7;
    end if;

    insert into public.scan_runs(user_id, status, started_at)
    values (u.user_id, 'running', now())
    returning id into scan_id;

    begin
      seed := abs(hashtext(u.user_id::text));
      breach_count := 2 + (seed % 4);

      for i in 0..(breach_count - 1) loop
        select *
        into bc
        from public.breach_catalog
        where active = true and verified = true
        order by company asc, breach_year desc, created_at desc
        offset ((seed + i*13) % catalog_count)
        limit 1;

        if bc.id is null then
          continue;
        end if;

        insert into public.breach_events (
          user_id, scan_run_id, breach_catalog_id, source, breach_year,
          risk_level, exposed_fields, details, created_at
        )
        select
          u.user_id, scan_id, bc.id, bc.company, bc.breach_year,
          bc.severity::public.risk_level_t,
          string_to_array(replace(bc.exposed_fields, ' ', ''), ','),
          jsonb_build_object('demo', true, 'catalog', true, 'source_type', bc.source_type, 'source_name', bc.source_name, 'source_url', bc.source_url),
          now()
        where not exists (
          select 1 from public.breach_events be
          where be.user_id = u.user_id and be.breach_catalog_id = bc.id
        );

        if found then
          breaches_inserted := breaches_inserted + 1;

          sev := bc.severity;
          fields := lower(coalesce(bc.exposed_fields,''));

          score := score +
            case sev
              when 'critical' then 22
              when 'high' then 16
              when 'medium' then 9
              else 5
            end;

          if fields like '%password%' then score := score + 10; end if;
          if fields like '%ssn%' then score := score + 20; end if;
          if fields like '%financial%' then score := score + 12; end if;
          if fields like '%phone%' then score := score + 4; end if;
          if fields like '%address%' then score := score + 4; end if;

          insert into public.alerts(user_id, type, title, body, severity, related_scan_run_id)
          values (
            u.user_id, 'breach_detected', 'New breach exposure detected',
            bc.company || ' (' || coalesce(bc.breach_year::text,'') || ') — exposed: ' || bc.exposed_fields,
            bc.severity::public.risk_level_t, scan_id
          );
          v_alerts := v_alerts + 1;
        end if;
      end loop;

      if score > 100 then score := 100; end if;
      if score < 0 then score := 0; end if;

      insert into public.user_risk_snapshots(user_id, risk_score, breaches_detected, created_at)
      values (u.user_id, score, breaches_inserted, now());

      update public.scan_runs
      set status = 'completed',
          breaches_detected = breaches_inserted,
          risk_score = score,
          completed_at = now()
      where id = scan_id;

      next_ts := now() + make_interval(days => freq_days);

      update public.user_profiles
      set last_scan_at = now(),
          next_scan_at = next_ts,
          scan_frequency_days = freq_days
      where user_id = u.user_id;

      insert into public.alerts(user_id, type, title, body, severity, related_scan_run_id)
      values (
        u.user_id, 'system', 'Monitoring scan completed',
        case when plan = 'premium'
          then 'Daily monitoring scan completed. Any new exposures and settlement matches will appear here.'
          else 'Weekly monitoring scan completed. Upgrade for daily scans and faster alerts.'
        end,
        case
          when score >= 76 then 'critical'::public.risk_level_t
          when score >= 51 then 'high'::public.risk_level_t
          when score >= 26 then 'medium'::public.risk_level_t
          else 'low'::public.risk_level_t
        end,
        scan_id
      );
      v_alerts := v_alerts + 1;
      v_processed := v_processed + 1;

    exception when others then
      update public.scan_runs
      set status = 'failed', error_message = sqlerrm
      where id = scan_id;

      insert into public.alerts(user_id, type, title, body, severity, related_scan_run_id)
      values (
        u.user_id, 'system', 'Scan failed',
        'We encountered an error running your scan. Please try again.',
        'high'::public.risk_level_t, scan_id
      );
    end;
  end loop;

  call public.proc_rebuild_settlement_matches();

  -- Update run log
  update public.scan_run_log
  set status='success', finished_at=now(), processed_users=v_processed, alerts_enqueued=v_alerts
  where id=v_log_id;

  perform pg_advisory_unlock(hashtext('breachpay:scheduled_scans'));

exception when others then
  -- Ensure lock is released on any unhandled error
  update public.scan_run_log
  set status='failed', finished_at=now(), processed_users=v_processed, alerts_enqueued=v_alerts, last_error=sqlerrm
  where id=v_log_id;
  perform pg_advisory_unlock(hashtext('breachpay:scheduled_scans'));
  raise;
end;
$procedure$;

-- 2. Create scan_run_log table for failure visibility
CREATE TABLE IF NOT EXISTS public.scan_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  processed_users int DEFAULT 0,
  alerts_enqueued int DEFAULT 0,
  last_error text
);

ALTER TABLE public.scan_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_run_log_admin_only" ON public.scan_run_log
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Add dedupe_key to notification_outbox
ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_dedupe
  ON public.notification_outbox(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 4. Single cron job calling the orchestrator directly
-- First unschedule old jobs
SELECT cron.unschedule('enqueue_due_jobs_5m');
SELECT cron.unschedule('run_scheduled_jobs_5m');

-- Schedule the single orchestrator
SELECT cron.schedule(
  'breachpay_scheduled_scans_5m',
  '*/5 * * * *',
  $$ CALL public.proc_run_scheduled_scans_catalog_demo(50); $$
);

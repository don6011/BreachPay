
-- Update proc_run_scheduled_scans_catalog_demo: change status IN ('open','pending') to ('open','verified')
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
  v_plan text;
  freq_days int;
  next_ts timestamptz;
  catalog_count int;
  v_log_id uuid;
  v_processed int := 0;
  v_alerts int := 0;
  v_email_alerts boolean;
  v_deadline_alerts boolean;
  s record;
  hit boolean;
  payout_est numeric;
  days_left int;
begin
  perform pg_advisory_lock(hashtext('breachpay:scheduled_scans'));
  insert into public.scan_run_log(status) values ('running') returning id into v_log_id;

  select count(*) into catalog_count from public.breach_catalog where active = true and verified = true;
  if catalog_count = 0 then
    update public.scan_run_log set status='success', finished_at=now(), processed_users=0 where id=v_log_id;
    perform pg_advisory_unlock(hashtext('breachpay:scheduled_scans'));
    return;
  end if;

  for u in
    select up.user_id, up.plan as user_plan, up.monitoring_enabled, up.next_scan_at, up.email_alerts, up.deadline_alerts
    from public.user_profiles up
    where up.monitoring_enabled = true and up.next_scan_at <= now()
    order by up.next_scan_at asc limit max_users
  loop
    breaches_inserted := 0; score := 0;
    v_plan := coalesce(u.user_plan, 'free');
    v_email_alerts := coalesce(u.email_alerts, true);
    v_deadline_alerts := coalesce(u.deadline_alerts, true);
    freq_days := case when v_plan = 'premium' then 1 else 7 end;

    insert into public.scan_runs(user_id, status, started_at) values (u.user_id, 'running', now()) returning id into scan_id;

    begin
      seed := abs(hashtext(u.user_id::text));
      breach_count := 2 + (seed % 4);

      for i in 0..(breach_count - 1) loop
        select * into bc from public.breach_catalog where active = true and verified = true
        order by company asc, breach_year desc, created_at desc offset ((seed + i*13) % catalog_count) limit 1;
        if bc.id is null then continue; end if;

        insert into public.breach_events (user_id, scan_run_id, breach_catalog_id, source, breach_year, risk_level, exposed_fields, details, created_at)
        select u.user_id, scan_id, bc.id, bc.company, bc.breach_year, bc.severity::public.risk_level_t,
          string_to_array(replace(bc.exposed_fields, ' ', ''), ','),
          jsonb_build_object('demo', true, 'catalog', true, 'source_type', bc.source_type, 'source_name', bc.source_name, 'source_url', bc.source_url), now()
        where not exists (select 1 from public.breach_events be where be.user_id = u.user_id and be.breach_catalog_id = bc.id);

        if found then
          breaches_inserted := breaches_inserted + 1;
          sev := bc.severity; fields := lower(coalesce(bc.exposed_fields,''));
          score := score + case sev when 'critical' then 22 when 'high' then 16 when 'medium' then 9 else 5 end;
          if fields like '%password%' then score := score + 10; end if;
          if fields like '%ssn%' then score := score + 20; end if;
          if fields like '%financial%' then score := score + 12; end if;
          if fields like '%phone%' then score := score + 4; end if;
          if fields like '%address%' then score := score + 4; end if;

          insert into public.alerts(user_id, type, title, body, severity, related_scan_run_id)
          values (u.user_id, 'breach_detected', 'New breach exposure detected',
            bc.company || ' (' || coalesce(bc.breach_year::text,'') || ') — exposed: ' || bc.exposed_fields,
            bc.severity::public.risk_level_t, scan_id);
          v_alerts := v_alerts + 1;
        end if;
      end loop;

      if score > 100 then score := 100; end if;
      if score < 0 then score := 0; end if;

      insert into public.user_risk_snapshots(user_id, risk_score, breaches_detected, created_at) values (u.user_id, score, breaches_inserted, now());
      update public.scan_runs set status = 'completed', breaches_detected = breaches_inserted, risk_score = score, completed_at = now() where id = scan_id;
      next_ts := now() + make_interval(days => freq_days);
      update public.user_profiles set last_scan_at = now(), next_scan_at = next_ts, scan_frequency_days = freq_days where user_id = u.user_id;

      -- SETTLEMENT MATCHING: now includes 'verified'
      for s in
        select id, company, breach_year, payout_min, payout_max, status, name, deadline
        from public.settlements where status in ('open','verified')
      loop
        select exists(
          select 1 from public.breach_events b
          where b.user_id = u.user_id and b.scan_run_id = scan_id
            and (lower(b.source) like '%' || lower(s.company) || '%' or lower(s.company) like '%' || lower(b.source) || '%')
            and (s.breach_year is null or b.breach_year is null or s.breach_year = b.breach_year)
        ) into hit;

        if hit then
          payout_est := null;
          if s.payout_min is not null and s.payout_max is not null then payout_est := (s.payout_min + s.payout_max) / 2; end if;

          insert into public.settlement_matches(user_id, settlement_id, scan_run_id, match_reason, status, payout_estimate)
          values (u.user_id, s.id, scan_id, 'Matched via scheduled scan', s.status, payout_est)
          on conflict (user_id, settlement_id) do nothing;

          if found then
            insert into public.alerts(user_id, type, title, body, severity, related_settlement_id, related_scan_run_id)
            values (u.user_id, 'settlement_found', 'New settlement match found',
              'You may qualify for ' || s.name || ' (' || s.company || ')', 'medium'::public.risk_level_t, s.id, scan_id);
            v_alerts := v_alerts + 1;

            insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
            values (u.user_id, 'in_app', 'new_match',
              jsonb_build_object('settlement_id', s.id, 'settlement_name', s.name, 'company', s.company, 'payout_estimate', payout_est),
              'new_match:' || u.user_id || ':' || s.id
            ) on conflict (dedupe_key) where dedupe_key is not null do nothing;

            if v_email_alerts then
              insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
              values (u.user_id, 'email', 'new_match',
                jsonb_build_object('settlement_id', s.id, 'settlement_name', s.name, 'company', s.company, 'payout_estimate', payout_est),
                'new_match_email:' || u.user_id || ':' || s.id
              ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
            end if;
          end if;

          if s.deadline is not null and v_deadline_alerts then
            days_left := s.deadline - current_date;
            if days_left in (14, 3) or (days_left >= 0 and days_left <= 3) then
              insert into public.alerts(user_id, type, title, body, severity, related_settlement_id)
              values (u.user_id, 'deadline_alert',
                case when days_left <= 3 then 'Deadline approaching — file now' else 'Claim deadline reminder' end,
                s.company || ': ' || days_left || ' day(s) left to file for ' || s.name,
                case when days_left <= 3 then 'critical'::public.risk_level_t else 'medium'::public.risk_level_t end, s.id);
              v_alerts := v_alerts + 1;

              insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
              values (u.user_id, 'in_app', 'deadline_soon',
                jsonb_build_object('settlement_id', s.id, 'settlement_name', s.name, 'days_left', days_left),
                'deadline_soon:' || u.user_id || ':' || s.id || ':' || case when days_left <= 3 then '3' else '14' end
              ) on conflict (dedupe_key) where dedupe_key is not null do nothing;

              if v_email_alerts then
                insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
                values (u.user_id, 'email', 'deadline_soon',
                  jsonb_build_object('settlement_id', s.id, 'settlement_name', s.name, 'days_left', days_left),
                  'deadline_soon_email:' || u.user_id || ':' || s.id || ':' || case when days_left <= 3 then '3' else '14' end
                ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
              end if;
            end if;
          end if;
        end if;
      end loop;

      insert into public.alerts(user_id, type, title, body, severity, related_scan_run_id)
      values (u.user_id, 'system', 'Monitoring scan completed',
        case when v_plan = 'premium' then 'Daily monitoring scan completed. Any new exposures and settlement matches will appear here.'
          else 'Weekly monitoring scan completed. Upgrade for daily scans and faster alerts.' end,
        case when score >= 76 then 'critical' when score >= 51 then 'high' when score >= 26 then 'medium' else 'low' end::public.risk_level_t, scan_id);
      v_alerts := v_alerts + 1;

      insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
      values (u.user_id, 'in_app', 'scan_complete',
        jsonb_build_object('scan_run_id', scan_id, 'breaches', breaches_inserted, 'score', score),
        'scan_complete:' || u.user_id || ':' || date_trunc('hour', now())::text
      ) on conflict (dedupe_key) where dedupe_key is not null do nothing;

      v_processed := v_processed + 1;
    exception when others then
      update public.scan_runs set status = 'failed', error_message = sqlerrm where id = scan_id;
      insert into public.alerts(user_id, type, title, body, severity, related_scan_run_id)
      values (u.user_id, 'system', 'Scan failed', 'We encountered an error running your scan. Please try again.', 'high'::public.risk_level_t, scan_id);
    end;
  end loop;

  update public.scan_run_log set status='success', finished_at=now(), processed_users=v_processed, alerts_enqueued=v_alerts where id=v_log_id;
  perform pg_advisory_unlock(hashtext('breachpay:scheduled_scans'));
exception when others then
  update public.scan_run_log set status='failed', finished_at=now(), processed_users=v_processed, alerts_enqueued=v_alerts, last_error=sqlerrm where id=v_log_id;
  perform pg_advisory_unlock(hashtext('breachpay:scheduled_scans'));
  raise;
end;
$procedure$;

---

-- Update proc_cron_scan_jobs: change ('open','pending') to ('open','verified')
CREATE OR REPLACE FUNCTION public.proc_cron_scan_jobs(max_jobs integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT count(*) INTO catalog_count FROM public.breach_catalog WHERE active = true AND verified = true;
  IF catalog_count = 0 THEN RETURN jsonb_build_object('processed', 0, 'error', 'no active catalog entries'); END IF;

  FOR job IN
    SELECT sjq.*, ss.frequency
    FROM public.scan_job_queue sjq
    LEFT JOIN public.scan_schedule ss ON ss.id = sjq.schedule_id
    WHERE sjq.status = 'queued' AND sjq.run_at <= now()
    ORDER BY sjq.run_at ASC LIMIT max_jobs
    FOR UPDATE OF sjq SKIP LOCKED
  LOOP
    UPDATE public.scan_job_queue SET status = 'running', started_at = now(), attempts = attempts + 1 WHERE id = job.id;

    BEGIN
      breaches_inserted := 0; score := 0;
      freq_days := CASE job.frequency WHEN 'hourly' THEN 0 WHEN 'daily' THEN 1 WHEN 'weekly' THEN 7 ELSE 7 END;

      INSERT INTO public.scan_runs(user_id, status, started_at, provider) VALUES (job.user_id, 'running', now(), 'cron_schedule') RETURNING id INTO scan_id;

      seed := abs(hashtext(job.user_id::text || now()::text));
      breach_count := 2 + (seed % 4);

      FOR i IN 0..(breach_count - 1) LOOP
        SELECT * INTO bc FROM public.breach_catalog WHERE active = true AND verified = true
        ORDER BY company ASC, breach_year DESC OFFSET ((seed + i*13) % catalog_count) LIMIT 1;
        IF bc.id IS NULL THEN CONTINUE; END IF;

        INSERT INTO public.breach_events (user_id, scan_run_id, breach_catalog_id, source, breach_year, risk_level, exposed_fields, details)
        SELECT job.user_id, scan_id, bc.id, bc.company, bc.breach_year, bc.severity::public.risk_level_t,
          string_to_array(replace(bc.exposed_fields, ' ', ''), ','),
          jsonb_build_object('demo', true, 'cron', true)
        WHERE NOT EXISTS (SELECT 1 FROM public.breach_events be WHERE be.user_id = job.user_id AND be.breach_catalog_id = bc.id);

        IF FOUND THEN
          breaches_inserted := breaches_inserted + 1;
          sev := bc.severity; fields := lower(coalesce(bc.exposed_fields, ''));
          score := score + CASE sev WHEN 'critical' THEN 22 WHEN 'high' THEN 16 WHEN 'medium' THEN 9 ELSE 5 END;
          IF fields LIKE '%password%' THEN score := score + 10; END IF;
          IF fields LIKE '%ssn%' THEN score := score + 20; END IF;
          IF fields LIKE '%financial%' THEN score := score + 12; END IF;
        END IF;
      END LOOP;

      IF score > 100 THEN score := 100; END IF;
      IF score < 0 THEN score := 0; END IF;

      INSERT INTO public.user_risk_snapshots(user_id, risk_score, breaches_detected) VALUES (job.user_id, score, breaches_inserted);

      -- Settlement matching: now includes 'verified'
      FOR i IN (
        SELECT s.id, s.company, s.breach_year, s.payout_min, s.payout_max, s.status, s.name, s.deadline
        FROM public.settlements s WHERE s.status IN ('open','verified')
      ) LOOP
        SELECT EXISTS(
          SELECT 1 FROM public.breach_events b
          WHERE b.user_id = job.user_id AND b.scan_run_id = scan_id
            AND (lower(b.source) LIKE '%' || lower(i.company) || '%' OR lower(i.company) LIKE '%' || lower(b.source) || '%')
            AND (i.breach_year IS NULL OR b.breach_year IS NULL OR i.breach_year = b.breach_year)
        ) INTO hit;

        IF hit THEN
          payout_est := NULL;
          IF i.payout_min IS NOT NULL AND i.payout_max IS NOT NULL THEN payout_est := (i.payout_min + i.payout_max) / 2; END IF;

          INSERT INTO public.settlement_matches(user_id, settlement_id, scan_run_id, match_reason, status, payout_estimate)
          VALUES (job.user_id, i.id, scan_id, 'Matched via cron scan', i.status, payout_est)
          ON CONFLICT (user_id, settlement_id) DO NOTHING;

          IF FOUND THEN
            IF NOT EXISTS (
              SELECT 1 FROM public.notification_outbox no
              WHERE no.user_id = job.user_id AND no.template = 'new_match'
                AND (no.payload->>'settlement_id')::text = i.id::text
                AND no.created_at > now() - interval '7 days'
            ) THEN
              INSERT INTO public.notification_outbox(user_id, channel, template, payload)
              VALUES (job.user_id, 'in_app', 'new_match', jsonb_build_object(
                'settlement_id', i.id, 'settlement_name', i.name, 'company', i.company, 'payout_estimate', payout_est));

              INSERT INTO public.alerts(user_id, type, title, body, severity, related_settlement_id, related_scan_run_id)
              VALUES (job.user_id, 'settlement_found', 'New settlement match found',
                'You may qualify for ' || i.name || ' (' || i.company || ')', 'medium'::public.risk_level_t, i.id, scan_id);
            END IF;

            IF i.deadline IS NOT NULL AND i.deadline - current_date BETWEEN 0 AND 14 THEN
              IF NOT EXISTS (
                SELECT 1 FROM public.notification_outbox no
                WHERE no.user_id = job.user_id AND no.template = 'deadline_soon'
                  AND (no.payload->>'settlement_id')::text = i.id::text
                  AND no.created_at > now() - interval '7 days'
              ) THEN
                INSERT INTO public.notification_outbox(user_id, channel, template, payload)
                VALUES (job.user_id, 'in_app', 'deadline_soon', jsonb_build_object(
                  'settlement_id', i.id, 'settlement_name', i.name, 'days_left', i.deadline - current_date));

                INSERT INTO public.alerts(user_id, type, title, body, severity, related_settlement_id)
                VALUES (job.user_id, 'deadline_alert', 'Claim deadline approaching',
                  i.company || ': ' || (i.deadline - current_date) || ' days left to file for ' || i.name,
                  CASE WHEN i.deadline - current_date <= 3 THEN 'critical'::public.risk_level_t ELSE 'medium'::public.risk_level_t END, i.id);
              END IF;
            END IF;
          END IF;
        END IF;
      END LOOP;

      UPDATE public.scan_runs SET status = 'completed', breaches_detected = breaches_inserted, risk_score = score, completed_at = now(), databases_scanned = 12000 WHERE id = scan_id;

      INSERT INTO public.notification_outbox(user_id, channel, template, payload)
      VALUES (job.user_id, 'in_app', 'scan_complete', jsonb_build_object('scan_run_id', scan_id, 'breaches', breaches_inserted, 'score', score));

      INSERT INTO public.alerts(user_id, type, title, body, severity, related_scan_run_id)
      VALUES (job.user_id, 'system', 'Scheduled scan complete',
        'Detected ' || breaches_inserted || ' breach exposure(s). Risk score: ' || score,
        CASE WHEN score >= 76 THEN 'critical' WHEN score >= 51 THEN 'high' WHEN score >= 26 THEN 'medium' ELSE 'low' END::public.risk_level_t, scan_id);

      UPDATE public.scan_job_queue SET status = 'success', finished_at = now() WHERE id = job.id;

      IF job.schedule_id IS NOT NULL THEN
        next_ts := now() + CASE job.frequency WHEN 'hourly' THEN interval '1 hour' WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' ELSE interval '7 days' END;
        UPDATE public.scan_schedule SET last_run_at = now(), next_run_at = next_ts WHERE id = job.schedule_id;
      END IF;
      processed := processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scan_job_queue SET status = 'failed', last_error = SQLERRM, finished_at = now() WHERE id = job.id;
      IF scan_id IS NOT NULL THEN UPDATE public.scan_runs SET status = 'failed', error_message = SQLERRM WHERE id = scan_id; END IF;
      failed := failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('processed', processed, 'failed', failed);
END;
$function$;

---

-- Update proc_rebuild_settlement_matches: change ('open','pending') to ('open','verified')
CREATE OR REPLACE PROCEDURE public.proc_rebuild_settlement_matches()
 LANGUAGE plpgsql
AS $procedure$
declare
  u record;
  s record;
  hit boolean;
  payout_est numeric;
begin
  for u in select distinct user_id from public.breach_events loop
    for s in
      select id, company, breach_year, payout_min, payout_max, status
      from public.settlements where status in ('open','verified')
    loop
      select exists (
        select 1 from public.breach_events b
        where b.user_id = u.user_id
          and (lower(b.source) like '%' || lower(s.company) || '%' or lower(s.company) like '%' || lower(b.source) || '%')
          and (s.breach_year is null or b.breach_year is null or s.breach_year = b.breach_year)
      ) into hit;

      if hit then
        payout_est := null;
        if s.payout_min is not null and s.payout_max is not null then payout_est := (s.payout_min + s.payout_max) / 2; end if;

        insert into public.settlement_matches(user_id, settlement_id, match_reason, status, payout_estimate)
        values (u.user_id, s.id, 'Matched via breach exposure', s.status, payout_est)
        on conflict (user_id, settlement_id) do nothing;

        if found then
          insert into public.alerts(user_id, type, title, body, severity, related_settlement_id)
          values (u.user_id, 'settlement_found', 'You may qualify for compensation',
            'We matched a new settlement based on your breach exposure.', 'medium'::public.risk_level_t, s.id);
        end if;
      end if;
    end loop;
  end loop;
end;
$procedure$;

---

-- Update proc_run_deadline_alerts: change ('open','pending') to ('open','verified')
CREATE OR REPLACE PROCEDURE public.proc_run_deadline_alerts()
 LANGUAGE plpgsql
AS $procedure$
declare
  r record;
  thresholds int[];
  days_left int;
begin
  for r in
    select sm.user_id, sm.settlement_id, up.plan, s.deadline, s.name, s.company, s.status
    from public.settlement_matches sm
    join public.settlements s on s.id = sm.settlement_id
    join public.user_profiles up on up.user_id = sm.user_id
    where s.deadline is not null
      and s.status in ('open','verified')
      and up.deadline_alerts = true
  loop
    days_left := (r.deadline - current_date);
    if r.plan = 'premium' then thresholds := array[30,14,3]; else thresholds := array[14,3]; end if;

    if days_left = any(thresholds) then
      insert into public.deadline_alerts_sent(user_id, settlement_id, threshold_days)
      values (r.user_id, r.settlement_id, days_left)
      on conflict do nothing;

      if found then
        insert into public.alerts(user_id, type, title, body, severity, related_settlement_id)
        values (r.user_id, 'deadline_alert',
          case when days_left <= 3 then 'Deadline approaching — file now' else 'Claim deadline reminder' end,
          r.company || ': ' || r.name || ' — ' || days_left || ' day(s) left to file.',
          case when days_left <= 3 then 'critical'::public.risk_level_t else 'medium'::public.risk_level_t end, r.settlement_id);
      end if;
    end if;
  end loop;
end;
$procedure$;

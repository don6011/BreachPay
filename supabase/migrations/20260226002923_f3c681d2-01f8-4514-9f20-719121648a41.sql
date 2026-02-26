-- 1) Fix the ambiguous 'plan' variable in proc_run_scheduled_scans_catalog_demo
-- by renaming PL/pgSQL variables to v_plan, v_freq_days, etc.

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
  -- settlement matching
  s record;
  hit boolean;
  payout_est numeric;
  days_left int;
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
    select up.user_id, up.plan as user_plan, up.monitoring_enabled, up.next_scan_at, up.email_alerts, up.deadline_alerts
    from public.user_profiles up
    where up.monitoring_enabled = true
      and up.next_scan_at <= now()
    order by up.next_scan_at asc
    limit max_users
  loop
    breaches_inserted := 0;
    score := 0;
    v_plan := coalesce(u.user_plan, 'free');
    v_email_alerts := coalesce(u.email_alerts, true);
    v_deadline_alerts := coalesce(u.deadline_alerts, true);

    if v_plan = 'premium' then
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

      -----------------------------------------------------------------
      -- SETTLEMENT MATCHING + new_match outbox
      -----------------------------------------------------------------
      for s in
        select id, company, breach_year, payout_min, payout_max, status, name, deadline
        from public.settlements
        where status in ('open','pending')
      loop
        select exists(
          select 1 from public.breach_events b
          where b.user_id = u.user_id and b.scan_run_id = scan_id
            and (lower(b.source) like '%' || lower(s.company) || '%'
              or lower(s.company) like '%' || lower(b.source) || '%')
            and (s.breach_year is null or b.breach_year is null or s.breach_year = b.breach_year)
        ) into hit;

        if hit then
          payout_est := null;
          if s.payout_min is not null and s.payout_max is not null then
            payout_est := (s.payout_min + s.payout_max) / 2;
          end if;

          insert into public.settlement_matches(user_id, settlement_id, scan_run_id, match_reason, status, payout_estimate)
          values (u.user_id, s.id, scan_id, 'Matched via scheduled scan', s.status, payout_est)
          on conflict (user_id, settlement_id) do nothing;

          if found then
            insert into public.alerts(user_id, type, title, body, severity, related_settlement_id, related_scan_run_id)
            values (u.user_id, 'settlement_found', 'New settlement match found',
              'You may qualify for ' || s.name || ' (' || s.company || ')',
              'medium'::public.risk_level_t, s.id, scan_id);
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

          -----------------------------------------------------------------
          -- DEADLINE_SOON check
          -----------------------------------------------------------------
          if s.deadline is not null and v_deadline_alerts then
            days_left := s.deadline - current_date;

            if days_left in (14, 3) or (days_left >= 0 and days_left <= 3) then
              insert into public.alerts(user_id, type, title, body, severity, related_settlement_id)
              values (
                u.user_id, 'deadline_alert',
                case when days_left <= 3 then 'Deadline approaching — file now' else 'Claim deadline reminder' end,
                s.company || ': ' || days_left || ' day(s) left to file for ' || s.name,
                case when days_left <= 3 then 'critical'::public.risk_level_t else 'medium'::public.risk_level_t end,
                s.id
              );
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

      -----------------------------------------------------------------
      -- SCAN_COMPLETE
      -----------------------------------------------------------------
      insert into public.alerts(user_id, type, title, body, severity, related_scan_run_id)
      values (
        u.user_id, 'system', 'Monitoring scan completed',
        case when v_plan = 'premium'
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

      insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
      values (u.user_id, 'in_app', 'scan_complete',
        jsonb_build_object('scan_run_id', scan_id, 'breaches', breaches_inserted, 'score', score),
        'scan_complete:' || u.user_id || ':' || date_trunc('hour', now())::text
      ) on conflict (dedupe_key) where dedupe_key is not null do nothing;

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

  update public.scan_run_log
  set status='success', finished_at=now(), processed_users=v_processed, alerts_enqueued=v_alerts
  where id=v_log_id;

  perform pg_advisory_unlock(hashtext('breachpay:scheduled_scans'));

exception when others then
  update public.scan_run_log
  set status='failed', finished_at=now(), processed_users=v_processed, alerts_enqueued=v_alerts, last_error=sqlerrm
  where id=v_log_id;
  perform pg_advisory_unlock(hashtext('breachpay:scheduled_scans'));
  raise;
end;
$procedure$;

-- 2) Add next_attempt_at column + index for retry backoff
ALTER TABLE public.notification_outbox
ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_outbox_pending_next
ON public.notification_outbox(status, next_attempt_at, created_at);

-- 3) Update proc_claim_outbox to respect next_attempt_at
CREATE OR REPLACE FUNCTION public.proc_claim_outbox(batch_size integer DEFAULT 50)
 RETURNS SETOF notification_outbox
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with cte as (
    select id
    from public.notification_outbox
    where status = 'pending'
      and attempts < 8
      and (next_attempt_at is null or next_attempt_at <= now())
    order by created_at asc
    limit batch_size
    for update skip locked
  )
  update public.notification_outbox o
  set status = 'sending',
      attempts = attempts + 1
  from cte
  where o.id = cte.id
  returning o.*;
$function$;

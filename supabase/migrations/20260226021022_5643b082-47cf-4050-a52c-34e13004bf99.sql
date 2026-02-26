
-- Add confidence scoring columns to settlement_matches
ALTER TABLE public.settlement_matches
  ADD COLUMN IF NOT EXISTS confidence_score integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'medium';

-- Update proc_rebuild_settlement_matches with confidence scoring
CREATE OR REPLACE PROCEDURE public.proc_rebuild_settlement_matches()
 LANGUAGE plpgsql
AS $procedure$
declare
  u record;
  s record;
  conf int;
  conf_level text;
  reasons text[];
  payout_est numeric;
  company_match boolean;
  year_match boolean;
begin
  for u in select distinct user_id from public.breach_events loop
    for s in
      select id, company, breach_year, payout_min, payout_max, status
      from public.settlements where status in ('open','verified')
    loop
      -- Reset per settlement
      conf := 0;
      reasons := array[]::text[];
      company_match := false;
      year_match := false;

      -- Check company match
      if exists (
        select 1 from public.breach_events b
        where b.user_id = u.user_id
          and (lower(b.source) like '%' || lower(s.company) || '%'
            or lower(s.company) like '%' || lower(b.source) || '%')
      ) then
        company_match := true;
        conf := conf + 50;
        reasons := array_append(reasons, 'Company name matched');
      end if;

      if not company_match then continue; end if;

      -- Check breach year match
      if s.breach_year is not null and exists (
        select 1 from public.breach_events b
        where b.user_id = u.user_id
          and (lower(b.source) like '%' || lower(s.company) || '%'
            or lower(s.company) like '%' || lower(b.source) || '%')
          and b.breach_year = s.breach_year
      ) then
        year_match := true;
        conf := conf + 30;
        reasons := array_append(reasons, 'Breach year matched (' || s.breach_year || ')');
      elsif s.breach_year is null then
        conf := conf + 10;
        reasons := array_append(reasons, 'No breach year filter on settlement');
      end if;

      -- Bonus: exact source name match
      if exists (
        select 1 from public.breach_events b
        where b.user_id = u.user_id
          and lower(b.source) = lower(s.company)
      ) then
        conf := conf + 10;
        reasons := array_append(reasons, 'Exact company name match');
      end if;

      -- Bonus: multiple breach events for same company
      if (select count(*) from public.breach_events b
          where b.user_id = u.user_id
            and (lower(b.source) like '%' || lower(s.company) || '%'
              or lower(s.company) like '%' || lower(b.source) || '%')
         ) > 1 then
        conf := conf + 10;
        reasons := array_append(reasons, 'Multiple breach exposures from same company');
      end if;

      -- Clamp
      if conf > 100 then conf := 100; end if;

      -- Determine level
      conf_level := case
        when conf >= 80 then 'strong'
        when conf >= 50 then 'medium'
        else 'weak'
      end;

      payout_est := null;
      if s.payout_min is not null and s.payout_max is not null then
        payout_est := (s.payout_min + s.payout_max) / 2;
      end if;

      insert into public.settlement_matches(user_id, settlement_id, match_reason, status, payout_estimate, confidence_score, confidence_level)
      values (u.user_id, s.id, array_to_string(reasons, '; '), s.status, payout_est, conf, conf_level)
      on conflict (user_id, settlement_id) do update set
        match_reason = array_to_string(reasons, '; '),
        payout_estimate = payout_est,
        confidence_score = conf,
        confidence_level = conf_level;

    end loop;
  end loop;
end;
$procedure$;

-- Also update the scheduled scan matching with confidence scoring
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
  conf int;
  conf_level text;
  match_reasons text[];
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

      -- SETTLEMENT MATCHING with confidence scoring
      for s in
        select id, company, breach_year, payout_min, payout_max, status, name, deadline
        from public.settlements where status in ('open','verified')
      loop
        conf := 0;
        match_reasons := array[]::text[];

        -- Company match check
        select exists(
          select 1 from public.breach_events b
          where b.user_id = u.user_id and b.scan_run_id = scan_id
            and (lower(b.source) like '%' || lower(s.company) || '%' or lower(s.company) like '%' || lower(b.source) || '%')
        ) into hit;

        if not hit then continue; end if;

        conf := 50;
        match_reasons := array_append(match_reasons, 'Company matched');

        -- Year match
        if s.breach_year is not null and exists (
          select 1 from public.breach_events b
          where b.user_id = u.user_id and b.scan_run_id = scan_id
            and (lower(b.source) like '%' || lower(s.company) || '%' or lower(s.company) like '%' || lower(b.source) || '%')
            and b.breach_year = s.breach_year
        ) then
          conf := conf + 30;
          match_reasons := array_append(match_reasons, 'Year matched (' || s.breach_year || ')');
        elsif s.breach_year is null then
          conf := conf + 10;
        end if;

        -- Exact name
        if exists (select 1 from public.breach_events b where b.user_id = u.user_id and b.scan_run_id = scan_id and lower(b.source) = lower(s.company)) then
          conf := conf + 10;
          match_reasons := array_append(match_reasons, 'Exact name match');
        end if;

        if conf > 100 then conf := 100; end if;
        conf_level := case when conf >= 80 then 'strong' when conf >= 50 then 'medium' else 'weak' end;

        payout_est := null;
        if s.payout_min is not null and s.payout_max is not null then payout_est := (s.payout_min + s.payout_max) / 2; end if;

        insert into public.settlement_matches(user_id, settlement_id, scan_run_id, match_reason, status, payout_estimate, confidence_score, confidence_level)
        values (u.user_id, s.id, scan_id, array_to_string(match_reasons, '; '), s.status, payout_est, conf, conf_level)
        on conflict (user_id, settlement_id) do update set
          match_reason = array_to_string(match_reasons, '; '),
          payout_estimate = payout_est,
          confidence_score = conf,
          confidence_level = conf_level;

        -- Only alert/notify on NEW inserts (xmax = 0 means insert not update)
        if (select xmax = 0 from public.settlement_matches where user_id = u.user_id and settlement_id = s.id) then
          insert into public.alerts(user_id, type, title, body, severity, related_settlement_id, related_scan_run_id)
          values (u.user_id, 'settlement_found', 'New settlement match found',
            'You may qualify for ' || s.name || ' (' || s.company || ') — ' || conf_level || ' match',
            'medium'::public.risk_level_t, s.id, scan_id);
          v_alerts := v_alerts + 1;

          insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
          values (u.user_id, 'in_app', 'new_match',
            jsonb_build_object('settlement_id', s.id, 'settlement_name', s.name, 'company', s.company, 'payout_estimate', payout_est, 'confidence', conf_level),
            'new_match:' || u.user_id || ':' || s.id
          ) on conflict (dedupe_key) where dedupe_key is not null do nothing;

          if v_email_alerts then
            insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
            values (u.user_id, 'email', 'new_match',
              jsonb_build_object('settlement_id', s.id, 'settlement_name', s.name, 'company', s.company, 'payout_estimate', payout_est, 'confidence', conf_level),
              'new_match_email:' || u.user_id || ':' || s.id
            ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
          end if;
        end if;

        -- Deadline alerts
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

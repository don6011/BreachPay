
create or replace procedure public.proc_run_scheduled_scans_catalog_demo(max_users int default 50)
language plpgsql
as $$
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
begin
  select count(*) into catalog_count
  from public.breach_catalog
  where active = true and verified = true;

  if catalog_count = 0 then
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
end;
$$;

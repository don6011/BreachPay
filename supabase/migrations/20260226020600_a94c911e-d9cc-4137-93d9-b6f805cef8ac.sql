
-- One-off: backfill settlement matches for verified settlements
DO $$
declare
  u record;
  s record;
  hit boolean;
  payout_est numeric;
  match_count int := 0;
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

        if found then match_count := match_count + 1; end if;
      end if;
    end loop;
  end loop;
  raise notice 'Backfill complete: % new matches inserted', match_count;
end;
$$;

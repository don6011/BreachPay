-- ============================================================
-- Product Events table (user funnel tracking)
-- ============================================================
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_name_time on public.product_events(event_name, created_at desc);
create index if not exists idx_events_user_time on public.product_events(user_id, created_at desc);

alter table public.product_events enable row level security;

-- Users can insert their own events
create policy "pe_insert_own" on public.product_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- Users can read their own events
create policy "pe_select_own" on public.product_events
  for select to authenticated
  using (user_id = auth.uid());

-- Admins full access
create policy "pe_admin_all" on public.product_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Admin Audit Log (immutable compliance trail)
-- ============================================================
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_time on public.admin_audit_log(created_at desc);
create index if not exists idx_admin_audit_entity on public.admin_audit_log(entity_type, entity_id);

alter table public.admin_audit_log enable row level security;

-- Only admins can read audit logs
create policy "aal_select_admin" on public.admin_audit_log
  for select to authenticated
  using (public.is_admin());

-- Only admins can insert (via RPCs)
create policy "aal_insert_admin" on public.admin_audit_log
  for insert to authenticated
  with check (public.is_admin());

-- No update or delete allowed (immutable)

-- ============================================================
-- Update RPCs with audit logging (before/after snapshots)
-- ============================================================

-- rpc_admin_mark_claim_paid with audit
create or replace function public.rpc_admin_mark_claim_paid(
  p_claim_id uuid,
  p_amount numeric,
  p_method text default 'unknown',
  p_external_ref text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  -- Capture before snapshot
  select row_to_json(c.*)::jsonb into v_before
  from public.claims c where c.id = p_claim_id;

  if v_before is null then
    raise exception 'Claim not found';
  end if;

  v_user_id := (v_before->>'user_id')::uuid;

  update public.claims
  set status='paid', paid_at=now(), final_payout=p_amount, updated_at=now()
  where id = p_claim_id;

  insert into public.payouts(user_id, claim_id, amount, method, status, paid_at, external_ref)
  values (v_user_id, p_claim_id, p_amount, p_method, 'paid', now(), p_external_ref)
  on conflict (claim_id) do update set
    amount=excluded.amount, method=excluded.method, status='paid',
    paid_at=excluded.paid_at, external_ref=excluded.external_ref;

  insert into public.claim_payout_events(claim_id, event_type, meta, created_by)
  values (p_claim_id, 'marked_paid',
    jsonb_build_object('amount', p_amount, 'method', p_method, 'external_ref', p_external_ref),
    auth.uid());

  update public.referrals set status='invoiced'
  where claim_id = p_claim_id and status='pending';

  insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
  values (v_user_id, 'in_app', 'payout_paid',
    jsonb_build_object('claim_id', p_claim_id, 'amount', p_amount, 'method', p_method),
    'payout_paid:' || v_user_id || ':' || p_claim_id)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
  values (v_user_id, 'email', 'payout_paid',
    jsonb_build_object('claim_id', p_claim_id, 'amount', p_amount, 'method', p_method),
    'payout_paid_email:' || v_user_id || ':' || p_claim_id)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  -- Audit log
  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(), 'mark_claim_paid', 'claim', p_claim_id,
    v_before,
    (select row_to_json(c.*)::jsonb from public.claims c where c.id = p_claim_id)
  );

  -- Product event
  insert into public.product_events(user_id, event_name, meta)
  values (auth.uid(), 'payout_marked_paid',
    jsonb_build_object('claim_id', p_claim_id, 'amount', p_amount, 'method', p_method));
end;
$$;

revoke all on function public.rpc_admin_mark_claim_paid(uuid,numeric,text,text) from public;
grant execute on function public.rpc_admin_mark_claim_paid(uuid,numeric,text,text) to authenticated;

-- rpc_admin_generate_partner_invoices with audit
create or replace function public.rpc_admin_generate_partner_invoices(
  p_period_start date,
  p_period_end date
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  v_invoice_id uuid;
  v_subtotal numeric;
  v_due_date date := p_period_end + 15;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  for r in
    select distinct partner_id
    from public.referrals ref
    where ref.status = 'invoiced'
      and ref.created_at::date between p_period_start and p_period_end
      and exists (select 1 from public.claims c where c.id = ref.claim_id and c.status = 'paid')
  loop
    insert into public.partner_invoices(partner_id, period_start, period_end, status, due_date)
    values (r.partner_id, p_period_start, p_period_end, 'draft', v_due_date)
    returning id into v_invoice_id;

    insert into public.partner_invoice_items(invoice_id, referral_id, description, amount)
    select v_invoice_id, ref.id,
      coalesce('Referral fee for claim ' || ref.claim_id::text, 'Referral fee'),
      coalesce(ref.amount_expected, 0)
    from public.referrals ref
    where ref.partner_id = r.partner_id
      and ref.status = 'invoiced'
      and ref.created_at::date between p_period_start and p_period_end
      and exists (select 1 from public.claims c where c.id = ref.claim_id and c.status = 'paid');

    select coalesce(sum(amount),0) into v_subtotal
    from public.partner_invoice_items where invoice_id = v_invoice_id;

    update public.partner_invoices set subtotal = v_subtotal where id = v_invoice_id;

    -- Audit each invoice
    insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, after)
    values (auth.uid(), 'generate_partner_invoice', 'partner_invoice', v_invoice_id,
      jsonb_build_object('partner_id', r.partner_id, 'subtotal', v_subtotal, 'period', p_period_start || ' to ' || p_period_end));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.rpc_admin_generate_partner_invoices(date,date) from public;
grant execute on function public.rpc_admin_generate_partner_invoices(date,date) to authenticated;

-- rpc_admin_mark_invoice_paid with audit
create or replace function public.rpc_admin_mark_invoice_paid(
  p_invoice_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select row_to_json(pi.*)::jsonb into v_before
  from public.partner_invoices pi where pi.id = p_invoice_id;

  update public.partner_invoices set status='paid', paid_at=now() where id = p_invoice_id;

  update public.referrals r
  set status='paid', amount_paid = coalesce(r.amount_expected, r.amount_paid)
  where r.id in (select referral_id from public.partner_invoice_items where invoice_id = p_invoice_id)
    and r.status in ('invoiced','pending');

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), 'mark_invoice_paid', 'partner_invoice', p_invoice_id,
    v_before,
    (select row_to_json(pi.*)::jsonb from public.partner_invoices pi where pi.id = p_invoice_id));
end;
$$;

revoke all on function public.rpc_admin_mark_invoice_paid(uuid) from public;
grant execute on function public.rpc_admin_mark_invoice_paid(uuid) to authenticated;

-- ============================================================
-- Analytics views
-- ============================================================

-- Daily active scanners
create or replace view public.v_daily_active_scanners as
select
  date_trunc('day', created_at)::date as day,
  count(distinct user_id) as scanner_count
from public.product_events
where event_name = 'scan_started'
group by 1
order by 1 desc;

-- Matches per scan
create or replace view public.v_matches_per_scan as
select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where event_name = 'match_created') as matches,
  count(*) filter (where event_name = 'scan_completed') as scans,
  case when count(*) filter (where event_name = 'scan_completed') > 0
    then round(count(*) filter (where event_name = 'match_created')::numeric / count(*) filter (where event_name = 'scan_completed'), 2)
    else 0
  end as matches_per_scan
from public.product_events
where event_name in ('match_created', 'scan_completed')
group by 1
order by 1 desc;

-- Funnel conversion rates
create or replace view public.v_funnel_rates as
select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where event_name = 'match_viewed') as match_viewed,
  count(*) filter (where event_name = 'claim_started') as claim_started,
  count(*) filter (where event_name = 'claim_submitted') as claim_submitted,
  case when count(*) filter (where event_name = 'match_viewed') > 0
    then round(count(*) filter (where event_name = 'claim_started')::numeric / count(*) filter (where event_name = 'match_viewed') * 100, 1)
    else 0
  end as start_rate_pct,
  case when count(*) filter (where event_name = 'claim_started') > 0
    then round(count(*) filter (where event_name = 'claim_submitted')::numeric / count(*) filter (where event_name = 'claim_started') * 100, 1)
    else 0
  end as submit_rate_pct
from public.product_events
where event_name in ('match_viewed', 'claim_started', 'claim_submitted')
group by 1
order by 1 desc;

-- Time to submit (claim_started -> claim_submitted per claim)
create or replace view public.v_time_to_submit as
select
  s.meta->>'claim_id' as claim_id,
  s.created_at as started_at,
  sub.created_at as submitted_at,
  extract(epoch from (sub.created_at - s.created_at)) / 3600 as hours_to_submit
from public.product_events s
join public.product_events sub
  on sub.event_name = 'claim_submitted'
  and sub.meta->>'claim_id' = s.meta->>'claim_id'
where s.event_name = 'claim_started'
order by s.created_at desc;

-- Time to paid (claim_submitted -> payout_marked_paid)
create or replace view public.v_time_to_paid as
select
  s.meta->>'claim_id' as claim_id,
  s.created_at as submitted_at,
  p.created_at as paid_at,
  extract(epoch from (p.created_at - s.created_at)) / 86400 as days_to_paid
from public.product_events s
join public.product_events p
  on p.event_name = 'payout_marked_paid'
  and p.meta->>'claim_id' = s.meta->>'claim_id'
where s.event_name = 'claim_submitted'
order by s.created_at desc;

-- 1) Admin RPC: Mark Claim Paid
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
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select user_id into v_user_id
  from public.claims
  where id = p_claim_id;

  if v_user_id is null then
    raise exception 'Claim not found';
  end if;

  update public.claims
  set status='paid',
      paid_at=now(),
      final_payout=p_amount,
      updated_at=now()
  where id = p_claim_id;

  insert into public.payouts(user_id, claim_id, amount, method, status, paid_at, external_ref)
  values (v_user_id, p_claim_id, p_amount, p_method, 'paid', now(), p_external_ref)
  on conflict (claim_id) do update set
    amount=excluded.amount,
    method=excluded.method,
    status='paid',
    paid_at=excluded.paid_at,
    external_ref=excluded.external_ref;

  insert into public.claim_payout_events(claim_id, event_type, meta, created_by)
  values (
    p_claim_id,
    'marked_paid',
    jsonb_build_object('amount', p_amount, 'method', p_method, 'external_ref', p_external_ref),
    auth.uid()
  );

  update public.referrals
  set status='invoiced'
  where claim_id = p_claim_id
    and status='pending';

  insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
  values (
    v_user_id,
    'in_app',
    'payout_paid',
    jsonb_build_object('claim_id', p_claim_id, 'amount', p_amount, 'method', p_method),
    'payout_paid:' || v_user_id || ':' || p_claim_id
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  insert into public.notification_outbox(user_id, channel, template, payload, dedupe_key)
  values (
    v_user_id,
    'email',
    'payout_paid',
    jsonb_build_object('claim_id', p_claim_id, 'amount', p_amount, 'method', p_method),
    'payout_paid_email:' || v_user_id || ':' || p_claim_id
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke all on function public.rpc_admin_mark_claim_paid(uuid,numeric,text,text) from public;
grant execute on function public.rpc_admin_mark_claim_paid(uuid,numeric,text,text) to authenticated;

-- 2) Admin RPC: Generate Partner Invoices
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
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  for r in
    select distinct partner_id
    from public.referrals
    where status = 'invoiced'
      and created_at::date between p_period_start and p_period_end
  loop
    insert into public.partner_invoices(partner_id, period_start, period_end, status)
    values (r.partner_id, p_period_start, p_period_end, 'draft')
    returning id into v_invoice_id;

    insert into public.partner_invoice_items(invoice_id, referral_id, description, amount)
    select
      v_invoice_id,
      ref.id,
      coalesce('Referral fee for claim ' || ref.claim_id::text, 'Referral fee'),
      coalesce(ref.amount_expected, 0)
    from public.referrals ref
    where ref.partner_id = r.partner_id
      and ref.status = 'invoiced'
      and ref.created_at::date between p_period_start and p_period_end;

    select coalesce(sum(amount),0) into v_subtotal
    from public.partner_invoice_items
    where invoice_id = v_invoice_id;

    update public.partner_invoices
    set subtotal = v_subtotal
    where id = v_invoice_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.rpc_admin_generate_partner_invoices(date,date) from public;
grant execute on function public.rpc_admin_generate_partner_invoices(date,date) to authenticated;

-- 3) Admin RPC: Mark Invoice Paid
create or replace function public.rpc_admin_mark_invoice_paid(
  p_invoice_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  update public.partner_invoices
  set status='paid', paid_at=now()
  where id = p_invoice_id;

  update public.referrals r
  set status='paid', amount_paid = coalesce(r.amount_expected, r.amount_paid)
  where r.id in (
    select referral_id from public.partner_invoice_items where invoice_id = p_invoice_id
  )
    and r.status in ('invoiced','pending');
end;
$$;

revoke all on function public.rpc_admin_mark_invoice_paid(uuid) from public;
grant execute on function public.rpc_admin_mark_invoice_paid(uuid) to authenticated;

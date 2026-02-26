-- Update invoice generation RPC to only include referrals tied to paid claims
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
    from public.referrals ref
    where ref.status = 'invoiced'
      and ref.created_at::date between p_period_start and p_period_end
      and exists (select 1 from public.claims c where c.id = ref.claim_id and c.status = 'paid')
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
      and ref.created_at::date between p_period_start and p_period_end
      and exists (select 1 from public.claims c where c.id = ref.claim_id and c.status = 'paid');

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

-- Add unique constraint for referral upsert if not exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_claim_partner_unique'
  ) then
    alter table public.referrals add constraint referrals_claim_partner_unique unique (claim_id, partner_id);
  end if;
end $$;

revoke all on function public.rpc_admin_generate_partner_invoices(date,date) from public;
grant execute on function public.rpc_admin_generate_partner_invoices(date,date) to authenticated;
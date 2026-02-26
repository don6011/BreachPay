-- Add due_date column to partner_invoices for Net 15 payment terms
alter table public.partner_invoices add column if not exists due_date date;

-- Set default due_date for existing invoices: period_end + 15 days
update public.partner_invoices set due_date = period_end::date + interval '15 days' where due_date is null;

-- Update invoice generation RPC to set due_date = period_end + 15 (Net 15)
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
  v_due_date date := p_period_end + 15; -- Net 15
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

revoke all on function public.rpc_admin_generate_partner_invoices(date,date) from public;
grant execute on function public.rpc_admin_generate_partner_invoices(date,date) to authenticated;
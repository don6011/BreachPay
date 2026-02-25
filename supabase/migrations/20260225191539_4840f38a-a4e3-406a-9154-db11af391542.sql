
-- 1) SKIP LOCKED outbox claim function
create or replace function public.proc_claim_outbox(batch_size int default 50)
returns setof public.notification_outbox
language sql
security definer
set search_path = 'public'
as $$
  with cte as (
    select id
    from public.notification_outbox
    where status = 'pending'
      and attempts < 8
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
$$;

revoke all on function public.proc_claim_outbox(int) from public;
grant execute on function public.proc_claim_outbox(int) to service_role;

-- 2) Index for fast outbox queue polling
create index if not exists idx_outbox_status_created
on public.notification_outbox(status, created_at);

-- 3) Ensure dedupe unique index exists
create unique index if not exists uq_notification_outbox_dedupe_key
on public.notification_outbox(dedupe_key)
where dedupe_key is not null;

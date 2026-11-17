# Edge function access control — required setup before deploying

Four edge functions used to run for anyone who knew the URL. They now require
either a signed-in **admin** or a shared **cron secret**:

| Function | Who calls it |
| --- | --- |
| `dispatch-notifications` | pg_cron, every 2 minutes |
| `run-settlement-discovery` | pg_cron daily at 03:00 UTC, and the admin "Run discovery" button |
| `process-scan-queue` | the admin Cron page |
| `ai-document-review` | no caller in this repo |

The admin buttons keep working as-is (they already send the admin's session
token). **The two pg_cron jobs will get `401` until you do the steps below**,
because they currently send the public anon key, which is no longer accepted.
Until then no notification emails go out and daily discovery does not run.

## 1. Create a secret

Generate a long random value (for example `openssl rand -hex 32`). Do not commit it.

- Add it as an edge function secret named `CRON_SECRET`.
- Store the same value in Supabase Vault (SQL editor):

```sql
select vault.create_secret('PASTE_THE_VALUE_HERE', 'cron_secret');
```

## 2. Point the cron jobs at the secret

Run in the SQL editor. Each job reads the secret from Vault at run time, so the
value never appears in a migration or in `cron.job`.

```sql
select cron.unschedule('dispatch_notifications_2m');
select cron.schedule(
  'dispatch_notifications_2m',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://zmjikithlaxeldvsmklz.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.unschedule('daily-settlement-discovery');
select cron.schedule(
  'daily-settlement-discovery',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://zmjikithlaxeldvsmklz.supabase.co/functions/v1/run-settlement-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Check `select jobname from cron.job;` first: if a job name differs in your
database, use the name shown there.

## 3. Verify

```sql
select status_code, content::text, created
from net._http_response order by created desc limit 5;
```

You should see `200` responses. A `401` means the function secret and the Vault
value do not match.

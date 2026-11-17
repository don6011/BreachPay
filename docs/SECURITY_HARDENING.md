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

Then add the two email jobs (deadline reminders daily at 15:00 UTC, the weekly
email on Mondays at 14:00 UTC):

```sql
select cron.schedule(
  'subscription-deadline-reminders',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://zmjikithlaxeldvsmklz.supabase.co/functions/v1/send-subscription-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'subscription-weekly-digest',
  '0 14 * * 1',
  $$
  select net.http_post(
    url := 'https://zmjikithlaxeldvsmklz.supabase.co/functions/v1/send-subscription-emails?mode=weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

## 3. Verify

```sql
select status_code, content::text, created
from net._http_response order by created desc limit 5;
```

You should see `200` responses. A `401` means the function secret and the Vault
value do not match.

## 4. Function settings that are now off by default

These backend functions refuse requests unless a function secret turns them on.
Leave them off until the thing they do is real:

| Secret | Turns on | Why it's off |
| --- | --- | --- |
| `PARTNER_API_ENABLED=true` | `enterprise-api`, `partner-intake-breach`, `partner-intake-claim` | Partner intake creates accounts for other people's email addresses without their consent. Fix that before enabling. |
| `AI_SUPPORT_ENABLED=true` | `ai-support` | It tells people their question was escalated to a team. |
| `SCHEDULED_SCANS_ENABLED=true` | `run-scheduled-scans` | It writes generated breach results, not real ones. |
| `PAYOUTS_ENABLED=true` | payout emails in `dispatch-notifications` | BreachPay doesn't handle payouts. |

Optional: set `SUBSCRIBE_SALT` to a random value. It's used to hash the
network address of email sign-ups for abuse limits; without it a value
derived from the service key is used.

## 5. Settlements table access (migration `20261117160000`)

Applying the migrations locks the settlements table down. Visitors and regular
users can read only published listings, and only public columns. Internal
notes, credibility scores, the author and the source are admin-only, and the
admin console reads them through `admin_settlement_internal()`. Backend
functions use the service role and are unaffected. The scraper's source list is
also admin-only now.

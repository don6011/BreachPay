# BreachPay: what changed and what to do before launch

BreachPay is now a free, independent directory of data breach settlements, plus
an optional free account for a breach check (Have I Been Pwned) and a personal
claim tracker. Everything that promised something the product can't deliver is
switched off rather than deleted, so it can come back when it's real.

## Before you deploy

1. **Cron secret.** Follow `docs/SECURITY_HARDENING.md`. Until then, notification
   emails and daily discovery get `401`.
2. **Set these environment variables** where the site is built:
   - `VITE_SITE_URL`: the real domain, e.g. `https://breachpay.com`. Canonical
     links, the sitemap and social cards use it. It defaults to
     `https://breachpay.com`, so set it if that isn't your domain.
   - `VITE_SUPPORT_EMAIL`: a monitored inbox. When set, it appears in the footer,
     Help and legal pages. When unset, no contact address is shown.
3. **Stop the demo scan job.** The hourly scheduled scan creates breach results
   from the internal catalog, not from a real lookup. The app now hides its
   output, but it should not run. In the SQL editor:
   ```sql
   select jobid, jobname, schedule from cron.job;   -- find the scheduled-scan job
   select cron.unschedule('<that job name>');
   ```
4. **Read the new Terms and Privacy pages** (`/terms`, `/privacy`) and adjust
   anything that doesn't match how you run the service. They are plain-language
   descriptions, not legal review.

## How the public pages work

- `vite build` now pre-renders the home page, the directory
  (`/data-breach-settlements`), every published settlement, every company page,
  and the Pricing, Help, Terms and Privacy pages to static HTML, and writes
  `sitemap.xml` and `robots.txt`.
- At build time it reads published settlements from Supabase with the public
  key: `verified = true`, not demo, not test, not rejected, not pending review.
  Only public columns reach the HTML.
- If Supabase can't be reached during the build, the build still succeeds and
  pages load their data in the browser. Set `PRERENDER_STRICT=1` to make that a
  failure instead, or `PRERENDER=0` to skip it.
- **Rebuild regularly** (daily is plenty) so new listings get their own static
  pages and enter the sitemap. Pages also refresh their data in the browser, so
  deadlines stay current between builds.
- Submit `https://<your domain>/sitemap.xml` in Google Search Console.

## Trust rules the code now follows

- Payouts are shown exactly as recorded; missing amounts say "not listed".
- Deadlines come from the record; missing ones say so. Expired or closed
  settlements are labeled closed.
- Claim links show their web address before you click. Links not confirmed as
  the official administrator site are flagged.
- Review badges describe how many editorial checks a listing passed. They no
  longer claim a court or administrator confirmed anything.
- A "match" is always described as possibly related, never as eligibility.
- Every page says BreachPay is not a law firm or administrator and filing is free.
- Emails no longer mention payouts, approvals or "estimated" amounts.

## What's switched off (`src/config/features.ts`)

| Switch | Why it's off |
| --- | --- |
| `payouts` | Administrators pay claimants directly; BreachPay never holds money. Wallet, payouts and bank-detail screens are hidden, and payout emails are skipped unless the `PAYOUTS_ENABLED=true` function secret is set. |
| `paidPlans` | No payment provider is connected. Pricing now says the service is free. |
| `partnerOffers` | No partner agreements or links exist. |
| `referralRewards` | There is no way to pay a reward. |
| `scheduledScans` | The scheduled job doesn't query a real breach source. |
| `documentUploads` | Claims are filed on the administrator's site; storing ID documents adds risk without helping. |
| `claimPackets` | The wizard collected personal details and marked claims "submitted" without filing anything. Users now file on the official site and click "I've filed this". |
| `aiSupport` | It told people questions were escalated to a team. `/support` now goes to `/help`. |

The `submit-claim-partner` function now refuses instead of faking a submission.

## Other fixes in this round

- Breach-to-settlement matching was very loose (any shared substring, any
  status). It now matches on company name or website, only against published
  settlements open for claims.
- A 10-minute cooldown between breach checks protects the HIBP quota.
- Account deletion now also removes uploaded files and the remaining user tables.
- The signed-in app works on phones (slide-out menu).
- New pages: Help, a real 404, and redirects from old `/settlements/:id`,
  `/check/:slug` and claim-wizard links.

## Email reminders and the weekly digest

- Settlement pages offer "Get a reminder before it closes" (emails 7 days and
  1 day before the deadline). The home page and directory offer one weekly email
  with new or updated settlements and deadlines in the next two weeks.
- No account needed. Every address confirms by email first (double opt-in),
  the confirm and unsubscribe pages wait for a click so mail scanners can't act
  for people, and every email has one-click unsubscribe headers.
- Abuse limits: 10 sign-ups per hour per network address, one confirmation
  email per address every 10 minutes, unconfirmed sign-ups deleted after 7 days.
- Needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `APP_BASE_URL` function
  secrets, plus the two cron jobs in `docs/SECURITY_HARDENING.md`.

## Still open

- **Partner intake consent.** Before turning on the partner APIs, change
  intake so it invites people instead of creating accounts for them.
- **Listing quality is the growth lever.** Traffic depends on having many
  accurate, current settlements with official claim links. Check that the
  discovery job's output is being reviewed and published.

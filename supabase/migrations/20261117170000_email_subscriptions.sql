-- Email reminders and a weekly digest for people without an account.
--
-- Every address is confirmed by email before anything else is sent to it
-- (double opt-in). Each email carries a one-click unsubscribe link.
-- Only backend functions (service role) touch this table: row level security
-- is on and there are deliberately no policies for anon or authenticated.

CREATE TABLE IF NOT EXISTS public.email_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email) AND length(email) <= 254),
  kind text NOT NULL CHECK (kind IN ('deadline', 'weekly')),
  -- Set for deadline reminders, empty for the weekly digest.
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE CASCADE,
  -- SHA-256 of the confirmation token; the token itself is only in the email.
  confirm_token_hash text,
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  -- Random token in every email's unsubscribe link. It can only unsubscribe.
  unsubscribe_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  unsubscribed_at timestamptz,
  -- Deadline reminders already sent, as days-before (e.g. {7,1}).
  reminders_sent integer[] NOT NULL DEFAULT '{}',
  last_sent_at timestamptz,
  -- Hashed requester address, used only to limit sign-up abuse.
  requester_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_subscriptions_settlement_matches_kind CHECK (
    (kind = 'deadline' AND settlement_id IS NOT NULL) OR (kind = 'weekly' AND settlement_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS email_subscriptions_unique
  ON public.email_subscriptions (email, kind, coalesce(settlement_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS email_subscriptions_confirm_token
  ON public.email_subscriptions (confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_subscriptions_active
  ON public.email_subscriptions (kind) WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;
CREATE INDEX IF NOT EXISTS email_subscriptions_requester
  ON public.email_subscriptions (requester_hash, created_at);

ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_subscriptions FROM anon, authenticated;

-- Admins can see subscriber counts in the console.
DROP POLICY IF EXISTS "email_subscriptions_admin_read" ON public.email_subscriptions;
CREATE POLICY "email_subscriptions_admin_read" ON public.email_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
GRANT SELECT ON public.email_subscriptions TO authenticated;

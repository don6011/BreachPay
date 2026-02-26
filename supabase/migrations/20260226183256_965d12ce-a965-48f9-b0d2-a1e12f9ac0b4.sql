
-- Enterprise API key management
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  label text DEFAULT 'Default',
  status text NOT NULL DEFAULT 'active',
  rate_limit integer NOT NULL DEFAULT 1000,
  scopes text[] NOT NULL DEFAULT '{settlements}',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_admin_all" ON public.api_keys FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "api_keys_partner_select" ON public.api_keys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM partner_users pu
    WHERE pu.partner_id = api_keys.partner_id AND pu.user_id = auth.uid()
  ));

CREATE POLICY "api_keys_partner_insert" ON public.api_keys FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM partner_users pu
    WHERE pu.partner_id = api_keys.partner_id AND pu.user_id = auth.uid()
    AND pu.role IN ('admin')
  ));

CREATE POLICY "api_keys_partner_update" ON public.api_keys FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM partner_users pu
    WHERE pu.partner_id = api_keys.partner_id AND pu.user_id = auth.uid()
    AND pu.role IN ('admin')
  ));

-- API usage logging
CREATE TABLE public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  status_code integer,
  response_time_ms integer,
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_usage_admin_all" ON public.api_usage_logs FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "api_usage_partner_select" ON public.api_usage_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM api_keys ak
    JOIN partner_users pu ON pu.partner_id = ak.partner_id
    WHERE ak.id = api_usage_logs.api_key_id AND pu.user_id = auth.uid()
  ));

-- Index for rate limiting lookups
CREATE INDEX idx_api_usage_key_time ON public.api_usage_logs (api_key_id, created_at DESC);
CREATE INDEX idx_api_keys_hash ON public.api_keys (key_hash) WHERE status = 'active';

-- Helper function to validate API keys (used by edge functions)
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text)
RETURNS TABLE(key_id uuid, partner_id uuid, rate_limit integer, scopes text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ak.id, ak.partner_id, ak.rate_limit, ak.scopes
  FROM public.api_keys ak
  WHERE ak.key_hash = p_key_hash
    AND ak.status = 'active'
    AND (ak.expires_at IS NULL OR ak.expires_at > now())
  LIMIT 1;
$$;

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key_id uuid, p_limit integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT SUM(request_count) FROM public.api_usage_logs
     WHERE api_key_id = p_key_id
       AND created_at > now() - interval '1 hour') < p_limit,
    true
  );
$$;

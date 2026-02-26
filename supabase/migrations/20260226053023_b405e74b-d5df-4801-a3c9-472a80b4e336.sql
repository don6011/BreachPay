
-- Drop old claim_packet_shares table + RPC (replaced by new design)
DROP FUNCTION IF EXISTS public.rpc_create_packet_share(uuid, integer);
DROP TABLE IF EXISTS public.claim_packet_shares;

-- 1) claim_packets table
CREATE TABLE IF NOT EXISTS public.claim_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'generated',
  pdf_storage_path text,
  pdf_file_name text,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb,
  last_error text
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_claim_packet_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('generated', 'failed') THEN
    RAISE EXCEPTION 'Invalid claim_packets status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_claim_packet_status
BEFORE INSERT OR UPDATE ON public.claim_packets
FOR EACH ROW EXECUTE FUNCTION public.validate_claim_packet_status();

CREATE INDEX IF NOT EXISTS idx_claim_packets_claim ON public.claim_packets(claim_id, generated_at DESC);

ALTER TABLE public.claim_packets ENABLE ROW LEVEL SECURITY;

-- Owner can see their own packets
CREATE POLICY "claim_packets_owner_select" ON public.claim_packets
FOR SELECT USING (
  generated_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_id AND c.user_id = auth.uid())
);

-- Owner can insert
CREATE POLICY "claim_packets_owner_insert" ON public.claim_packets
FOR INSERT WITH CHECK (generated_by = auth.uid());

-- Admin full access
CREATE POLICY "claim_packets_admin_all" ON public.claim_packets
FOR ALL USING (public.is_admin(auth.uid()));

-- 2) claim_share_links table
CREATE TABLE IF NOT EXISTS public.claim_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'packet',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  access_count int NOT NULL DEFAULT 0
);

-- Validation trigger for scope
CREATE OR REPLACE FUNCTION public.validate_share_link_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.scope NOT IN ('packet', 'packet_and_evidence') THEN
    RAISE EXCEPTION 'Invalid claim_share_links scope: %', NEW.scope;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_share_link_scope
BEFORE INSERT OR UPDATE ON public.claim_share_links
FOR EACH ROW EXECUTE FUNCTION public.validate_share_link_scope();

CREATE INDEX IF NOT EXISTS idx_share_links_claim ON public.claim_share_links(claim_id);
CREATE INDEX IF NOT EXISTS idx_share_links_valid ON public.claim_share_links(expires_at) WHERE revoked_at IS NULL;

ALTER TABLE public.claim_share_links ENABLE ROW LEVEL SECURITY;

-- Owner can see/manage their share links
CREATE POLICY "share_links_owner_select" ON public.claim_share_links
FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_id AND c.user_id = auth.uid())
);

CREATE POLICY "share_links_owner_insert" ON public.claim_share_links
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_id AND c.user_id = auth.uid())
);

CREATE POLICY "share_links_owner_update" ON public.claim_share_links
FOR UPDATE USING (created_by = auth.uid());

-- Admin full access
CREATE POLICY "share_links_admin_all" ON public.claim_share_links
FOR ALL USING (public.is_admin(auth.uid()));

-- 3) Create private storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-packets', 'claim-packets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for claim-packets bucket
CREATE POLICY "claim_packets_bucket_owner_select" ON storage.objects
FOR SELECT USING (bucket_id = 'claim-packets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "claim_packets_bucket_owner_insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'claim-packets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "claim_packets_bucket_admin_all" ON storage.objects
FOR ALL USING (bucket_id = 'claim-packets' AND public.is_admin(auth.uid()));

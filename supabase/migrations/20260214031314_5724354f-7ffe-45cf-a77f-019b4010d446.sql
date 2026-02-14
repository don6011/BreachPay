
-- ============================================================
-- STORAGE: RLS policies for claim-documents bucket
-- ============================================================

-- Users can read their own claim docs; admins can read all
CREATE POLICY "read_own_claim_docs_or_admin"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'claim-documents'
  AND (
    public.is_admin()
    OR storage.objects.name LIKE (auth.uid()::text || '/%')
  )
);

-- Users can upload only into their own folder prefix
CREATE POLICY "upload_claim_docs_own_folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'claim-documents'
  AND (storage.objects.name LIKE (auth.uid()::text || '/%'))
);

-- Users can delete their own uploads; admins can delete all
CREATE POLICY "delete_own_claim_docs_or_admin"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'claim-documents'
  AND (
    public.is_admin()
    OR storage.objects.name LIKE (auth.uid()::text || '/%')
  )
);

-- ============================================================
-- PAYOUTS: Add currency, stripe_ref, updated_at columns
-- ============================================================
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS stripe_ref text;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Update status check constraint to include 'processing'
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_status_check;
ALTER TABLE public.payouts ADD CONSTRAINT payouts_status_check CHECK (status IN ('pending', 'processing', 'paid', 'failed'));

-- Drop old payouts policies and recreate with is_admin()
DROP POLICY IF EXISTS "Admins manage all payouts" ON public.payouts;
DROP POLICY IF EXISTS "Users view own payouts" ON public.payouts;

CREATE POLICY "payouts_select_own_or_admin" ON public.payouts FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "payouts_admin_write" ON public.payouts FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "payouts_admin_update" ON public.payouts FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Add updated_at trigger
CREATE TRIGGER set_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

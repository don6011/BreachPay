
-- Add missing columns to claim_documents
ALTER TABLE public.claim_documents
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS user_notes text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill file_name from existing note column
UPDATE public.claim_documents SET file_name = COALESCE(note, 'unknown') WHERE file_name IS NULL;
ALTER TABLE public.claim_documents ALTER COLUMN file_name SET NOT NULL;

-- Backfill doc_type from existing file_type column
UPDATE public.claim_documents SET doc_type = COALESCE(file_type, 'other') WHERE doc_type = 'other' AND file_type IS NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_claim_documents_user_id ON public.claim_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id ON public.claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_documents_status ON public.claim_documents(status);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER set_claim_documents_updated_at
  BEFORE UPDATE ON public.claim_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Drop existing RLS policies to replace them
DROP POLICY IF EXISTS "claim_documents_select_own_or_admin" ON public.claim_documents;
DROP POLICY IF EXISTS "claim_documents_select_partner" ON public.claim_documents;
DROP POLICY IF EXISTS "claim_documents_insert_own_or_admin" ON public.claim_documents;
DROP POLICY IF EXISTS "claim_documents_update_admin_or_owner" ON public.claim_documents;
DROP POLICY IF EXISTS "claim_documents_delete_admin" ON public.claim_documents;

-- New RLS policies
-- Users can SELECT their own docs
CREATE POLICY "cd_select_own"
  ON public.claim_documents FOR SELECT
  USING (user_id = auth.uid());

-- Admin can SELECT all
CREATE POLICY "cd_select_admin"
  ON public.claim_documents FOR SELECT
  USING (is_admin());

-- Partner can SELECT docs for claims assigned to them
CREATE POLICY "cd_select_partner"
  ON public.claim_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM claims c WHERE c.id = claim_documents.claim_id AND c.partner_id = auth.uid()
  ));

-- Users can INSERT their own docs
CREATE POLICY "cd_insert_own"
  ON public.claim_documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admin can INSERT
CREATE POLICY "cd_insert_admin"
  ON public.claim_documents FOR INSERT
  WITH CHECK (is_admin());

-- Admin can UPDATE all
CREATE POLICY "cd_update_admin"
  ON public.claim_documents FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Users can DELETE their own docs only if status = 'uploaded'
CREATE POLICY "cd_delete_own_uploaded"
  ON public.claim_documents FOR DELETE
  USING (user_id = auth.uid() AND status = 'uploaded');

-- Admin can DELETE all
CREATE POLICY "cd_delete_admin"
  ON public.claim_documents FOR DELETE
  USING (is_admin());

-- Storage policies for claim-documents bucket
-- Drop existing storage policies for this bucket to avoid conflicts
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Users can read their own files
CREATE POLICY "cd_storage_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'claim-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admin can read all files
CREATE POLICY "cd_storage_select_admin"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'claim-documents' AND is_admin());

-- Users can upload to their own folder
CREATE POLICY "cd_storage_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'claim-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admin can upload anywhere
CREATE POLICY "cd_storage_insert_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'claim-documents' AND is_admin());

-- Users can delete their own files
CREATE POLICY "cd_storage_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'claim-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admin can delete any file
CREATE POLICY "cd_storage_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'claim-documents' AND is_admin());

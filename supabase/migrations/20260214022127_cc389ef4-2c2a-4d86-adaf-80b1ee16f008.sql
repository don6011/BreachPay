
-- Add verified fields to claim_documents
ALTER TABLE public.claim_documents
ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by uuid,
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

-- Admin policy for claim_documents (view + update verified status)
CREATE POLICY "Admins manage all claim documents"
ON public.claim_documents
FOR ALL
USING (public.is_admin(auth.uid()));

-- Storage: allow admins to read all files in claim-documents bucket
CREATE POLICY "Admins can view all claim documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'claim-documents' AND public.is_admin(auth.uid()));

-- Storage: ensure claim owner can read their own files
CREATE POLICY "Users can view own claim documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'claim-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage: ensure claim owner can upload their own files
CREATE POLICY "Users can upload own claim documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'claim-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

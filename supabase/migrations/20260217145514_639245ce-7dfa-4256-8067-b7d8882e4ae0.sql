
-- Storage RLS policies for claim-documents bucket
-- Users can upload to their own folder
CREATE POLICY "Users upload own claim docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read their own claim docs
CREATE POLICY "Users read own claim docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'claim-documents'
  AND (
    -- Owner
    (storage.foldername(name))[1] = auth.uid()::text
    -- Admin
    OR public.is_admin()
    -- Partner assigned to the claim
    OR EXISTS (
      SELECT 1 FROM public.claim_documents cd
      JOIN public.claims c ON c.id = cd.claim_id
      WHERE cd.file_path = name
        AND c.partner_id = auth.uid()
    )
  )
);

-- Users can delete their own uploads
CREATE POLICY "Users delete own claim docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'claim-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin()
  )
);

-- Admins can update (e.g. metadata)
CREATE POLICY "Admins update claim docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'claim-documents'
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'claim-documents'
  AND public.is_admin()
);


-- Create claim_status_history table for activity log/timeline
CREATE TABLE public.claim_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  updated_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claim_status_history ENABLE ROW LEVEL SECURITY;

-- Users can view history for their own claims
CREATE POLICY "Users view own claim history"
  ON public.claim_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_status_history.claim_id
        AND c.user_id = auth.uid()
    )
  );

-- Users can insert history for their own claims
CREATE POLICY "Users insert own claim history"
  ON public.claim_status_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_status_history.claim_id
        AND c.user_id = auth.uid()
    )
  );

-- Admins can manage all claim history
CREATE POLICY "Admins manage claim history"
  ON public.claim_status_history
  FOR ALL
  USING (is_admin(auth.uid()));

-- Create storage bucket for claim documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-documents', 'claim-documents', false);

-- Users can upload their own claim documents
CREATE POLICY "Users upload claim documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'claim-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own claim documents
CREATE POLICY "Users view own claim documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'claim-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own claim documents
CREATE POLICY "Users delete own claim documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'claim-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can view all claim documents
CREATE POLICY "Admins view all claim documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'claim-documents'
    AND is_admin(auth.uid())
  );

-- Add documentation_required to StatusPill (already in enum)
-- Add index for faster claim history lookups
CREATE INDEX idx_claim_status_history_claim_id ON public.claim_status_history(claim_id);

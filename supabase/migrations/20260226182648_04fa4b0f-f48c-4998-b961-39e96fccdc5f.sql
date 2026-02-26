
-- Add disclaimer acceptance timestamp to claim_applications
ALTER TABLE public.claim_applications
ADD COLUMN IF NOT EXISTS disclaimer_accepted_at timestamptz;

-- Create data deletion requests table
CREATE TABLE public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid,
  notes text
);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ddr_select_own" ON public.data_deletion_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "ddr_insert_own" ON public.data_deletion_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "ddr_admin_all" ON public.data_deletion_requests
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

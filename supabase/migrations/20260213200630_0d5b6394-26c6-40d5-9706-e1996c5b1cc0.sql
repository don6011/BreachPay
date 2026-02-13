
-- 1. Payouts table (Wallet & Earnings Layer)
CREATE TABLE public.payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claims(id),
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid')),
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payouts" ON public.payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all payouts" ON public.payouts
  FOR ALL USING (is_admin(auth.uid()));

-- 2. Fraud flags table (Admin Intelligence Layer)
CREATE TABLE public.fraud_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES public.claims(id),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fraud flags" ON public.fraud_flags
  FOR ALL USING (is_admin(auth.uid()));

-- 3. Settlement performance metrics (Admin Intelligence Layer)
CREATE TABLE public.settlement_performance_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id),
  total_matches integer NOT NULL DEFAULT 0,
  total_claims_filed integer NOT NULL DEFAULT 0,
  total_approved integer NOT NULL DEFAULT 0,
  total_paid integer NOT NULL DEFAULT 0,
  total_payout_amount numeric NOT NULL DEFAULT 0,
  avg_payout numeric,
  conversion_rate numeric,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.settlement_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view settlement metrics" ON public.settlement_performance_metrics
  FOR ALL USING (is_admin(auth.uid()));

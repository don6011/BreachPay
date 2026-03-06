
-- User payment methods for direct deposit
CREATE TABLE public.user_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  method_type text NOT NULL DEFAULT 'direct_deposit',
  bank_name text,
  account_holder_name text,
  routing_number_last4 text,
  account_number_last4 text,
  account_type text DEFAULT 'checking',
  is_default boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods"
  ON public.user_payment_methods FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods"
  ON public.user_payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods"
  ON public.user_payment_methods FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods"
  ON public.user_payment_methods FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.trg_validate_payment_method()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.method_type NOT IN ('direct_deposit', 'paypal', 'check') THEN
    RAISE EXCEPTION 'Invalid method_type: %', NEW.method_type;
  END IF;
  IF NEW.account_type NOT IN ('checking', 'savings') THEN
    RAISE EXCEPTION 'Invalid account_type: %', NEW.account_type;
  END IF;
  IF NEW.status NOT IN ('pending', 'verified', 'rejected', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payment_method
  BEFORE INSERT OR UPDATE ON public.user_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_payment_method();

-- Ensure only one default per user
CREATE OR REPLACE FUNCTION public.trg_ensure_single_default_payment()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_payment_methods
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_default_payment
  AFTER INSERT OR UPDATE ON public.user_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.trg_ensure_single_default_payment();

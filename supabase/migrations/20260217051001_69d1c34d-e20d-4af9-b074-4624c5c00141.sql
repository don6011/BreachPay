
-- Create breach_catalog table
CREATE TABLE IF NOT EXISTS public.breach_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text NOT NULL,
  breach_year int,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  exposed_fields text NOT NULL,
  source_type text NOT NULL DEFAULT 'public' CHECK (source_type IN ('public','regulator','court','press','company')),
  source_name text,
  source_url text,
  verified boolean NOT NULL DEFAULT true,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.breach_catalog ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active catalog items
CREATE POLICY "breach_catalog_select_authenticated"
ON public.breach_catalog FOR SELECT
USING (auth.uid() IS NOT NULL AND active = true);

-- Admin-only read of ALL items (including inactive)
CREATE POLICY "breach_catalog_select_admin"
ON public.breach_catalog FOR SELECT
USING (public.is_admin());

-- Admin only write
CREATE POLICY "breach_catalog_admin_write"
ON public.breach_catalog FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "breach_catalog_admin_update"
ON public.breach_catalog FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "breach_catalog_admin_delete"
ON public.breach_catalog FOR DELETE
USING (public.is_admin());

-- Add breach_catalog_id FK to breach_events
ALTER TABLE public.breach_events
ADD COLUMN IF NOT EXISTS breach_catalog_id uuid REFERENCES public.breach_catalog(id);

-- Trigger for updated_at
CREATE TRIGGER set_breach_catalog_updated_at
BEFORE UPDATE ON public.breach_catalog
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Seed data
INSERT INTO public.breach_catalog
(name, company, breach_year, severity, exposed_fields, source_type, source_name, verified, tags, active)
VALUES
('Equifax 2017 Data Breach', 'Equifax', 2017, 'critical', 'ssn, address, name, dob', 'regulator', 'FTC', true, array['credit','identity'], true),
('LinkedIn 2012 Credential Exposure', 'LinkedIn', 2012, 'high', 'email, password', 'press', 'Public reporting', true, array['social','credentials'], true),
('T-Mobile 2021 Customer Data Incident', 'T-Mobile', 2021, 'critical', 'ssn, phone, address', 'company', 'Company notice', true, array['telecom','identity'], true),
('Adobe 2013 Account Breach', 'Adobe', 2013, 'high', 'email, password, username', 'press', 'Public reporting', true, array['credentials','software'], true),
('Canva 2019 User Data Incident', 'Canva', 2019, 'medium', 'email, username', 'press', 'Public reporting', true, array['design'], true),
('Dropbox 2012 Password Exposure', 'Dropbox', 2012, 'high', 'email, password', 'press', 'Public reporting', true, array['cloud','credentials'], true),
('MyFitnessPal 2018 Account Breach', 'MyFitnessPal', 2018, 'medium', 'email, password, username', 'press', 'Public reporting', true, array['fitness'], true),
('Twitter 2022 Account Data Incident', 'Twitter', 2022, 'medium', 'email, phone', 'press', 'Public reporting', true, array['social'], true),
('Marriott 2018 Guest Data Incident', 'Marriott', 2018, 'high', 'name, passport, email, phone', 'company', 'Company notice', true, array['travel','identity'], true),
('AT&T 2024 Customer Data Exposure', 'AT&T', 2024, 'high', 'phone, address', 'press', 'Public reporting', true, array['telecom'], true);

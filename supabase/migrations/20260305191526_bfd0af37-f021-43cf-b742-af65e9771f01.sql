
INSERT INTO public.settlement_sources (name, type, base_url, parser_type, is_active, fetch_strategy, reliability_score)
VALUES
  ('Epiq Global Cases', 'claims_admin', 'https://www.epiqglobal.com/en-us/cases', 'epiq', true, 'edge_function', 85),
  ('JND Legal Administration', 'claims_admin', 'https://www.jndla.com/cases', 'jnd', true, 'edge_function', 80)
ON CONFLICT DO NOTHING;

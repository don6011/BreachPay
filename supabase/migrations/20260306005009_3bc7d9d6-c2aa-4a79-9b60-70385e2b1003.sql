-- Fix parser_type mappings so the discovery engine matches them correctly
UPDATE public.settlement_sources SET parser_type = 'topclassactions' WHERE name = 'TopClassActions.com';
UPDATE public.settlement_sources SET parser_type = 'classaction_org' WHERE name = 'ClassAction.org';
UPDATE public.settlement_sources SET parser_type = 'kroll' WHERE name = 'Kroll Settlement Administration';
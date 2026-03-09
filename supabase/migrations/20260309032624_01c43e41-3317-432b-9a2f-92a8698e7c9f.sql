
INSERT INTO breach_catalog (name, company, breach_year, severity, exposed_fields, data_types, records_exposed, source_type, source_name, source_url, verified, verification_status, tags, active, settlement_available, settlement_name, estimated_payout_min, estimated_payout_max, claim_deadline, law_firm_partner)
VALUES
('Conduent Government Services Breach', 'Conduent', 2026, 'critical',
 'SSN, Medicaid records, SNAP benefits data, addresses, dates of birth',
 ARRAY['ssn','medical','financial','pii','government_id'],
 25000000, 'press', 'ScanComply', 'https://scancomply.com/blog/march-2026-data-breach-report',
 true, 'verified', ARRAY['government','healthcare','ransomware','2026'], true,
 false, null, null, null, null, null),

('LexisNexis Legal & Professional Breach', 'LexisNexis', 2026, 'high',
 'Customer records, legal research data, government user data, law firm data',
 ARRAY['pii','legal','credentials','business_data'],
 null, 'press', 'The Register', 'https://theregister.com/2026/03/04/lexisnexis_legal_professional_confirms_data/',
 true, 'verified', ARRAY['legal','enterprise','2026'], true,
 false, null, null, null, null, null),

('Lacoste Customer Data Breach', 'Lacoste', 2026, 'medium',
 'Customer names, email addresses, purchase history, partial payment data',
 ARRAY['email','pii','financial'],
 null, 'press', 'ScanComply', 'https://scancomply.com/blog/march-2026-data-breach-report',
 true, 'verified', ARRAY['retail','lapsus','2026'], true,
 false, null, null, null, null, null),

('Panda Restaurant Group Employee Breach', 'Panda Restaurant Group', 2024, 'high',
 'Employee SSNs, names, addresses, financial information',
 ARRAY['ssn','pii','financial','employment'],
 240295, 'court', 'ClassAction.org', 'https://www.classaction.org',
 true, 'verified', ARRAY['restaurant','employee_data','settlement','2024'], true,
 true, 'Panda Restaurant Group Data Breach Settlement', 25, 150, '2026-08-30', null),

('PayPal Credential Stuffing Breach', 'PayPal', 2026, 'high',
 'Names, addresses, SSNs, tax IDs, dates of birth, transaction history',
 ARRAY['ssn','financial','pii','tax_id'],
 35000, 'press', 'CM-Alliance', 'https://www.cm-alliance.com/cybersecurity-blog/february-2026-recent-cyber-attacks-data-breaches-ransomware-attacks',
 true, 'verified', ARRAY['fintech','credential_stuffing','2026'], true,
 false, null, null, null, null, null),

('Betterment Financial Data Exposure', 'Betterment', 2026, 'high',
 'Account holder names, account numbers, investment data, SSNs',
 ARRAY['ssn','financial','pii','investment'],
 null, 'press', 'CM-Alliance', 'https://www.cm-alliance.com/cybersecurity-blog/february-2026-recent-cyber-attacks-data-breaches-ransomware-attacks',
 true, 'verified', ARRAY['fintech','investment','2026'], true,
 false, null, null, null, null, null),

('Proliance Surgeons Cyberattack', 'Proliance Surgeons', 2023, 'critical',
 'Patient SSNs, medical records, health insurance info, treatment data',
 ARRAY['ssn','medical','pii','health_insurance'],
 null, 'court', 'ClassAction.org', 'https://www.classaction.org/news/4.45m-proliance-surgeons-settlement',
 true, 'verified', ARRAY['healthcare','cyberattack','settlement','2023'], true,
 true, 'Proliance Surgeons Data Breach Settlement', 50, 500, '2026-07-15', null),

('Disney Employee & Consumer Data Exposure', 'Disney', 2025, 'high',
 'Employee Slack data, customer PII, internal communications, financial projections',
 ARRAY['pii','internal_comms','financial','employee_data'],
 null, 'press', 'ScanComply', 'https://scancomply.com/blog/march-2026-data-breach-report',
 true, 'verified', ARRAY['entertainment','ccpa','2025'], true,
 false, null, null, null, null, null);

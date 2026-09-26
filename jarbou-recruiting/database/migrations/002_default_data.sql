-- =============================================================================
-- Default master data and the two initial JARBOU candidates.
-- Runs once on a fresh database. Unknown personal data is intentionally left empty.
-- =============================================================================

INSERT INTO projects (name, sort_order) VALUES ('DHL Express', 1);

INSERT INTO stations (name, sort_order) VALUES
  ('Hannover', 1), ('Kassel', 2), ('Haiger', 3), ('Bremen', 4);

INSERT INTO positions (name, sort_order) VALUES ('Driver', 1);

INSERT INTO recruitment_sources (name, sort_order) VALUES
  ('Kleinanzeigen', 1), ('Indeed', 2), ('Facebook', 3), ('Instagram', 4),
  ('WhatsApp', 5), ('Referral', 6), ('Website', 7), ('Other', 8);

INSERT INTO document_types (key, label, short_label, required_default, has_expiry, is_builtin, case_by_case, sort_order) VALUES
  ('id_passport',      'ID / Passport',                                   'ID / Passport',       true,  true,  true, false, 1),
  ('licence',          'Driving Licence Class B',                         'Driving Licence',     true,  true,  true, false, 2),
  ('fuehrungszeugnis', 'Führungszeugnis',                                 'Führungszeugnis',     true,  false, true, false, 3),
  ('tax_id',           'Tax ID / Steuer-ID',                              'Tax ID',              true,  false, true, false, 4),
  ('social_security',  'Social Security No. / Sozialversicherungsnummer', 'Social Security No.', true,  false, true, false, 5),
  ('health_insurance', 'Health Insurance / Krankenkasse',                 'Health Insurance',    true,  false, true, false, 6),
  ('bank',             'Bank Details / IBAN',                             'Bank Details',        true,  false, true, false, 7),
  ('residence_permit', 'Residence Permit / Aufenthaltstitel',             'Residence Permit',    true,  true,  true, true,  8),
  ('work_permit',      'Work Permit / Arbeitserlaubnis',                  'Work Permit',         true,  true,  true, true,  9),
  ('contract',         'Employment Contract',                             'Employment Contract', true,  false, true, false, 10),
  ('other',            'Other Documents',                                 'Other Documents',     false, false, true, false, 11);

INSERT INTO onboarding_templates (key, label, auto_rule, sort_order) VALUES
  ('docs_complete',        'Documents Complete',          'documents', 1),
  ('contract_signed',      'Contract Signed',             'contract',  2),
  ('driver_info',          'Driver Information Complete', NULL, 3),
  ('project_registration', 'DHL Project Registration',    NULL, 4),
  ('workwear',             'Uniform / Workwear',          NULL, 5),
  ('phone',                'Company Phone',               NULL, 6),
  ('vehicle',              'Vehicle Assignment',          NULL, 7),
  ('training_scheduled',   'Training Scheduled',          NULL, 8),
  ('training_completed',   'Training Completed',          NULL, 9),
  ('station_intro',        'Station Introduction',        NULL, 10),
  ('first_day',            'First Working Day Confirmed', NULL, 11);

INSERT INTO recruitment_targets (project_id, station_id, required)
  SELECT id, NULL, 30 FROM projects WHERE name = 'DHL Express';

INSERT INTO settings (key, value) VALUES
  ('companyName',             '"JARBOU Logistik GmbH"'),
  ('defaultProject',          '"DHL Express"'),
  ('defaultStation',          '""'),
  ('defaultPosition',         '"Driver"'),
  ('targetPosition',          '"Driver"'),
  ('standardSalaryReference', '2160'),
  ('standardSalaryBasis',     '"net"'),
  ('expiryWarningDays',       '60'),
  ('contractWarningDays',     '14'),
  ('idPrefix',                '"JRB"');

-- ---------------------------------------------------------------- Initial candidates
INSERT INTO candidates (id, first_name, last_name, position_id, project_id, employment_type, start_date, tax_class,
                        salary_reference, salary_basis, salary_expectation_min, salary_expectation_max,
                        availability, stage, interview_status, next_action, notes)
SELECT 'JRB-0001', 'Riber', 'Isso', (SELECT id FROM positions WHERE name = 'Driver'), (SELECT id FROM projects WHERE name = 'DHL Express'),
       'Teilzeit', DATE '2026-10-01', 'Steuerklasse 1', 2160, 'net', 1000, NULL, 'ready', 'documents', 'Not Scheduled',
       'Führungszeugnis anfordern/erhalten und endgültige Teilzeit-Vertragsbedingungen bestätigen.',
       E'Verfügbarkeit des Kandidaten: Bereit.\nAdministrative Startklarkeit: nicht vollständig – Führungszeugnis ausstehend; weitere verpflichtende Onboarding-Voraussetzungen sind zu prüfen.\nGewünschtes Nettogehalt: 1.000 € netto (Standardreferenz 2.160 € netto).\nWeitere persönliche Angaben noch nicht erfasst.';

INSERT INTO candidates (id, first_name, last_name, position_id, project_id, employment_type, start_date, tax_class,
                        salary_reference, salary_basis, salary_expectation_min, salary_expectation_max,
                        availability, stage, interview_status, next_action, notes)
SELECT 'JRB-0002', 'Abdalrazaq', 'Al Shaer', (SELECT id FROM positions WHERE name = 'Driver'), (SELECT id FROM projects WHERE name = 'DHL Express'),
       'Teilzeit', DATE '2026-11-01', 'Steuerklasse 1', 2160, 'net', 700, 800, 'ready', 'documents', 'Not Scheduled',
       'Führungszeugnis anfordern/erhalten und endgültige Teilzeit-Vertragsbedingungen bestätigen.',
       E'Verfügbarkeit des Kandidaten: Bereit.\nAdministrative Startklarkeit: nicht vollständig – Führungszeugnis ausstehend; weitere verpflichtende Onboarding-Voraussetzungen sind zu prüfen.\nGewünschtes Nettogehalt: 700–800 € netto (Standardreferenz 2.160 € netto).\nWeitere persönliche Angaben noch nicht erfasst.';

SELECT setval('candidate_number_seq', 2);

-- Document checklist: required documents start as "missing", optional ones as "not required".
INSERT INTO candidate_documents (candidate_id, doc_key, status, note)
SELECT c.id, d.key, CASE WHEN d.required_default THEN 'missing' ELSE 'not_required' END,
       CASE WHEN d.key = 'fuehrungszeugnis' THEN 'Nicht vorhanden – ausstehend' ELSE '' END
FROM candidates c CROSS JOIN document_types d;

INSERT INTO contracts (candidate_id, status, contract_type)
SELECT id, 'not_started', 'Teilzeit' FROM candidates;

INSERT INTO candidate_activity (candidate_id, type, text) VALUES
  ('JRB-0001', 'system',   'Kandidat angelegt (Erstdaten JARBOU).'),
  ('JRB-0001', 'document', 'Führungszeugnis als fehlend / nicht vorhanden erfasst.'),
  ('JRB-0002', 'system',   'Kandidat angelegt (Erstdaten JARBOU).'),
  ('JRB-0002', 'document', 'Führungszeugnis als fehlend / nicht vorhanden erfasst.');

INSERT INTO audit_logs (actor_name, actor_role, action, entity_type, summary)
VALUES ('System', 'system', 'system.initialized', 'system', 'Database initialised with default data and 2 initial candidates');

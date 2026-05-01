-- Initial tenant records: exactly 3 realistic operational rows per Investigation tab.
-- These are normal database records, editable/deletable through the application like imported or analyst-created records.
-- The migration clears existing local investigation records so the tenant starts with a small coherent working set.

DELETE FROM attachments;
DELETE FROM case_procedures;
DELETE FROM case_shares;
DELETE FROM case_logs;
DELETE FROM task_items;
DELETE FROM observables;
DELETE FROM alerts;
DELETE FROM cases;

INSERT INTO cases (
    id, number, title, description, severity, tlp, pap, status, owner, assignee, tags,
    start_date, end_date, flag, summary, impact_status, resolution_status, case_template,
    owning_organisation, organisation_ids, created_at, updated_at
)
VALUES
    (
        '10000000-0000-0000-0000-000000000001', 1001,
        'Phishing campaign targeting finance mailbox',
        'Multiple finance users received a Microsoft 365 themed invoice lure. Initial triage found a credential harvesting URL and one submitted password reset request.',
        2, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', 'nghia.dinh@ncsgroup.vn',
        ARRAY['phishing','m365','finance','tlp:amber'],
        now() - interval '2 days', NULL, true,
        'Finance phishing wave: validate recipients, block URL, and check for credential use.',
        'WithImpact', 'Indeterminate', 'Phishing - Standard Triage',
        'NCS SOC', ARRAY['NCS SOC','Finance'], now() - interval '2 days', now() - interval '35 minutes'
    ),
    (
        '10000000-0000-0000-0000-000000000002', 1002,
        'Suspicious encoded PowerShell on endpoint',
        'EDR detected encoded PowerShell launched by winword.exe on a user laptop. Analyst must validate command line, collect process tree and isolate if malicious.',
        3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', 'soc-l2@ncsgroup.vn',
        ARRAY['edr','powershell','endpoint','attack:T1059'],
        now() - interval '1 day', NULL, true,
        'High severity endpoint investigation for suspicious PowerShell execution.',
        'NoImpact', 'Indeterminate', 'Endpoint Malware Triage',
        'NCS SOC', ARRAY['NCS SOC','IT Operations'], now() - interval '1 day', now() - interval '18 minutes'
    ),
    (
        '10000000-0000-0000-0000-000000000003', 1003,
        'Resolved malware callback after proxy alert',
        'Proxy logs showed a workstation contacting a known C2 domain. Host was isolated and no persistence was found after enrichment.',
        1, 2, 2, 'Resolved', 'nghia.dinh@ncsgroup.vn', 'certuser@thehive.local',
        ARRAY['malware','proxy','c2','resolved'],
        now() - interval '7 days', now() - interval '2 days', false,
        'Resolved C2 callback: host contained, IOC blocked, no additional beaconing observed.',
        'NoImpact', 'TruePositive', 'Malware Callback Triage',
        'NCS SOC', ARRAY['NCS SOC','IT Operations'], now() - interval '7 days', now() - interval '2 days'
    );

INSERT INTO alerts (
    id, title, type, source, source_ref, severity, tlp, pap, status, read, follow,
    flag, description, external_link, organisation_id, case_template, case_id,
    tags, occurred_at, last_sync_date, created_at, updated_at
)
VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        'MISP event: finance invoice credential phishing',
        'misp-event', 'MISP', 'MISP-2026-0427-091', 2, 2, 2, 'Imported', false, true,
        true,
        'MISP event containing sender, phishing URL and target sector tags. Imported into the finance phishing case.',
        'https://misp.local/events/view/91', 'NCS SOC', 'Phishing - Standard Triage',
        '10000000-0000-0000-0000-000000000001', ARRAY['misp','phishing','finance'],
        now() - interval '2 days 2 hours', now() - interval '30 minutes', now() - interval '2 days 1 hour', now() - interval '30 minutes'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        'EDR alert: encoded PowerShell spawned by Office',
        'edr', 'Microsoft Defender', 'MDE-6F3A-2219', 3, 2, 2, 'New', false, true,
        true,
        'Endpoint detection for suspicious parent-child process chain winword.exe -> powershell.exe with encoded command.',
        'https://edr.local/alerts/MDE-6F3A-2219', 'NCS SOC', 'Endpoint Malware Triage',
        '10000000-0000-0000-0000-000000000002', ARRAY['edr','powershell','attack:T1059'],
        now() - interval '1 day 1 hour', now() - interval '15 minutes', now() - interval '1 day', now() - interval '15 minutes'
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        'Proxy alert: workstation contacted known C2 domain',
        'proxy', 'Secure Web Gateway', 'SWG-4421-C2', 1, 2, 2, 'Imported', true, false,
        false,
        'Proxy detection for a domain previously tagged as command and control. Case already resolved after containment.',
        'https://proxy.local/search?q=SWG-4421-C2', 'NCS SOC', 'Malware Callback Triage',
        '10000000-0000-0000-0000-000000000003', ARRAY['proxy','c2','resolved'],
        now() - interval '7 days 1 hour', now() - interval '2 days', now() - interval '7 days', now() - interval '2 days'
    );

INSERT INTO observables (
    id, case_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity,
    full_data, data_hash, organisation_ids, tags, created_by, created_at, updated_at
)
VALUES
    (
        '30000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001', 'url',
        'https://login-microsoft-security.example/finance/invoice',
        'Credential harvesting URL from the phishing email body.', 2, true, true, false,
        'https://login-microsoft-security.example/finance/invoice?campaign=april&recipient=finance',
        'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0001',
        ARRAY['NCS SOC','Finance'], ARRAY['url','phishing','m365'], 'nghia.dinh@ncsgroup.vn',
        now() - interval '2 days', now() - interval '35 minutes'
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002', 'filename',
        'powershell.exe -EncodedCommand SQBFAFgA...',
        'Suspicious encoded command observed in EDR process telemetry.', 2, true, false, true,
        'powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand SQBFAFgAKABOAGUAdwAtAE8AYgBqAGUAYwB0ACAA...',
        'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0002',
        ARRAY['NCS SOC','IT Operations'], ARRAY['powershell','endpoint','attack:T1059'], 'soc-l2@ncsgroup.vn',
        now() - interval '1 day', now() - interval '18 minutes'
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000003', 'domain',
        'cdn-update-check.example',
        'Known C2 callback domain from proxy logs; blocked at proxy and DNS.', 2, true, true, false,
        'cdn-update-check.example',
        'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0003',
        ARRAY['NCS SOC','IT Operations'], ARRAY['domain','c2','resolved'], 'certuser@thehive.local',
        now() - interval '7 days', now() - interval '2 days'
    );

INSERT INTO task_items (case_id, title, description, status, flag, assignee, group_name, order_index, start_date, due_date, organisation_ids, created_at, updated_at)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Review email headers', 'Validate SPF/DKIM/DMARC and identify sender infrastructure.', 'InProgress', true, 'nghia.dinh@ncsgroup.vn', 'Triage', 1, now() - interval '2 days', now() + interval '4 hours', ARRAY['NCS SOC','Finance'], now() - interval '2 days', now() - interval '40 minutes'),
    ('10000000-0000-0000-0000-000000000001', 'Collect affected recipients', 'Confirm targeted mailbox list and whether credentials were submitted.', 'Waiting', false, '', 'Triage', 2, NULL, now() + interval '8 hours', ARRAY['NCS SOC','Finance'], now() - interval '2 days', now() - interval '1 hour'),
    ('10000000-0000-0000-0000-000000000002', 'Validate encoded PowerShell', 'Decode command and compare against known malicious launchers.', 'InProgress', true, 'soc-l2@ncsgroup.vn', 'Investigation', 1, now() - interval '20 hours', now() + interval '2 hours', ARRAY['NCS SOC','IT Operations'], now() - interval '1 day', now() - interval '18 minutes'),
    ('10000000-0000-0000-0000-000000000003', 'Document containment result', 'Record proxy block, host isolation and no-persistence finding.', 'Completed', false, 'certuser@thehive.local', 'Closure', 1, now() - interval '6 days', now() - interval '2 days', ARRAY['NCS SOC','IT Operations'], now() - interval '7 days', now() - interval '2 days');

INSERT INTO case_logs (case_id, message, created_by, created_at)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Alert imported from MISP. Initial URL block requested.', 'system', now() - interval '2 days'),
    ('10000000-0000-0000-0000-000000000001', 'Finance confirmed two users clicked the link; password reset review is ongoing.', 'nghia.dinh@ncsgroup.vn', now() - interval '35 minutes'),
    ('10000000-0000-0000-0000-000000000002', 'EDR timeline collected. Parent process is winword.exe from downloaded attachment.', 'soc-l2@ncsgroup.vn', now() - interval '20 minutes'),
    ('10000000-0000-0000-0000-000000000003', 'Containment complete. No additional beaconing observed for 48 hours.', 'certuser@thehive.local', now() - interval '2 days');

INSERT INTO case_shares (case_id, organisation, profile, task_rule, observable_rule, owner, task_action_required, created_by, created_at, updated_at)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'NCS SOC', 'admin', 'auto', 'auto', true, true, 'system', now() - interval '2 days', now() - interval '35 minutes'),
    ('10000000-0000-0000-0000-000000000001', 'Finance', 'read-only', 'manual', 'auto', false, true, 'nghia.dinh@ncsgroup.vn', now() - interval '2 days', now() - interval '35 minutes'),
    ('10000000-0000-0000-0000-000000000002', 'NCS SOC', 'admin', 'auto', 'auto', true, true, 'system', now() - interval '1 day', now() - interval '18 minutes'),
    ('10000000-0000-0000-0000-000000000002', 'IT Operations', 'read-only', 'manual', 'auto', false, true, 'soc-l2@ncsgroup.vn', now() - interval '1 day', now() - interval '18 minutes'),
    ('10000000-0000-0000-0000-000000000003', 'NCS SOC', 'admin', 'auto', 'auto', true, false, 'system', now() - interval '7 days', now() - interval '2 days');

INSERT INTO case_procedures (case_id, description, pattern_id, pattern_name, tactic, occurred_at, created_by, created_at, updated_at)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Credential phishing lure delivered through email with fake Microsoft 365 login page.', 'T1566.002', 'Phishing: Spearphishing Link', 'Initial Access', now() - interval '2 days', 'nghia.dinh@ncsgroup.vn', now() - interval '2 days', now() - interval '35 minutes'),
    ('10000000-0000-0000-0000-000000000002', 'User execution triggered Office child process and encoded PowerShell.', 'T1059.001', 'Command and Scripting Interpreter: PowerShell', 'Execution', now() - interval '1 day', 'soc-l2@ncsgroup.vn', now() - interval '1 day', now() - interval '18 minutes'),
    ('10000000-0000-0000-0000-000000000003', 'Compromised host attempted C2 beacon over HTTPS to known domain.', 'T1071.001', 'Application Layer Protocol: Web Protocols', 'Command and Control', now() - interval '7 days', 'certuser@thehive.local', now() - interval '7 days', now() - interval '2 days');

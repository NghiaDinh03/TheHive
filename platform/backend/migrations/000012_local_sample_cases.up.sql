DO $$
BEGIN
    IF current_setting('server_version_num') IS NOT NULL THEN
        DELETE FROM attachments WHERE case_id IN (SELECT id FROM cases);
        DELETE FROM case_logs WHERE case_id IN (SELECT id FROM cases);
        DELETE FROM task_items WHERE case_id IN (SELECT id FROM cases);
        UPDATE alerts SET case_id = NULL WHERE case_id IN (SELECT id FROM cases);
        DELETE FROM observables WHERE case_id IN (SELECT id FROM cases);
        DELETE FROM cases;

        INSERT INTO cases (id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, created_at, updated_at)
        VALUES
            ('10000000-0000-0000-0000-000000000001', 1, 'Phishing email campaign', 'Sample TheHive-style case for analyst workflow review.', 2, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', 'nghia.dinh@ncsgroup.vn', ARRAY['phishing','email'], now() - interval '2 days', now() - interval '1 hour'),
            ('10000000-0000-0000-0000-000000000002', 2, 'Suspicious PowerShell execution', 'Endpoint detection sample case with task/log history.', 3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '', ARRAY['edr','powershell'], now() - interval '1 day', now() - interval '30 minutes'),
            ('10000000-0000-0000-0000-000000000003', 3, 'Malware hash triage', 'Malware observable enrichment sample for Cortex/MISP phases.', 2, 3, 2, 'Open', 'nghia.dinh@ncsgroup.vn', 'certuser@thehive.local', ARRAY['malware','hash'], now() - interval '8 hours', now() - interval '10 minutes')
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, severity = EXCLUDED.severity, tlp = EXCLUDED.tlp, pap = EXCLUDED.pap, status = EXCLUDED.status, owner = EXCLUDED.owner, assignee = EXCLUDED.assignee, tags = EXCLUDED.tags, updated_at = EXCLUDED.updated_at;

        INSERT INTO task_items (case_id, title, status, assignee, group_name, order_index)
        VALUES
            ('10000000-0000-0000-0000-000000000001', 'Review email headers', 'Waiting', 'nghia.dinh@ncsgroup.vn', 'Triage', 1),
            ('10000000-0000-0000-0000-000000000001', 'Collect affected recipients', 'InProgress', '', 'Triage', 2),
            ('10000000-0000-0000-0000-000000000002', 'Validate command line', 'Waiting', '', 'Investigation', 1),
            ('10000000-0000-0000-0000-000000000003', 'Run hash analyzers', 'Waiting', 'certuser@thehive.local', 'Enrichment', 1);

        INSERT INTO case_logs (case_id, message, created_by, created_at)
        VALUES
            ('10000000-0000-0000-0000-000000000001', 'Case created from sample phishing alert.', 'system', now() - interval '2 days'),
            ('10000000-0000-0000-0000-000000000001', 'Initial triage started. Analyst should verify sender and URLs.', 'nghia.dinh@ncsgroup.vn', now() - interval '1 hour'),
            ('10000000-0000-0000-0000-000000000002', 'EDR detection imported for PowerShell review.', 'system', now() - interval '1 day'),
            ('10000000-0000-0000-0000-000000000003', 'Hash observable queued for enrichment.', 'system', now() - interval '8 hours');

        INSERT INTO observables (case_id, data_type, data, message, tlp, ioc, sighted, tags, created_by)
        VALUES
            ('10000000-0000-0000-0000-000000000001', 'mail', 'attacker@example.org', 'Suspicious sender', 2, true, true, ARRAY['phishing'], 'system'),
            ('10000000-0000-0000-0000-000000000001', 'url', 'https://phishing.example.org/login', 'Credential harvesting URL', 2, true, false, ARRAY['url','phishing'], 'system'),
            ('10000000-0000-0000-0000-000000000002', 'filename', 'powershell.exe', 'Suspicious process', 2, false, true, ARRAY['edr'], 'system'),
            ('10000000-0000-0000-0000-000000000003', 'hash', '44d88612fea8a8f36de82e1278abb02f', 'EICAR-style sample hash', 3, true, false, ARRAY['malware'], 'system');
    END IF;
END $$;

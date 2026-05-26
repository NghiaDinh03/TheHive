CREATE TABLE IF NOT EXISTS custom_properties_regex (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    regex_pattern TEXT NOT NULL,
    target_field TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed some default regex rules for SOC
INSERT INTO custom_properties_regex (name, regex_pattern, target_field, description)
VALUES 
('Extract IPv4 Address', '\b(?:\d{1,3}\.){3}\d{1,3}\b', 'src_ip', 'Tự động trích xuất địa chỉ IPv4 nguồn từ log SIEM.'),
('Extract Domain Name', '\b([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}\b', 'domain', 'Tự động trích xuất tên miền đích từ log SIEM.'),
('Extract File MD5 Hash', '\b[a-fA-F0-9]{32}\b', 'file_hash', 'Tự động trích xuất mã MD5 file băm đáng ngờ từ log SIEM.'),
('Extract Source Port', '\bsrc_port=(\d+)\b', 'src_port', 'Trích xuất cổng nguồn của kết nối mạng từ log dạng key-value.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO organisations (name, description)
VALUES ('NCS', 'Default organisation')
ON CONFLICT (name) DO NOTHING;

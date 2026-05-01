-- Keep the admin user for rollback safety; only undo credential reconciliation fields.
UPDATE users
SET password_changed_at = NULL,
    updated_at = now()
WHERE login = 'nghia.dinh@ncsgroup.vn';

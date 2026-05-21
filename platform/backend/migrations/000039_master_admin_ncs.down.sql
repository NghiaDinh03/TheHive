-- Rollback Phase 3 Advanced: Seed master admin account ncs.fushion_admin@ncsgroup.vn
DELETE FROM users WHERE login = 'ncs.fushion_admin@ncsgroup.vn';

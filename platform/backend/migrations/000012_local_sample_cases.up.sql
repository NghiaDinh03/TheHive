DO $$
BEGIN
    IF current_setting('server_version_num') IS NOT NULL THEN
        DELETE FROM attachments WHERE case_id IN (SELECT id FROM cases);
        DELETE FROM case_logs WHERE case_id IN (SELECT id FROM cases);
        DELETE FROM task_items WHERE case_id IN (SELECT id FROM cases);
        UPDATE alerts SET case_id = NULL WHERE case_id IN (SELECT id FROM cases);
        DELETE FROM observables WHERE case_id IN (SELECT id FROM cases);
        DELETE FROM cases;

        -- Bỏ mock data cũ theo yêu cầu của user.
        -- INSERT INTO cases ...
        -- INSERT INTO task_items ...
        -- INSERT INTO case_logs ...
        -- INSERT INTO observables ...
    END IF;
END $$;

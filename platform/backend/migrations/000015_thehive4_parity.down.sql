-- Rollback TheHive 4 parity migration.

-- Phase S.1
DROP INDEX IF EXISTS idx_case_shares_task_action_required;
DROP INDEX IF EXISTS idx_case_shares_owner;
ALTER TABLE case_shares
    DROP COLUMN IF EXISTS task_action_required,
    DROP COLUMN IF EXISTS owner;

-- Phase O.1
DROP INDEX IF EXISTS idx_observables_tlp;
DROP INDEX IF EXISTS idx_observables_sighted;
DROP INDEX IF EXISTS idx_observables_ioc;
DROP INDEX IF EXISTS idx_observables_organisation_ids;
DROP INDEX IF EXISTS idx_observables_data_hash;
DROP INDEX IF EXISTS idx_observables_attachment_id;
DROP INDEX IF EXISTS idx_observables_ignore_similarity;
ALTER TABLE observables
    DROP COLUMN IF EXISTS organisation_ids,
    DROP COLUMN IF EXISTS data_hash,
    DROP COLUMN IF EXISTS full_data,
    DROP COLUMN IF EXISTS attachment_id,
    DROP COLUMN IF EXISTS ignore_similarity;

-- Phase A.1
DROP INDEX IF EXISTS idx_alerts_dedup_org;
DROP INDEX IF EXISTS idx_alerts_updated_at;
DROP INDEX IF EXISTS idx_alerts_last_sync_date;
DROP INDEX IF EXISTS idx_alerts_case_template;
DROP INDEX IF EXISTS idx_alerts_organisation_id;
DROP INDEX IF EXISTS idx_alerts_flag;
DROP INDEX IF EXISTS idx_alerts_follow;
DROP INDEX IF EXISTS idx_alerts_pap;
ALTER TABLE alerts
    DROP COLUMN IF EXISTS case_template,
    DROP COLUMN IF EXISTS organisation_id,
    DROP COLUMN IF EXISTS flag,
    DROP COLUMN IF EXISTS follow,
    DROP COLUMN IF EXISTS pap,
    DROP COLUMN IF EXISTS last_sync_date,
    DROP COLUMN IF EXISTS external_link,
    DROP COLUMN IF EXISTS description;

-- Phase T.1
DROP INDEX IF EXISTS idx_task_items_organisation_ids;
DROP INDEX IF EXISTS idx_task_items_due_date;
DROP INDEX IF EXISTS idx_task_items_status;
DROP INDEX IF EXISTS idx_task_items_assignee;
DROP INDEX IF EXISTS idx_task_items_flag;
ALTER TABLE task_items
    DROP COLUMN IF EXISTS organisation_ids,
    DROP COLUMN IF EXISTS due_date,
    DROP COLUMN IF EXISTS end_date,
    DROP COLUMN IF EXISTS start_date,
    DROP COLUMN IF EXISTS flag,
    DROP COLUMN IF EXISTS description;

-- Phase C.1
DROP INDEX IF EXISTS idx_cases_title_lower;
DROP INDEX IF EXISTS idx_cases_end_date;
DROP INDEX IF EXISTS idx_cases_start_date;
DROP INDEX IF EXISTS idx_cases_case_template;
DROP INDEX IF EXISTS idx_cases_resolution_status;
DROP INDEX IF EXISTS idx_cases_impact_status;
DROP INDEX IF EXISTS idx_cases_organisation_ids;
DROP INDEX IF EXISTS idx_cases_owning_organisation;
DROP INDEX IF EXISTS idx_cases_assignee;
DROP INDEX IF EXISTS idx_cases_pap;
DROP INDEX IF EXISTS idx_cases_tlp;
DROP INDEX IF EXISTS idx_cases_severity;
DROP INDEX IF EXISTS idx_cases_flag;
ALTER TABLE cases
    DROP COLUMN IF EXISTS merged_from,
    DROP COLUMN IF EXISTS merged_into,
    DROP COLUMN IF EXISTS organisation_ids,
    DROP COLUMN IF EXISTS owning_organisation,
    DROP COLUMN IF EXISTS case_template,
    DROP COLUMN IF EXISTS resolution_status,
    DROP COLUMN IF EXISTS impact_status,
    DROP COLUMN IF EXISTS summary,
    DROP COLUMN IF EXISTS flag;

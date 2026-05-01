-- Phase A.2/C.2/L.1/O.2 parity: alert CRUD, case lifecycle fixes, log improvements

-- Alert update/delete support: add deleted_at for soft-delete
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_alerts_deleted_at ON alerts(deleted_at) WHERE deleted_at IS NOT NULL;

-- Alert custom fields: copy during import
ALTER TABLE alert_custom_fields ADD COLUMN IF NOT EXISTS string_value TEXT NOT NULL DEFAULT '';
ALTER TABLE alert_custom_fields ADD COLUMN IF NOT EXISTS boolean_value BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE alert_custom_fields ADD COLUMN IF NOT EXISTS integer_value BIGINT NOT NULL DEFAULT 0;
ALTER TABLE alert_custom_fields ADD COLUMN IF NOT EXISTS float_value DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE alert_custom_fields ADD COLUMN IF NOT EXISTS date_value TIMESTAMPTZ;

-- Log improvements: ensure date column populated
UPDATE case_logs SET date = created_at WHERE date IS NULL;
ALTER TABLE case_logs ALTER COLUMN date SET DEFAULT now();

-- Observable: add data_hash auto-compute trigger for large data
CREATE OR REPLACE FUNCTION compute_observable_data_hash() RETURNS TRIGGER AS $$
BEGIN
    IF length(NEW.data) > 1024 THEN
        NEW.data_hash = md5(NEW.data);
        IF NEW.full_data IS NULL OR NEW.full_data = '' THEN
            NEW.full_data = NEW.data;
        END IF;
        NEW.data = substring(NEW.data FROM 1 FOR 256) || '…';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_observable_data_hash ON observables;
CREATE TRIGGER trg_observable_data_hash
    BEFORE INSERT OR UPDATE OF data ON observables
    FOR EACH ROW
    EXECUTE FUNCTION compute_observable_data_hash();

-- Case: ensure merged_into/merged_from columns are nullable properly
-- (already done in 000015, this is just an index)
CREATE INDEX IF NOT EXISTS idx_cases_merged_into ON cases(merged_into) WHERE merged_into IS NOT NULL;

CREATE OR REPLACE FUNCTION compute_observable_data_hash() RETURNS TRIGGER AS $$
DECLARE
    digest_value TEXT;
BEGIN
    IF NEW.data IS NULL OR NEW.data = '' THEN
        NEW.data_hash = '';
        NEW.full_data = NULL;
        RETURN NEW;
    END IF;

    digest_value = 'sha256:' || encode(digest(NEW.data, 'sha256'), 'hex');
    NEW.data_hash = digest_value;

    IF length(NEW.data) > 1024 THEN
        IF NEW.full_data IS NULL OR NEW.full_data = '' THEN
            NEW.full_data = NEW.data;
        END IF;
        NEW.data = digest_value;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_observables_data_hash_sha256 ON observables(data_hash);

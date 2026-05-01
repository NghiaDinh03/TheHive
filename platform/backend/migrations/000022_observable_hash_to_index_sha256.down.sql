CREATE OR REPLACE FUNCTION compute_observable_data_hash() RETURNS TRIGGER AS $$
BEGIN
    IF length(NEW.data) > 1024 THEN
        NEW.data_hash = md5(NEW.data);
        IF NEW.full_data IS NULL OR NEW.full_data = '' THEN
            NEW.full_data = NEW.data;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP INDEX IF EXISTS idx_observables_data_hash_sha256;

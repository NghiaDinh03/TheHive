CREATE TABLE alert_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    similarity_score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_case_alert_cluster UNIQUE (case_id, alert_id)
);

CREATE INDEX idx_alert_clusters_case_id ON alert_clusters(case_id);
CREATE INDEX idx_alert_clusters_alert_id ON alert_clusters(alert_id);

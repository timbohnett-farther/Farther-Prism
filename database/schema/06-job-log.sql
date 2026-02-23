-- ============================================================================
-- Job Execution Log
-- Tracks scheduled job runs (daily pricing, sync jobs, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Job details
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'running'
    
    -- Results
    result_json JSONB,
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT job_log_status_check CHECK (
        status IN ('success', 'failed', 'running', 'cancelled')
    )
);

CREATE INDEX idx_job_log_name ON job_log(job_name);
CREATE INDEX idx_job_log_status ON job_log(status);
CREATE INDEX idx_job_log_started ON job_log(started_at DESC);

COMMENT ON TABLE job_log IS 'Audit log for scheduled job executions (pricing, sync, cleanup)';

-- View: Recent job runs
CREATE OR REPLACE VIEW v_recent_jobs AS
SELECT 
    job_name,
    status,
    result_json,
    duration_ms,
    started_at,
    completed_at
FROM job_log
ORDER BY started_at DESC
LIMIT 100;

COMMENT ON VIEW v_recent_jobs IS 'Last 100 job executions for monitoring';

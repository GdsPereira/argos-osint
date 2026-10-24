-- ========================================================
-- Schema do PostgreSQL para Resiliência do Argos
-- Tabelas: analyses, ai_reports, jobs
-- ========================================================

CREATE TABLE IF NOT EXISTS analyses (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64),
    username VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    source VARCHAR(32) NOT NULL DEFAULT 'apify',
    followers BIGINT DEFAULT 0,
    following BIGINT DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    engagement_rate NUMERIC(8, 4) DEFAULT 0,
    avg_likes NUMERIC(12, 2) DEFAULT 0,
    avg_comments NUMERIC(12, 2) DEFAULT 0,
    total_interactions BIGINT DEFAULT 0,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analyses_username ON analyses(username);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_job_id ON analyses(job_id);

CREATE TABLE IF NOT EXISTS ai_reports (
    id VARCHAR(64) PRIMARY KEY,
    analysis_id VARCHAR(64) REFERENCES analyses(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    focus VARCHAR(64) DEFAULT 'general',
    provider VARCHAR(64),
    model VARCHAR(128),
    diagnosis_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_username ON ai_reports(username);
CREATE INDEX IF NOT EXISTS idx_ai_reports_analysis_id ON ai_reports(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_created_at ON ai_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(64) PRIMARY KEY,
    request_data JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    progress TEXT,
    logs JSONB DEFAULT '[]'::jsonb,
    result_id VARCHAR(64),
    result_data JSONB,
    error TEXT,
    created_at DOUBLE PRECISION NOT NULL,
    updated_at DOUBLE PRECISION NOT NULL,
    completed_at DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- ========================================================
-- Busca Multiplataforma, Social Listening e IA Transmídia
-- ========================================================

CREATE TABLE IF NOT EXISTS search_runs (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64),
    search_mode VARCHAR(32) NOT NULL DEFAULT 'topic',
    query VARCHAR(255) NOT NULL,
    platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_items INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    total_interactions BIGINT DEFAULT 0,
    avg_engagement_rate NUMERIC(8, 4) DEFAULT 0,
    platform_summaries JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_runs_query ON search_runs(query);
CREATE INDEX IF NOT EXISTS idx_search_runs_created_at ON search_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_runs_job_id ON search_runs(job_id);

CREATE TABLE IF NOT EXISTS omnichannel_reports (
    id VARCHAR(64) PRIMARY KEY,
    search_run_id VARCHAR(64) REFERENCES search_runs(id) ON DELETE CASCADE,
    query VARCHAR(255) NOT NULL,
    provider VARCHAR(64),
    model VARCHAR(128),
    executive_summary TEXT,
    report_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_reports_search_id ON omnichannel_reports(search_run_id);
CREATE INDEX IF NOT EXISTS idx_omnichannel_reports_created_at ON omnichannel_reports(created_at DESC);

-- ========================================================
-- Casos de Investigação OSINT (Maltego Mode & Cadeia de Custódia)
-- ========================================================

CREATE TABLE IF NOT EXISTS osint_cases (
    id VARCHAR(64) PRIMARY KEY,
    root_query VARCHAR(255) NOT NULL,
    entity_type VARCHAR(64) NOT NULL DEFAULT 'username',
    title VARCHAR(255) NOT NULL,
    pivots_trail JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_nodes INTEGER DEFAULT 0,
    total_edges INTEGER DEFAULT 0,
    sha256_hash VARCHAR(64) NOT NULL DEFAULT '',
    analyst_notes TEXT DEFAULT '',
    case_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_osint_cases_root_query ON osint_cases(root_query);
CREATE INDEX IF NOT EXISTS idx_osint_cases_updated_at ON osint_cases(updated_at DESC);



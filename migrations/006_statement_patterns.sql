-- Statement Pattern Learning Database
-- Stores fingerprints and patterns from successfully parsed statements
-- Enables faster classification and continuous learning

CREATE TABLE statement_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Custodian identification
  custodian_name VARCHAR(255) NOT NULL,
  parser_name VARCHAR(100) NOT NULL,
  
  -- Pattern fingerprint
  fingerprint JSONB NOT NULL,
  -- Example fingerprint structure:
  -- {
  --   "filename_patterns": ["schwab*.csv", "*_schwab_*.csv"],
  --   "header_signature": "Account Number,Symbol,Quantity,Price",
  --   "column_names": ["Account Number", "Symbol", "Description", "Quantity", ...],
  --   "required_columns": ["Account Number", "Symbol", "Quantity"],
  --   "distinctive_columns": ["CUSIP", "Symbol Type"], (unique to this custodian)
  --   "file_format": "csv",
  --   "encoding": "utf-8"
  -- }
  
  -- Learning metrics
  match_count INT DEFAULT 0,        -- How many times this pattern matched
  success_count INT DEFAULT 0,      -- How many successful parses
  failure_count INT DEFAULT 0,      -- How many failures
  confidence_score NUMERIC(5,4),    -- Current confidence (0-1)
  last_matched_at TIMESTAMPTZ,      -- Last time pattern was used
  
  -- Sample data for reference
  sample_statement_id UUID,         -- Reference to original statement (if stored)
  sample_filename VARCHAR(500),
  sample_headers TEXT,              -- First 5 rows of CSV (for visual reference)
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'system',
  
  -- Constraints
  CONSTRAINT statement_patterns_unique_fingerprint 
    UNIQUE (custodian_name, fingerprint)
);

-- Indexes for fast lookup
CREATE INDEX idx_statement_patterns_custodian ON statement_patterns(custodian_name);
CREATE INDEX idx_statement_patterns_confidence ON statement_patterns(confidence_score DESC);
CREATE INDEX idx_statement_patterns_match_count ON statement_patterns(match_count DESC);
CREATE INDEX idx_statement_patterns_last_matched ON statement_patterns(last_matched_at DESC);

-- GIN index for JSONB fingerprint queries
CREATE INDEX idx_statement_patterns_fingerprint ON statement_patterns USING GIN (fingerprint);

-- Function to update confidence score based on success/failure
CREATE OR REPLACE FUNCTION update_pattern_confidence(pattern_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE statement_patterns
  SET confidence_score = CASE
    WHEN (success_count + failure_count) = 0 THEN 0.5
    ELSE CAST(success_count AS NUMERIC) / (success_count + failure_count)
  END,
  updated_at = NOW()
  WHERE id = pattern_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamps
CREATE TRIGGER statement_patterns_updated_at 
  BEFORE UPDATE ON statement_patterns
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Table for storing uploaded statements (optional - for pattern mining)
CREATE TABLE uploaded_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  
  -- File metadata
  filename VARCHAR(500) NOT NULL,
  file_size_bytes INT,
  mime_type VARCHAR(100),
  file_hash VARCHAR(64), -- SHA-256 hash (for deduplication)
  
  -- Classification results
  detected_custodian VARCHAR(255),
  detected_parser VARCHAR(100),
  classification_confidence NUMERIC(5,4),
  pattern_id UUID REFERENCES statement_patterns(id), -- Which pattern was used
  
  -- Parse results
  parse_status VARCHAR(50), -- success, failed, manual_review
  accounts_imported INT DEFAULT 0,
  positions_imported INT DEFAULT 0,
  total_value NUMERIC(15,2),
  
  -- Storage location (if archiving files)
  storage_path TEXT, -- e.g., "s3://farther-data/statements/[household]/[date]/[filename]"
  
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID, -- FK to users (future)
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_uploaded_statements_household ON uploaded_statements(household_id);
CREATE INDEX idx_uploaded_statements_custodian ON uploaded_statements(detected_custodian);
CREATE INDEX idx_uploaded_statements_status ON uploaded_statements(parse_status);
CREATE INDEX idx_uploaded_statements_hash ON uploaded_statements(file_hash); -- Deduplication
CREATE INDEX idx_uploaded_statements_uploaded_at ON uploaded_statements(uploaded_at DESC);

COMMENT ON TABLE statement_patterns IS 'Learning database for statement parsing patterns - improves classification over time';
COMMENT ON TABLE uploaded_statements IS 'Audit trail of all uploaded statements with classification and parse results';

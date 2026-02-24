-- Add status column to accounts table
-- Needed for filtering active vs closed accounts

ALTER TABLE accounts 
  ADD COLUMN status VARCHAR(50) DEFAULT 'active';

CREATE INDEX idx_accounts_status ON accounts(status);

COMMENT ON COLUMN accounts.status IS 'Account status: active, closed, archived';

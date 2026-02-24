-- Add unique constraint for account number per household
-- This enables ON CONFLICT for statement imports (upsert logic)

ALTER TABLE accounts 
  ADD CONSTRAINT accounts_household_account_number_unique 
  UNIQUE (household_id, account_number_encrypted);

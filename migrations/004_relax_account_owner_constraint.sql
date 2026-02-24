-- Relax account owner constraint to allow null during import
-- Accounts imported from statements won't have owners assigned until manual review

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS account_owner_check;

-- New constraint: at most one owner (person OR entity), but can be neither during import
ALTER TABLE accounts 
  ADD CONSTRAINT account_owner_check CHECK (
    (owner_person_id IS NOT NULL AND owner_entity_id IS NULL) OR
    (owner_person_id IS NULL AND owner_entity_id IS NOT NULL) OR
    (owner_person_id IS NULL AND owner_entity_id IS NULL)
  );

COMMENT ON CONSTRAINT account_owner_check ON accounts IS 
  'Account can have one person owner, one entity owner, or no owner (during import)';

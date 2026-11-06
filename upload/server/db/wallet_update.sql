BEGIN;

-- Update wallet transaction types
ALTER TABLE wallet_transactions
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE wallet_transactions
ADD CONSTRAINT wallet_transactions_type_check
CHECK (
  type IN (
    'credit',
    'debit',
    'refund',
    'adjustment'
  )
);

-- Update wallet reference types
ALTER TABLE wallet_transactions
DROP CONSTRAINT IF EXISTS wallet_transactions_reference_type_check;

ALTER TABLE wallet_transactions
ADD CONSTRAINT wallet_transactions_reference_type_check
CHECK (
  reference_type IS NULL OR
  reference_type IN (
    'admin_adjustment',
    'order',
    'payment',
    'refund',
    'tournament_entry_fee'
  )
);

COMMIT;
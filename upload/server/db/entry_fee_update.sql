
BEGIN;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS entry_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'tournaments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%entry_fee%'
  LOOP
    EXECUTE format(
      'ALTER TABLE tournaments DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END $$;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_entry_fee_nonnegative
CHECK (entry_fee >= 0);

COMMIT;

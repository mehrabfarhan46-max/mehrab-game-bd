
BEGIN;

ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS tournaments_mode_check;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_mode_check
CHECK (mode IN ('solo', 'duo', 'squad', '4v4'));

COMMIT;

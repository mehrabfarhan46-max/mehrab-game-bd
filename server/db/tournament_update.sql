
BEGIN;

-- Tournament category
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'solo_br';

ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS tournaments_category_check;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_category_check
CHECK (
  category IN (
    'solo_br',
    'duo_br',
    'pro_league',
    'lone_wolf',
    'lone_wolf_headshot',
    'survival_br',
    'cs_4v4',
    'cs_4v4_headshot'
  )
);

-- Match number
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS match_number TEXT;

UPDATE tournaments
SET match_number = 'MATCH-' || id
WHERE match_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_match_number
ON tournaments(match_number);

-- Match details
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS map_name TEXT;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS per_kill_prize NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS winning_prize NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS tutorial_video_url TEXT;

-- Prize validation
ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS tournaments_per_kill_prize_check;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_per_kill_prize_check
CHECK (per_kill_prize >= 0);

ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS tournaments_winning_prize_check;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_winning_prize_check
CHECK (winning_prize >= 0);

-- Entry fee validation
ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS tournaments_entry_fee_check;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_entry_fee_check
CHECK (entry_fee >= 0);

-- Index
CREATE INDEX IF NOT EXISTS idx_tournaments_category_status
ON tournaments(category, status, starts_at);

COMMIT;

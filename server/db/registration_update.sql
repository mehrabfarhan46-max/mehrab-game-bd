
BEGIN;

-- Tournament Teams
CREATE TABLE IF NOT EXISTS tournament_teams (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL
    REFERENCES tournaments(id) ON DELETE CASCADE,
  team_name TEXT,
  captain_user_id BIGINT NOT NULL
    REFERENCES users(id),
  participation_type TEXT NOT NULL
    CHECK (participation_type IN ('solo', 'friend_pair', 'team')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow registrations without Free Fire UID
ALTER TABLE participants
ALTER COLUMN ff_player_id DROP NOT NULL;

-- Add participant team information
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS team_id BIGINT
  REFERENCES tournament_teams(id) ON DELETE SET NULL;

ALTER TABLE participants
ADD COLUMN IF NOT EXISTS participation_type TEXT
  NOT NULL DEFAULT 'solo';

-- Store friend's in-game name
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS friend_ingame_name TEXT;

-- Participation type validation
ALTER TABLE participants
DROP CONSTRAINT IF EXISTS participants_participation_type_check;

ALTER TABLE participants
ADD CONSTRAINT participants_participation_type_check
CHECK (
  participation_type IN ('solo', 'friend_pair', 'team')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament
ON tournament_teams(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_teams_captain
ON tournament_teams(captain_user_id);

CREATE INDEX IF NOT EXISTS idx_participants_team
ON participants(team_id);

COMMIT;

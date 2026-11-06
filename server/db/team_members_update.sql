
BEGIN;

-- Store every player's in-game name in a team.
-- Website accounts are optional for additional team members.
CREATE TABLE IF NOT EXISTS tournament_team_members (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL
    REFERENCES tournament_teams(id) ON DELETE CASCADE,
  player_user_id BIGINT
    REFERENCES users(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL
    CHECK (length(trim(player_name)) BETWEEN 1 AND 50),
  member_number INT NOT NULL
    CHECK (member_number BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, member_number)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team
ON tournament_team_members(team_id);

COMMIT;

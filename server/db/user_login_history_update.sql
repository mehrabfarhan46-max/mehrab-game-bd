BEGIN;

CREATE TABLE IF NOT EXISTS user_login_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  login_method TEXT NOT NULL
    CHECK (login_method IN ('email', 'google')),
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_login_history_user
ON user_login_history(user_id, logged_in_at DESC);

COMMIT;
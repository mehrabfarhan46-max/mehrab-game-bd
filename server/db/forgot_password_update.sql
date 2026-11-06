BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0
    CHECK (attempts >= 0),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user
ON password_reset_otps(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expiry
ON password_reset_otps(expires_at);

COMMIT;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT,
  ff_player_id TEXT,
  ff_ingame_name TEXT,
  language TEXT NOT NULL DEFAULT 'bn'
    CHECK (language IN ('bn','en')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('superadmin','admin','support')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name_bn TEXT,
  name_en TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DIAMOND AND MEMBERSHIP PACKAGES
CREATE TABLE IF NOT EXISTS diamond_packages (
  id BIGSERIAL PRIMARY KEY,
  name_bn TEXT,
  name_en TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'diamonds',
  diamonds INT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CATEGORY UPDATE
ALTER TABLE diamond_packages
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'diamonds';

ALTER TABLE diamond_packages
ALTER COLUMN diamonds DROP NOT NULL;

ALTER TABLE diamond_packages
DROP CONSTRAINT IF EXISTS diamond_packages_category_check;

ALTER TABLE diamond_packages
DROP CONSTRAINT IF EXISTS diamond_packages_diamonds_check;

ALTER TABLE diamond_packages
DROP CONSTRAINT IF EXISTS diamond_packages_diamonds_category_check;

ALTER TABLE diamond_packages
ADD CONSTRAINT diamond_packages_category_check
CHECK (category IN ('diamonds', 'weekly', 'monthly', 'levelup'));

ALTER TABLE diamond_packages
ADD CONSTRAINT diamond_packages_diamonds_category_check
CHECK (
  (
    category = 'diamonds'
    AND diamonds IS NOT NULL
    AND diamonds > 0
  )
  OR
  (
    category IN ('weekly', 'monthly', 'levelup')
    AND (diamonds IS NULL OR diamonds > 0)
  )
);

CREATE TABLE IF NOT EXISTS like_services (
  id BIGSERIAL PRIMARY KEY,
  name_bn TEXT,
  name_en TEXT NOT NULL,
  platform TEXT,
  quantity INT NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL
    CHECK (type IN ('diamond','like','product')),
  diamond_package_id BIGINT REFERENCES diamond_packages(id),
  like_service_id BIGINT REFERENCES like_services(id),
  product_id BIGINT REFERENCES products(id),
  target TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending','processing','completed','rejected','refunded'
      )
    ),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user
ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(status);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  method TEXT NOT NULL
    CHECK (method IN ('bkash','nagad','rocket','gateway')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  sender_number TEXT,
  transaction_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (mode IN ('sandbox','live')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','failed','refunded')),
  verified_by BIGINT REFERENCES admins(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (method, transaction_id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES payments(id),
  order_id BIGINT NOT NULL REFERENCES orders(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','paid','rejected')),
  processed_by BIGINT REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournaments (
  id BIGSERIAL PRIMARY KEY,
  title_bn TEXT,
  title_en TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('solo','duo','squad')),
  rules TEXT,
  prize_info TEXT,
  entry_fee NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (entry_fee = 0),
  max_players INT NOT NULL CHECK (max_players > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft','upcoming','live','completed','cancelled'
      )
    ),
  room_id TEXT,
  room_password TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL
    REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  ff_player_id TEXT NOT NULL,
  ff_ingame_name TEXT NOT NULL,
  team_name TEXT,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','removed','disqualified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_results (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL
    REFERENCES tournaments(id) ON DELETE CASCADE,
  participant_id BIGINT NOT NULL REFERENCES participants(id),
  placement INT NOT NULL CHECK (placement > 0),
  kills INT NOT NULL DEFAULT 0 CHECK (kills >= 0),
  points INT NOT NULL DEFAULT 0,
  prize_text TEXT,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, participant_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  reply TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','answered','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES admins(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created
ON audit_logs(created_at DESC);

-- WALLET
CREATE TABLE IF NOT EXISTS wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE
    REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WALLET TRANSACTION HISTORY
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT NOT NULL
    REFERENCES wallets(id) ON DELETE RESTRICT,
  user_id BIGINT NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  type TEXT NOT NULL
    CHECK (type IN ('demo_credit', 'demo_debit')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  reference_type TEXT
    CHECK (
      reference_type IS NULL OR
      reference_type IN ('admin_demo', 'order_demo', 'refund_demo')
    ),
  reference_id BIGINT,
  idempotency_key UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user
ON wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet
ON wallet_transactions(wallet_id, created_at DESC);

-- GOOGLE LOGIN SUPPORT
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
ON users(google_sub)
WHERE google_sub IS NOT NULL;

-- =========================================
-- MEHRAB GAMING BD
-- TOURNAMENT DATABASE COMPATIBILITY UPDATE
-- =========================================

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS match_number TEXT;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'solo_br';

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS map_name TEXT;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS per_kill_prize NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS winning_prize NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS tutorial_video_url TEXT;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Generate match numbers for existing tournaments
UPDATE tournaments
SET match_number = 'MGBD-LEGACY-' || id
WHERE match_number IS NULL;

ALTER TABLE tournaments
ALTER COLUMN match_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
idx_tournaments_match_number
ON tournaments(match_number);

-- Allow 4v4 mode
ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS tournaments_mode_check;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_mode_check
CHECK (mode IN ('solo', 'duo', 'squad', '4v4'));

-- Allow paid tournaments
ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS tournaments_entry_fee_check;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_entry_fee_check
CHECK (entry_fee >= 0);

-- Tournament categories
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

-- Tournament indexes
CREATE INDEX IF NOT EXISTS
idx_tournaments_status
ON tournaments(status);

CREATE INDEX IF NOT EXISTS
idx_tournaments_starts_at
ON tournaments(starts_at);

CREATE INDEX IF NOT EXISTS
idx_participants_tournament
ON participants(tournament_id);

CREATE INDEX IF NOT EXISTS
idx_match_results_tournament
ON match_results(tournament_id);

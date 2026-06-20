-- ============================================================
--  HELPING HEARTS — PostgreSQL Schema (Supabase-ready)
--
--  HOW TO RUN THIS:
--  Supabase: Dashboard → SQL Editor → New Query → paste all → Run
--  Local Postgres: psql -U postgres -d helping_hearts -f database.sql
-- ============================================================

-- ── Extension for UUID-style random tokens (optional, not required) ──
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Auto-update "updated_at" trigger function ──────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1. USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    first_name   VARCHAR(80)  NOT NULL,
    last_name    VARCHAR(80)  NOT NULL,
    email        VARCHAR(160) NOT NULL UNIQUE,
    phone        VARCHAR(30),
    password     VARCHAR(255) NOT NULL,
    avatar_url   VARCHAR(500),                 -- profile picture (added after signup)
    is_active    BOOLEAN      DEFAULT TRUE,
    created_at   TIMESTAMP    DEFAULT NOW(),
    updated_at   TIMESTAMP    DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. CAMPAIGNS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
    id            SERIAL PRIMARY KEY,
    slug          VARCHAR(100) NOT NULL UNIQUE,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    goal_amount   NUMERIC(12,2) DEFAULT 0,
    raised_amount NUMERIC(12,2) DEFAULT 0,
    image_url     VARCHAR(255),
    is_active     BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_campaigns_updated ON campaigns;
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. DONATIONS ─────────────────────────────────────────────
-- PostgreSQL doesn't have MySQL-style ENUM, so we use CHECK constraints
CREATE TABLE IF NOT EXISTS donations (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id)     ON DELETE SET NULL,
    donor_first_name    VARCHAR(80)  NOT NULL,
    donor_last_name     VARCHAR(80)  NOT NULL,
    donor_email         VARCHAR(160) NOT NULL,
    donor_phone         VARCHAR(30),
    donor_city          VARCHAR(100),
    campaign_id         INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency            VARCHAR(10)   DEFAULT 'PKR',
    frequency           VARCHAR(20)   DEFAULT 'one-time'
                          CHECK (frequency IN ('one-time','monthly','annually')),
    is_dedicated        BOOLEAN DEFAULT FALSE,
    honoree_name        VARCHAR(160),
    honoree_email       VARCHAR(160),
    dedication_message  TEXT,
    payment_method      VARCHAR(20) NOT NULL
                          CHECK (payment_method IN ('card','easypaisa','jazzcash','bank','sadapay','crypto')),
    payment_status      VARCHAR(20) DEFAULT 'pending'
                          CHECK (payment_status IN ('pending','completed','failed','refunded')),
    transaction_ref     VARCHAR(255),
    ip_address          VARCHAR(45),
    notes               TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_donations_updated ON donations;
CREATE TRIGGER trg_donations_updated BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_donations_user     ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_status   ON donations(payment_status);

-- ── 4. ADMINS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(80)  NOT NULL UNIQUE,
    email      VARCHAR(160) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(20) DEFAULT 'moderator'
                 CHECK (role IN ('superadmin','moderator')),
    is_active  BOOLEAN     DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP   DEFAULT NOW()
);

-- ── 5. CONTACT MESSAGES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(160) NOT NULL,
    email      VARCHAR(160) NOT NULL,
    phone      VARCHAR(30),
    subject    VARCHAR(255),
    message    TEXT NOT NULL,
    is_read    BOOLEAN   DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ── SEED: Default campaigns ───────────────────────────────────
INSERT INTO campaigns (slug, title, description, goal_amount, raised_amount, image_url) VALUES
('flood-relief',    'Flood Relief',         'Emergency food, water & shelter for flood-affected families across Pakistan.',     500000, 0, 'flood.jpg'),
('education-fund',  'Education Fund',       'Providing quality education and school supplies to underprivileged children.',      300000, 0, 'education.jpg'),
('medical-aid',     'Medical Aid',          'Life-saving medical treatment and medicines for those who cannot afford care.',      400000, 0, 'medical.jpg'),
('food-baskets',    'Food Baskets',         'Monthly food packages with essential groceries for families below poverty line.',    200000, 0, 'food-baskets.jpg'),
('cancer-treatment','Cancer Treatment',     'Funding cancer diagnosis and treatment for children and families in need.',          600000, 0, 'cancer-treatment.jpg'),
('girls-education', 'Girls Education',      'Keeping girls in school and funding their bright futures across rural Pakistan.',    350000, 0, 'girls-education.jpg'),
('earthquake-kpk',  'Earthquake Relief KPK','Rebuilding homes and restoring lives after the devastating earthquake in KPK.',     450000, 0, 'earthquake-kpk.jpg')
ON CONFLICT (slug) DO NOTHING;

-- ── SEED: Default superadmin (password: Admin@1234) ──────────
INSERT INTO admins (username, email, password, role) VALUES
(
  'superadmin',
  'admin@helpinghearts.org',
  '$2a$12$KIX/SxmSYTi2LFbgf5.tzeO8e/t/l0Y.eGE7HlCOtBX4sFREJqT1i',
  'superadmin'
)
ON CONFLICT (email) DO NOTHING;

-- ── VERIFY (run separately after the above) ───────────────────
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public';
-- SELECT id, slug, title FROM campaigns;
-- SELECT id, username, email, role FROM admins;

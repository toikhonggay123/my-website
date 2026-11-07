-- AFYLLX Account: one identity for every AFYLLX product.
-- Platform roles: founder > platform_admin > support. Organization and product roles come later (A2).

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  platform_role TEXT CHECK(platform_role IN ('founder','platform_admin','support')),
  totp_secret TEXT,
  totp_pending TEXT,
  totp_last_step INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX accounts_platform ON accounts(platform_role) WHERE platform_role IS NOT NULL;

-- Only SHA-256 of the session token is stored. mfa_passed marks sessions that completed the second step.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  token_hash TEXT NOT NULL UNIQUE,
  mfa_passed INTEGER NOT NULL DEFAULT 0 CHECK(mfa_passed IN (0,1)),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  absolute_expires_at INTEGER NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sessions_account ON sessions(account_id,expires_at);

CREATE TABLE recovery_codes (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  PRIMARY KEY(account_id,code_hash)
);

-- One-time links: account activation and password reset. Only SHA-256 of the code is stored.
CREATE TABLE action_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK(kind IN ('activate','reset')),
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX action_tokens_account ON action_tokens(account_id,used_at);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'school' CHECK(kind IN ('school','center','other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_by TEXT REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Which products an organization uses, with the product's own workspace id (ClassHub org id, for example).
CREATE TABLE organization_products (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  product TEXT NOT NULL CHECK(product IN ('classhub','mealcheck')),
  external_id TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  PRIMARY KEY(org_id,product)
);

CREATE TABLE memberships (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(account_id,org_id)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT REFERENCES accounts(id),
  action TEXT NOT NULL,
  target_id TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '{}',
  ip TEXT NOT NULL DEFAULT '',
  occurred_at INTEGER NOT NULL
);
CREATE INDEX audit_events_time ON audit_events(occurred_at DESC);
CREATE INDEX audit_events_target ON audit_events(target_id,occurred_at DESC);

-- The last founder can never be demoted, disabled or removed.
CREATE TRIGGER accounts_keep_founder BEFORE UPDATE OF platform_role,status ON accounts
WHEN OLD.platform_role='founder' AND OLD.status='active'
  AND (NEW.platform_role IS NOT 'founder' OR NEW.status<>'active')
  AND (SELECT COUNT(*) FROM accounts WHERE platform_role='founder' AND status='active')<=1
BEGIN
  SELECT RAISE(ABORT,'LAST_FOUNDER');
END;

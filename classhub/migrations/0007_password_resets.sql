-- One-time password reset links created by an owner for a member. Only the SHA-256 of the code is stored.
CREATE TABLE password_resets (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  token_hash TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX password_resets_user ON password_resets(user_id,used_at);

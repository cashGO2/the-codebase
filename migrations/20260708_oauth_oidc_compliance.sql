-- OAuth/OIDC compliance foundations
-- Run in Supabase SQL Editor before enabling full refresh/revocation behavior.

ALTER TABLE oauth_apps
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE oauth_apps
  ADD COLUMN IF NOT EXISTS redirect_uris JSONB,
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS token_endpoint_auth_method TEXT DEFAULT 'client_secret_post',
  ADD COLUMN IF NOT EXISTS client_uri TEXT,
  ADD COLUMN IF NOT EXISTS logo_uri TEXT,
  ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE oauth_apps
SET redirect_uris = to_jsonb(ARRAY[redirect_uri])
WHERE redirect_uris IS NULL AND redirect_uri IS NOT NULL;

ALTER TABLE oauth_codes
  ADD COLUMN IF NOT EXISTS code_challenge TEXT,
  ADD COLUMN IF NOT EXISTS code_challenge_method TEXT,
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS nonce TEXT,
  ADD COLUMN IF NOT EXISTS auth_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES oauth_apps(client_id) ON DELETE CASCADE,
    scope TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    replaced_by_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_user_id ON oauth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_client_id ON oauth_refresh_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS oauth_revoked_tokens (
    token_hash TEXT PRIMARY KEY,
    token_type_hint TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES oauth_apps(client_id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_revoked_tokens_expires_at ON oauth_revoked_tokens(expires_at);

ALTER TABLE oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_revoked_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for oauth_refresh_tokens" ON oauth_refresh_tokens;
CREATE POLICY "Service role only for oauth_refresh_tokens" ON oauth_refresh_tokens FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role only for oauth_revoked_tokens" ON oauth_revoked_tokens;
CREATE POLICY "Service role only for oauth_revoked_tokens" ON oauth_revoked_tokens FOR ALL TO service_role USING (true);
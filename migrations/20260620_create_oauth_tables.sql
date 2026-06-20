-- Create OAuth applications table
CREATE TABLE IF NOT EXISTS oauth_apps (
    client_id TEXT PRIMARY KEY,
    client_secret TEXT NOT NULL,
    name TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_apps_user_id ON oauth_apps(user_id);

-- Create OAuth authorization codes table
CREATE TABLE IF NOT EXISTS oauth_codes (
    code TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES oauth_apps(client_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri TEXT,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_code ON oauth_codes(code);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires_at ON oauth_codes(expires_at);

-- Enable RLS (Row Level Security) and allow all for service role
ALTER TABLE oauth_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for oauth_apps" ON oauth_apps;
CREATE POLICY "Service role only for oauth_apps" ON oauth_apps FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role only for oauth_codes" ON oauth_codes;
CREATE POLICY "Service role only for oauth_codes" ON oauth_codes FOR ALL TO service_role USING (true);

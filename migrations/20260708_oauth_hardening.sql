-- Dynamic Registration abuse prevention
CREATE TABLE IF NOT EXISTS oauth_registration_logs (
    id BIGSERIAL PRIMARY KEY,
    ip_address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_registration_logs_ip ON oauth_registration_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_oauth_registration_logs_created_at ON oauth_registration_logs(created_at);

ALTER TABLE oauth_registration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for oauth_registration_logs" ON oauth_registration_logs;
CREATE POLICY "Service role only for oauth_registration_logs" ON oauth_registration_logs FOR ALL TO service_role USING (true);

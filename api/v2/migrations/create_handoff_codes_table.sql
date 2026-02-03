-- Handoff Codes Table for Secure Token Exchange
-- This table stores one-time codes that can be exchanged for JWT tokens
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS handoff_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    token TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by code
CREATE INDEX IF NOT EXISTS idx_handoff_codes_code ON handoff_codes(code);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_handoff_codes_expires_at ON handoff_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE handoff_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (no client access)
CREATE POLICY "Service role only" ON handoff_codes
    FOR ALL
    USING (auth.role() = 'service_role');

-- Optional: Create a function to clean up expired codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_handoff_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM handoff_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-handoff-codes', '*/5 * * * *', 'SELECT cleanup_expired_handoff_codes()');

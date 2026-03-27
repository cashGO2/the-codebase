-- Migration to update users table and add OTPs
-- Date: 2026-03-27

-- 1. Add new columns to users table
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Computer Science and Engineering',
ADD COLUMN IF NOT EXISTS current_year INTEGER,
ADD COLUMN IF NOT EXISTS passout_year INTEGER,
ADD COLUMN IF NOT EXISTS specialization TEXT,
ADD COLUMN IF NOT EXISTS university_roll_no TEXT;

-- 2. Create OTPs table
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    type TEXT NOT NULL, -- 'signup', 'recovery'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- 3. Update account recovery (using existing recovery_key column)
-- The user said "recovery_key" already existed and is used as the recovery code/key.

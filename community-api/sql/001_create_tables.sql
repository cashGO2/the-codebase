-- Materio Community Database Schema
-- Run this migration in your Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- Community Posts
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID,  -- NULL for anonymous posts, no FK constraint for flexibility
    author_name TEXT NOT NULL DEFAULT 'materio_user',
    author_avatar TEXT, -- New: store author's profile image URL
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    semester TEXT,
    subject TEXT,
    is_pinned BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted'))
);

-- Community Comments
CREATE TABLE IF NOT EXISTS community_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID, -- NULL for anonymous, no FK for flexibility
    author_name TEXT NOT NULL DEFAULT 'materio_user',
    author_avatar TEXT, -- New: store author's profile image URL
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false
);

-- Community Votes
CREATE TABLE IF NOT EXISTS community_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Changed to TEXT to support 'anon_...' IDs
    target_id UUID NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'note')),
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, target_id, target_type)
);

-- Community Notes (Reader's Added Context)
CREATE TABLE IF NOT EXISTS community_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID,
    author_name TEXT NOT NULL DEFAULT 'materio_user',
    is_faculty_verified BOOLEAN DEFAULT false,
    faculty_verifier_id UUID,
    student_verifications INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community Note Votes
CREATE TABLE IF NOT EXISTS community_note_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES community_notes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, user_id)
);

-- Community Attachments
CREATE TABLE IF NOT EXISTS community_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

-- ============================================
-- INDEXES
-- ============================================

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_semester ON community_posts(semester);
CREATE INDEX IF NOT EXISTS idx_community_posts_subject ON community_posts(subject);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_upvotes ON community_posts(upvotes DESC);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent ON community_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_created_at ON community_comments(created_at);

-- Votes indexes
CREATE INDEX IF NOT EXISTS idx_community_votes_user ON community_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_votes_target ON community_votes(target_id, target_type);

-- Notes indexes
CREATE INDEX IF NOT EXISTS idx_community_notes_post ON community_notes(post_id);
CREATE INDEX IF NOT EXISTS idx_community_notes_approved ON community_notes(is_approved);

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_community_attachments_post ON community_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_attachments_comment ON community_attachments(comment_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Increment comment count
CREATE OR REPLACE FUNCTION increment_comment_count(post_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE community_posts 
    SET comment_count = comment_count + 1 
    WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement comment count
CREATE OR REPLACE FUNCTION decrement_comment_count(post_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE community_posts 
    SET comment_count = GREATEST(0, comment_count - 1) 
    WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment vote (generic for any table)
CREATE OR REPLACE FUNCTION increment_vote(table_name TEXT, record_id UUID, column_name TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE %I SET %I = %I + 1 WHERE id = $1', table_name, column_name, column_name)
    USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement vote (generic for any table)
CREATE OR REPLACE FUNCTION decrement_vote(table_name TEXT, record_id UUID, column_name TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE %I SET %I = GREATEST(0, %I - 1) WHERE id = $1', table_name, column_name, column_name)
    USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Switch vote (decrement old, increment new)
CREATE OR REPLACE FUNCTION switch_vote(table_name TEXT, record_id UUID, old_column TEXT, new_column TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE %I SET %I = GREATEST(0, %I - 1), %I = %I + 1 WHERE id = $1', 
                   table_name, old_column, old_column, new_column, new_column)
    USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_note_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_attachments ENABLE ROW LEVEL SECURITY;

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON community_posts
    FOR SELECT USING (status = 'active');

CREATE POLICY "Authenticated users can create posts" ON community_posts
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts" ON community_posts
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts" ON community_posts
    FOR DELETE USING (auth.uid() = author_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON community_comments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON community_comments
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own comments" ON community_comments
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own comments" ON community_comments
    FOR DELETE USING (auth.uid() = author_id);

-- Votes policies
CREATE POLICY "Users can view their own votes" ON community_votes
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Authenticated users can vote" ON community_votes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can change their votes" ON community_votes
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can remove their votes" ON community_votes
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Notes policies
CREATE POLICY "Approved notes are viewable by everyone" ON community_notes
    FOR SELECT USING (is_approved = true);

CREATE POLICY "Users can view their own pending notes" ON community_notes
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Authenticated users can create notes" ON community_notes
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own notes" ON community_notes
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own notes" ON community_notes
    FOR DELETE USING (auth.uid() = author_id);

-- Note votes policies
CREATE POLICY "Users can view their own note votes" ON community_note_votes
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Authenticated users can vote on notes" ON community_note_votes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can change note votes" ON community_note_votes
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can remove note votes" ON community_note_votes
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Attachments policies
CREATE POLICY "Attachments are viewable by everyone" ON community_attachments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add attachments" ON community_attachments
    FOR INSERT WITH CHECK (true);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for posts
ALTER PUBLICATION supabase_realtime ADD TABLE community_posts;

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE community_comments;

-- Enable realtime for notes (approved only via RLS)
ALTER PUBLICATION supabase_realtime ADD TABLE community_notes;

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Create storage bucket for attachments (run separately)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

-- Storage policies (run separately in Dashboard > Storage > Policies)
-- Allow authenticated users to upload
-- Allow public read access

COMMENT ON TABLE community_posts IS 'Community forum posts/threads';
COMMENT ON TABLE community_comments IS 'Comments on community posts';
COMMENT ON TABLE community_votes IS 'User votes on posts, comments, and notes';
COMMENT ON TABLE community_notes IS 'Community-added context notes (like X/Twitter Community Notes)';
COMMENT ON TABLE community_note_votes IS 'Votes on whether community notes are helpful';
COMMENT ON TABLE community_attachments IS 'File attachments for posts and comments';

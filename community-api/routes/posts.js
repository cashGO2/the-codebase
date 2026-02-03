// Posts API routes for Materio Community
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { authMiddleware, rateLimit } = require('../middleware/auth');

/**
 * GET /posts - Get feed with pagination and filters
 */
router.get('/', authMiddleware(false), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sort = 'newest',
            semester,
            subject,
            tag,
            search
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabaseAdmin
            .from('community_posts')
            .select(`
                id,
                title,
                content,
                author_name,
                is_anonymous,
                created_at,
                updated_at,
                upvotes,
                downvotes,
                comment_count,
                tags,
                semester,
                subject,
                is_pinned,
                is_verified,
                author_id
            `, { count: 'exact' })
            .eq('status', 'active');

        // Apply filters
        if (semester) {
            query = query.eq('semester', semester);
        }
        if (subject) {
            query = query.eq('subject', subject);
        }
        if (tag) {
            query = query.contains('tags', [tag]);
        }
        if (search) {
            query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
        }

        // Apply sorting
        switch (sort) {
            case 'popular':
                query = query.order('upvotes', { ascending: false });
                break;
            case 'unanswered':
                query = query.eq('comment_count', 0).order('created_at', { ascending: false });
                break;
            case 'oldest':
                query = query.order('created_at', { ascending: true });
                break;
            case 'newest':
            default:
                // Pinned posts first, then by date
                query = query.order('is_pinned', { ascending: false })
                    .order('created_at', { ascending: false });
        }

        // Apply pagination
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data: posts, error, count } = await query;

        if (error) {
            console.error('Error fetching posts:', error);
            return res.status(500).json({ error: 'Failed to fetch posts' });
        }

        // Get current user's votes if authenticated
        let userVotes = {};
        if (req.user) {
            const postIds = posts.map(p => p.id);
            const { data: votes } = await supabaseAdmin
                .from('community_votes')
                .select('target_id, vote_type')
                .eq('user_id', req.user.id)
                .in('target_id', postIds)
                .eq('target_type', 'post');

            if (votes) {
                votes.forEach(v => {
                    userVotes[v.target_id] = v.vote_type;
                });
            }
        }

        // Process posts for response
        const processedPosts = posts.map(post => ({
            ...post,
            author_name: post.is_anonymous ? 'materio_user' : post.author_name,
            author_id: post.is_anonymous ? null : post.author_id,
            content_preview: post.content.substring(0, 200) + (post.content.length > 200 ? '...' : ''),
            user_vote: userVotes[post.id] || null,
            score: post.upvotes - post.downvotes
        }));

        res.json({
            posts: processedPosts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Posts fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /posts/:id - Get single post with details
 */
router.get('/:id', authMiddleware(false), async (req, res) => {
    try {
        const { id } = req.params;

        const { data: post, error } = await supabaseAdmin
            .from('community_posts')
            .select(`
                *,
                community_attachments (
                    id,
                    file_url,
                    file_name,
                    file_type,
                    mime_type
                )
            `)
            .eq('id', id)
            .eq('status', 'active')
            .single();

        if (error || !post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Get approved community notes
        const { data: notes } = await supabaseAdmin
            .from('community_notes')
            .select('*')
            .eq('post_id', id)
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        // Get user's vote if authenticated
        let userVote = null;
        if (req.user) {
            const { data: vote } = await supabaseAdmin
                .from('community_votes')
                .select('vote_type')
                .eq('user_id', req.user.id)
                .eq('target_id', id)
                .eq('target_type', 'post')
                .single();

            if (vote) {
                userVote = vote.vote_type;
            }
        }

        // Process post for response
        const processedPost = {
            ...post,
            author_name: post.is_anonymous ? 'materio_user' : post.author_name,
            author_id: post.is_anonymous ? null : post.author_id,
            user_vote: userVote,
            score: post.upvotes - post.downvotes,
            community_notes: notes || [],
            attachments: post.community_attachments || []
        };

        delete processedPost.community_attachments;

        res.json(processedPost);
    } catch (error) {
        console.error('Post fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /posts - Create new post (supports anonymous posting)
 */
router.post('/', authMiddleware(false), rateLimit(10, 60000), async (req, res) => {
    try {
        const {
            title,
            content,
            is_anonymous = false,
            tags = [],
            semester,
            subject,
            attachments = [],
            author_name  // Allow passing author name for anonymous posts
        } = req.body;

        // Basic validation (no hard limits)
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ error: 'Title is required' });
        }
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Determine author info
        let postAuthorId = null;
        let postAuthorName = 'materio_user';
        let postAuthorAvatar = null;

        if (req.user && !is_anonymous) {
            // Authenticated user posting with their identity
            // Ensure ID is a valid UUID format before inserting to a UUID column
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            postAuthorId = uuidRegex.test(req.user.id) ? req.user.id : null;
            postAuthorName = req.user.name || 'materio_user';
            postAuthorAvatar = req.user.avatar || null;
        } else {
            // Anonymous post
            postAuthorId = null;
            postAuthorName = 'materio_user';
            postAuthorAvatar = null;
        }

        // Create post
        const { data: post, error } = await supabaseAdmin
            .from('community_posts')
            .insert({
                title: title.trim(),
                content: content.trim(),
                author_id: postAuthorId,
                author_name: postAuthorName,
                author_avatar: postAuthorAvatar,
                is_anonymous: is_anonymous || !req.user,
                tags: tags || [],
                semester: semester || null,
                subject: subject || null,
                category: req.body.category || 'general'
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating post:', error);
            return res.status(500).json({ error: 'Failed to create post', details: error.message });
        }

        // Add attachments if any
        if (attachments.length > 0) {
            const attachmentRecords = attachments.map(att => ({
                post_id: post.id,
                file_url: att.url,
                file_name: att.name,
                file_type: att.type,
                file_size: att.size,
                mime_type: att.mime_type
            }));

            await supabaseAdmin
                .from('community_attachments')
                .insert(attachmentRecords);
        }

        res.status(201).json({
            ...post,
            attachments,
            message: 'Post created successfully'
        });
    } catch (error) {
        console.error('Post creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /posts/:id - Update post
 */
router.put('/:id', authMiddleware(true), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, tags, semester, subject } = req.body;

        // Check ownership
        const { data: existingPost } = await supabaseAdmin
            .from('community_posts')
            .select('author_id')
            .eq('id', id)
            .single();

        if (!existingPost) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (existingPost.author_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to edit this post' });
        }

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (title) updateData.title = title.trim();
        if (content) updateData.content = content.trim();
        if (tags) updateData.tags = tags;
        if (semester !== undefined) updateData.semester = semester;
        if (subject !== undefined) updateData.subject = subject;

        const { data: post, error } = await supabaseAdmin
            .from('community_posts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating post:', error);
            return res.status(500).json({ error: 'Failed to update post', details: error.message });
        }

        res.json({
            ...post,
            message: 'Post updated successfully'
        });
    } catch (error) {
        console.error('Post update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /posts/:id - Delete post (soft delete)
 */
router.delete('/:id', authMiddleware(true), async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const { data: existingPost } = await supabaseAdmin
            .from('community_posts')
            .select('author_id')
            .eq('id', id)
            .single();

        if (!existingPost) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (existingPost.author_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }

        // Soft delete
        const { error } = await supabaseAdmin
            .from('community_posts')
            .update({ status: 'deleted' })
            .eq('id', id);

        if (error) {
            console.error('Error deleting post:', error);
            return res.status(500).json({ error: 'Failed to delete post' });
        }

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Post delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

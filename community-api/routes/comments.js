// Comments API routes for Materio Community
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { authMiddleware, rateLimit } = require('../middleware/auth');

/**
 * GET /comments/:postId - Get comments for a post
 */
router.get('/:postId', authMiddleware(false), async (req, res) => {
    try {
        const { postId } = req.params;
        const { sort = 'oldest', page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // First get all comments for the post
        let query = supabaseAdmin
            .from('community_comments')
            .select('*', { count: 'exact' })
            .eq('post_id', postId);

        // Apply sorting
        switch (sort) {
            case 'newest':
                query = query.order('created_at', { ascending: false });
                break;
            case 'popular':
                query = query.order('upvotes', { ascending: false });
                break;
            case 'oldest':
            default:
                query = query.order('created_at', { ascending: true });
        }

        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data: comments, error, count } = await query;

        if (error) {
            console.error('Error fetching comments:', error);
            return res.status(500).json({ error: 'Failed to fetch comments' });
        }

        // Get user's votes if authenticated (or anonymous check)
        let userVotes = {};
        const voterId = req.user ? req.user.id : (req.isAnonymous ? `anon_${req.ip.replace(/[^a-zA-Z0-9]/g, '_')}` : null);

        if (voterId && comments.length > 0) {
            const commentIds = comments.map(c => c.id);
            const { data: votes } = await supabaseAdmin
                .from('community_votes')
                .select('target_id, vote_type')
                .eq('user_id', voterId)
                .in('target_id', commentIds)
                .eq('target_type', 'comment');

            if (votes) {
                votes.forEach(v => {
                    userVotes[v.target_id] = v.vote_type;
                });
            }
        }

        // Process comments and build thread structure
        const processedComments = comments.map(comment => ({
            ...comment,
            author_name: comment.is_anonymous ? 'materio_user' : comment.author_name,
            author_id: comment.is_anonymous ? null : comment.author_id,
            user_vote: userVotes[comment.id] || null,
            score: comment.upvotes - comment.downvotes
        }));

        // Build nested structure
        const commentMap = new Map();
        const rootComments = [];

        processedComments.forEach(comment => {
            comment.replies = [];
            commentMap.set(comment.id, comment);
        });

        processedComments.forEach(comment => {
            if (comment.parent_id && commentMap.has(comment.parent_id)) {
                commentMap.get(comment.parent_id).replies.push(comment);
            } else {
                rootComments.push(comment);
            }
        });

        res.json({
            comments: rootComments,
            total: count,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Comments fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /comments/:postId - Add comment to a post (supports anonymous)
 */
router.post('/:postId', authMiddleware(false), rateLimit(20, 60000), async (req, res) => {
    try {
        const { postId } = req.params;
        const { content, parent_id, is_anonymous = false } = req.body;

        // Validation
        if (!content || content.trim().length < 2) {
            return res.status(400).json({ error: 'Comment must be at least 2 characters' });
        }

        // Check if post exists
        const { data: post } = await supabaseAdmin
            .from('community_posts')
            .select('id')
            .eq('id', postId)
            .eq('status', 'active')
            .single();

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Determine author info
        let authorId = null;
        let authorName = 'materio_user';
        let authorAvatar = null;

        if (req.user && !is_anonymous) {
            // Ensure ID is a valid UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            authorId = uuidRegex.test(req.user.id) ? req.user.id : null;
            authorName = req.user.name || 'User';
            authorAvatar = req.user.avatar || null;
        } else {
            authorId = null;
            authorName = 'materio_user';
            authorAvatar = null;
        }

        // Create comment
        const { data: comment, error } = await supabaseAdmin
            .from('community_comments')
            .insert({
                post_id: postId,
                parent_id: parent_id || null,
                content: content.trim(),
                author_id: authorId,
                author_name: authorName,
                author_avatar: authorAvatar,
                is_anonymous: is_anonymous || !req.user
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating comment:', error);
            return res.status(500).json({ error: 'Failed to create comment', details: error.message });
        }

        // Update comment count on post
        await supabaseAdmin.rpc('increment_comment_count', { post_id: postId });

        res.status(201).json({
            ...comment,
            author_name: is_anonymous ? 'materio_user' : comment.author_name,
            author_id: is_anonymous ? null : comment.author_id,
            score: 0,
            user_vote: null,
            replies: [],
            message: 'Comment added successfully'
        });
    } catch (error) {
        console.error('Comment creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /comments/:id - Update comment
 */
router.put('/:id', authMiddleware(true), async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        // Check ownership
        const { data: existingComment } = await supabaseAdmin
            .from('community_comments')
            .select('author_id')
            .eq('id', id)
            .single();

        if (!existingComment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (existingComment.author_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to edit this comment' });
        }

        const { data: comment, error } = await supabaseAdmin
            .from('community_comments')
            .update({
                content: content.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating comment:', error);
            return res.status(500).json({ error: 'Failed to update comment' });
        }

        res.json({
            ...comment,
            message: 'Comment updated successfully'
        });
    } catch (error) {
        console.error('Comment update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /comments/:id - Delete comment
 */
router.delete('/:id', authMiddleware(true), async (req, res) => {
    try {
        const { id } = req.params;

        // Get comment with post info
        const { data: existingComment } = await supabaseAdmin
            .from('community_comments')
            .select('author_id, post_id')
            .eq('id', id)
            .single();

        if (!existingComment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (existingComment.author_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        // Delete all child comments first (cascade)
        await supabaseAdmin
            .from('community_comments')
            .delete()
            .eq('parent_id', id);

        // Delete the comment
        const { error } = await supabaseAdmin
            .from('community_comments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting comment:', error);
            return res.status(500).json({ error: 'Failed to delete comment' });
        }

        // Decrement comment count on post
        await supabaseAdmin.rpc('decrement_comment_count', { post_id: existingComment.post_id });

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Comment delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

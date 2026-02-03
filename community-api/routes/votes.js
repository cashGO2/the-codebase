// Votes API routes for Materio Community
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { authMiddleware, rateLimit } = require('../middleware/auth');

/**
 * POST /votes - Cast a vote (supports anonymous voting)
 */
router.post('/', authMiddleware(false), rateLimit(60, 60000), async (req, res) => {
    try {
        const { target_id, target_type, vote_type } = req.body;

        // Use user ID if authenticated, fallback to a session-based anonymous ID or IP
        const voterId = req.user ? req.user.id : `anon_${req.ip.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // Validation
        if (!target_id || !target_type || !vote_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['post', 'comment', 'note'].includes(target_type)) {
            return res.status(400).json({ error: 'Invalid target type' });
        }

        if (!['up', 'down'].includes(vote_type)) {
            return res.status(400).json({ error: 'Invalid vote type' });
        }

        // Check if target exists
        let table;
        switch (target_type) {
            case 'post':
                table = 'community_posts';
                break;
            case 'comment':
                table = 'community_comments';
                break;
            case 'note':
                table = 'community_notes';
                break;
        }

        const { data: target } = await supabaseAdmin
            .from(table)
            .select('id, author_id')
            .eq('id', target_id)
            .single();

        if (!target) {
            return res.status(404).json({ error: `${target_type} not found` });
        }

        // Prevent self-voting (if authenticated)
        if (req.user && target.author_id === req.user.id) {
            return res.status(400).json({ error: 'Cannot vote on your own content' });
        }

        // Check for existing vote
        const { data: existingVote } = await supabaseAdmin
            .from('community_votes')
            .select('id, vote_type')
            .eq('user_id', voterId)
            .eq('target_id', target_id)
            .eq('target_type', target_type)
            .single();

        if (existingVote) {
            if (existingVote.vote_type === vote_type) {
                // Same vote type - remove the vote
                await supabaseAdmin
                    .from('community_votes')
                    .delete()
                    .eq('id', existingVote.id);

                // Update counts
                const column = vote_type === 'up' ? 'upvotes' : 'downvotes';
                await supabaseAdmin.rpc('decrement_vote', {
                    table_name: table,
                    record_id: target_id,
                    column_name: column
                });

                return res.json({
                    message: 'Vote removed',
                    action: 'removed',
                    new_vote: null
                });
            } else {
                // Different vote type - switch the vote
                await supabaseAdmin
                    .from('community_votes')
                    .update({ vote_type })
                    .eq('id', existingVote.id);

                // Update counts (decrement old, increment new)
                const oldColumn = existingVote.vote_type === 'up' ? 'upvotes' : 'downvotes';
                const newColumn = vote_type === 'up' ? 'upvotes' : 'downvotes';

                await supabaseAdmin.rpc('switch_vote', {
                    table_name: table,
                    record_id: target_id,
                    old_column: oldColumn,
                    new_column: newColumn
                });

                return res.json({
                    message: 'Vote changed',
                    action: 'switched',
                    new_vote: vote_type
                });
            }
        } else {
            // New vote
            await supabaseAdmin
                .from('community_votes')
                .insert({
                    user_id: voterId,
                    target_id,
                    target_type,
                    vote_type
                });

            // Update count
            const column = vote_type === 'up' ? 'upvotes' : 'downvotes';
            await supabaseAdmin.rpc('increment_vote', {
                table_name: table,
                record_id: target_id,
                column_name: column
            });

            return res.status(201).json({
                message: 'Vote recorded',
                action: 'created',
                new_vote: vote_type
            });
        }
    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /votes/:target_id - Remove a vote
 */
router.delete('/:target_id', authMiddleware(false), async (req, res) => {
    try {
        const { target_id } = req.params;
        const { target_type } = req.query;

        const voterId = req.user ? req.user.id : `anon_${req.ip.replace(/[^a-zA-Z0-9]/g, '_')}`;

        if (!target_type || !['post', 'comment', 'note'].includes(target_type)) {
            return res.status(400).json({ error: 'Invalid target type' });
        }

        // Find existing vote
        const { data: existingVote } = await supabaseAdmin
            .from('community_votes')
            .select('id, vote_type')
            .eq('user_id', voterId)
            .eq('target_id', target_id)
            .eq('target_type', target_type)
            .single();

        if (!existingVote) {
            return res.status(404).json({ error: 'Vote not found' });
        }

        // Delete vote
        await supabaseAdmin
            .from('community_votes')
            .delete()
            .eq('id', existingVote.id);

        // Update count
        let table;
        switch (target_type) {
            case 'post':
                table = 'community_posts';
                break;
            case 'comment':
                table = 'community_comments';
                break;
            case 'note':
                table = 'community_notes';
                break;
        }

        const column = existingVote.vote_type === 'up' ? 'upvotes' : 'downvotes';
        await supabaseAdmin.rpc('decrement_vote', {
            table_name: table,
            record_id: target_id,
            column_name: column
        });

        res.json({ message: 'Vote removed' });
    } catch (error) {
        console.error('Vote delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /votes/user - Get current user's votes on multiple targets
 */
router.get('/user', authMiddleware(false), async (req, res) => {
    try {
        const { target_ids, target_type } = req.query;

        const voterId = req.user ? req.user.id : `anon_${req.ip.replace(/[^a-zA-Z0-9]/g, '_')}`;

        if (!target_ids || !target_type) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const ids = Array.isArray(target_ids) ? target_ids : target_ids.split(',');

        const { data: votes, error } = await supabaseAdmin
            .from('community_votes')
            .select('target_id, vote_type')
            .eq('user_id', voterId)
            .eq('target_type', target_type)
            .in('target_id', ids);

        if (error) {
            console.error('Error fetching user votes:', error);
            return res.status(500).json({ error: 'Failed to fetch votes' });
        }

        // Convert to map
        const votesMap = {};
        votes.forEach(v => {
            votesMap[v.target_id] = v.vote_type;
        });

        res.json({ votes: votesMap });
    } catch (error) {
        console.error('User votes fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

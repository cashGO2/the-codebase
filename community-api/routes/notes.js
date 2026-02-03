// Community Notes API routes for Materio Community
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { authMiddleware, requireFaculty, rateLimit } = require('../middleware/auth');

// Threshold for student consensus approval
const STUDENT_CONSENSUS_THRESHOLD = 5;
const STUDENT_CONSENSUS_RATIO = 0.7; // 70% must find it helpful

/**
 * GET /notes/:postId - Get community notes for a post
 */
router.get('/:postId', authMiddleware(false), async (req, res) => {
    try {
        const { postId } = req.params;
        const { include_pending = false } = req.query;

        let query = supabaseAdmin
            .from('community_notes')
            .select(`
                id,
                content,
                author_name,
                is_faculty_verified,
                student_verifications,
                is_approved,
                created_at,
                updated_at
            `)
            .eq('post_id', postId)
            .order('is_approved', { ascending: false })
            .order('is_faculty_verified', { ascending: false })
            .order('student_verifications', { ascending: false });

        // Only include pending notes for authenticated users or if explicitly requested
        if (!include_pending || !req.user) {
            query = query.eq('is_approved', true);
        }

        const { data: notes, error } = await query;

        if (error) {
            console.error('Error fetching notes:', error);
            return res.status(500).json({ error: 'Failed to fetch notes' });
        }

        // Get user's vote on notes if authenticated
        let userVotes = {};
        if (req.user && notes.length > 0) {
            const noteIds = notes.map(n => n.id);
            const { data: votes } = await supabaseAdmin
                .from('community_note_votes')
                .select('note_id, is_helpful')
                .eq('user_id', req.user.id)
                .in('note_id', noteIds);

            if (votes) {
                votes.forEach(v => {
                    userVotes[v.note_id] = v.is_helpful;
                });
            }
        }

        const processedNotes = notes.map(note => ({
            ...note,
            user_vote: userVotes[note.id] !== undefined ? userVotes[note.id] : null,
            verification_status: note.is_faculty_verified
                ? 'faculty_verified'
                : (note.is_approved ? 'student_consensus' : 'pending')
        }));

        res.json({ notes: processedNotes });
    } catch (error) {
        console.error('Notes fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /notes/:postId - Add a community note
 */
router.post('/:postId', authMiddleware(true), rateLimit(5, 60000), async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;

        // Validation
        if (!content || content.trim().length < 20) {
            return res.status(400).json({ error: 'Note must be at least 20 characters' });
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

        // Check if user already has a pending note on this post
        const { data: existingNote } = await supabaseAdmin
            .from('community_notes')
            .select('id')
            .eq('post_id', postId)
            .eq('author_id', req.user.id)
            .single();

        if (existingNote) {
            return res.status(400).json({ error: 'You already have a note on this post' });
        }

        // Faculty notes are auto-approved
        const isFaculty = req.user.role === 'faculty' || req.user.role === 'admin';

        const { data: note, error } = await supabaseAdmin
            .from('community_notes')
            .insert({
                post_id: postId,
                content: content.trim(),
                author_id: req.user.id,
                author_name: req.user.name,
                is_faculty_verified: isFaculty,
                faculty_verifier_id: isFaculty ? req.user.id : null,
                is_approved: isFaculty
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating note:', error);
            return res.status(500).json({ error: 'Failed to create note' });
        }

        res.status(201).json({
            ...note,
            verification_status: isFaculty ? 'faculty_verified' : 'pending',
            message: isFaculty
                ? 'Note added and approved (faculty verified)'
                : 'Note submitted for community review'
        });
    } catch (error) {
        console.error('Note creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /notes/:id/verify - Faculty verify a note
 */
router.post('/:id/verify', authMiddleware(true), requireFaculty, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: note, error } = await supabaseAdmin
            .from('community_notes')
            .update({
                is_faculty_verified: true,
                faculty_verifier_id: req.user.id,
                is_approved: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error verifying note:', error);
            return res.status(500).json({ error: 'Failed to verify note' });
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json({
            ...note,
            verification_status: 'faculty_verified',
            message: 'Note verified by faculty'
        });
    } catch (error) {
        console.error('Note verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /notes/:id/vote - Vote on a note (helpful / not helpful)
 */
router.post('/:id/vote', authMiddleware(true), rateLimit(30, 60000), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_helpful } = req.body;

        if (typeof is_helpful !== 'boolean') {
            return res.status(400).json({ error: 'is_helpful must be a boolean' });
        }

        // Check if note exists
        const { data: note } = await supabaseAdmin
            .from('community_notes')
            .select('id, author_id, student_verifications, is_approved, is_faculty_verified')
            .eq('id', id)
            .single();

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Prevent self-voting
        if (note.author_id === req.user.id) {
            return res.status(400).json({ error: 'Cannot vote on your own note' });
        }

        // Check for existing vote
        const { data: existingVote } = await supabaseAdmin
            .from('community_note_votes')
            .select('id, is_helpful')
            .eq('note_id', id)
            .eq('user_id', req.user.id)
            .single();

        if (existingVote) {
            if (existingVote.is_helpful === is_helpful) {
                // Same vote - remove it
                await supabaseAdmin
                    .from('community_note_votes')
                    .delete()
                    .eq('id', existingVote.id);

                // Update verification count if was helpful
                if (existingVote.is_helpful) {
                    await supabaseAdmin
                        .from('community_notes')
                        .update({
                            student_verifications: Math.max(0, note.student_verifications - 1)
                        })
                        .eq('id', id);
                }

                return res.json({ message: 'Vote removed', action: 'removed' });
            } else {
                // Switch vote
                await supabaseAdmin
                    .from('community_note_votes')
                    .update({ is_helpful })
                    .eq('id', existingVote.id);

                // Update count
                const newCount = is_helpful
                    ? note.student_verifications + 1
                    : Math.max(0, note.student_verifications - 1);

                await supabaseAdmin
                    .from('community_notes')
                    .update({ student_verifications: newCount })
                    .eq('id', id);

                // Check for consensus approval
                await checkConsensusApproval(id);

                return res.json({ message: 'Vote changed', action: 'switched', new_vote: is_helpful });
            }
        } else {
            // New vote
            await supabaseAdmin
                .from('community_note_votes')
                .insert({
                    note_id: id,
                    user_id: req.user.id,
                    is_helpful
                });

            // Update count if helpful
            if (is_helpful) {
                await supabaseAdmin
                    .from('community_notes')
                    .update({
                        student_verifications: note.student_verifications + 1
                    })
                    .eq('id', id);

                // Check for consensus approval
                await checkConsensusApproval(id);
            }

            return res.status(201).json({
                message: 'Vote recorded',
                action: 'created',
                new_vote: is_helpful
            });
        }
    } catch (error) {
        console.error('Note vote error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Check if a note has reached consensus for approval
 */
async function checkConsensusApproval(noteId) {
    try {
        // Get all votes for the note
        const { data: votes } = await supabaseAdmin
            .from('community_note_votes')
            .select('is_helpful')
            .eq('note_id', noteId);

        if (!votes || votes.length < STUDENT_CONSENSUS_THRESHOLD) {
            return; // Not enough votes yet
        }

        const helpfulCount = votes.filter(v => v.is_helpful).length;
        const ratio = helpfulCount / votes.length;

        if (ratio >= STUDENT_CONSENSUS_RATIO) {
            // Approve the note
            await supabaseAdmin
                .from('community_notes')
                .update({ is_approved: true })
                .eq('id', noteId)
                .eq('is_approved', false); // Only if not already approved

            console.log(`Note ${noteId} approved by student consensus (${helpfulCount}/${votes.length})`);
        }
    } catch (error) {
        console.error('Consensus check error:', error);
    }
}

/**
 * DELETE /notes/:id - Delete a note (author or admin only)
 */
router.delete('/:id', authMiddleware(true), async (req, res) => {
    try {
        const { id } = req.params;

        const { data: note } = await supabaseAdmin
            .from('community_notes')
            .select('author_id')
            .eq('id', id)
            .single();

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        if (note.author_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this note' });
        }

        // Delete votes first
        await supabaseAdmin
            .from('community_note_votes')
            .delete()
            .eq('note_id', id);

        // Delete note
        const { error } = await supabaseAdmin
            .from('community_notes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting note:', error);
            return res.status(500).json({ error: 'Failed to delete note' });
        }

        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        console.error('Note delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

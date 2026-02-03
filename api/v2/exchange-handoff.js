const {
    supabase,
    consumeHandoffCode,
    addCorsHeaders
} = require('./_utils');
const cors = require('./cors');

/**
 * Exchange Handoff Code for JWT Token
 * 
 * This endpoint exchanges a one-time handoff code for the actual JWT token.
 * The handoff code is generated during login and is valid for 60 seconds.
 * Once exchanged, the code is immediately invalidated.
 * 
 * POST /api/v2/exchange-handoff
 * Body: { code: string }
 * Response: { token: string, user: object }
 */
module.exports = async (req, res) => {
    // Add CORS headers to all responses
    addCorsHeaders(res, req.headers.origin);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return cors(req, res);
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code } = req.body;

        // Validate input
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Handoff code is required' });
        }

        // Get request metadata for optional validation
        const userAgent = req.headers['user-agent'] || '';
        const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'] ||
            req.connection?.remoteAddress || '';

        // Consume the handoff code (validates and deletes it)
        const result = await consumeHandoffCode(code, userAgent, ip);

        if (!result.valid) {
            return res.status(401).json({ error: result.error });
        }

        // Fetch user data to return with the token
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username, display_name, email, has_admin_privileges, is_plus_user, profile_picture')
            .eq('id', result.userId)
            .single();

        if (userError || !user) {
            // Token is still valid, just return it without user data
            return res.status(200).json({
                message: 'Handoff successful',
                token: result.token
            });
        }

        // Return success response with token and user data
        return res.status(200).json({
            message: 'Handoff successful',
            token: result.token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                hasAdminPrivileges: user.has_admin_privileges,
                isPlusUser: user.is_plus_user,
                profilePicture: user.profile_picture
            }
        });

    } catch (error) {
        console.error('Exchange handoff error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

const {
    supabase,
    generateToken,
    generateHandoffCode,
    storeHandoffCode,
    getTokenFromHeaders,
    verifyToken,
    addCorsHeaders
} = require('./_utils');
const cors = require('./cors');

/**
 * Create Handoff Code for Already-Authenticated Users
 * 
 * This endpoint generates a one-time handoff code for users who are already
 * logged in and need to pass their auth to another site.
 * 
 * POST /api/v2/create-handoff
 * Headers: Authorization: Bearer <token>
 * Response: { handoffCode: string }
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
        // Get and verify the auth token
        const token = getTokenFromHeaders(req.headers);

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Generate a new handoff code
        const handoffCode = generateHandoffCode();

        // Get request metadata
        const userAgent = req.headers['user-agent'] || '';
        const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'] ||
            req.connection?.remoteAddress || '';

        // Store the handoff code (expires in 60 seconds)
        const stored = await storeHandoffCode(handoffCode, token, decoded.id, userAgent, ip);

        if (!stored) {
            return res.status(500).json({ error: 'Failed to create handoff code' });
        }

        return res.status(200).json({
            message: 'Handoff code created',
            handoffCode,
            expiresIn: 60 // seconds
        });

    } catch (error) {
        console.error('Create handoff error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

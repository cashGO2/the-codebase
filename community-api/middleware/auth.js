// Auth middleware for Materio Community API
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../lib/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Verify JWT token and attach user to request
 * @param {boolean} required - Whether authentication is required
 */
function authMiddleware(required = false) {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                if (required) {
                    return res.status(401).json({ error: 'Authentication required' });
                }
                // Set anonymous user context
                req.user = null;
                req.isAnonymous = true;
                return next();
            }

            const token = authHeader.split(' ')[1];

            // First try to verify as Supabase JWT
            try {
                // Verify with Supabase
                const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

                if (!error && user) {
                    req.user = {
                        id: user.id,
                        email: user.email,
                        name: user.user_metadata?.displayName || user.user_metadata?.full_name || user.user_metadata?.username || user.email?.split('@')[0] || 'User',
                        avatar: user.user_metadata?.profilePicture || user.user_metadata?.avatar_url || user.user_metadata?.photoURL,
                        role: user.user_metadata?.role || 'student'
                    };
                    req.isAnonymous = false;
                    return next();
                }
            } catch (supabaseError) {
                // Continue to try JWT verification
            }

            // Try to verify as custom JWT
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                req.user = {
                    id: decoded.id || decoded.sub || decoded.userId || decoded.username,
                    email: decoded.email,
                    name: decoded.displayName || decoded.name || decoded.username || 'User',
                    avatar: decoded.profilePicture || decoded.avatar || decoded.photoURL,
                    role: decoded.role || 'student'
                };
                req.isAnonymous = false;
                return next();
            } catch (jwtError) {
                if (required) {
                    return res.status(401).json({ error: 'Invalid or expired token' });
                }
                req.user = null;
                req.isAnonymous = true;
                return next();
            }
        } catch (error) {
            console.error('Auth middleware error:', error);
            if (required) {
                return res.status(500).json({ error: 'Authentication error' });
            }
            req.user = null;
            req.isAnonymous = true;
            next();
        }
    };
}

/**
 * Check if user has faculty role
 */
function requireFaculty(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Faculty access required' });
    }
    next();
}

/**
 * Rate limiting by IP/user
 */
const rateLimitMap = new Map();

function rateLimit(maxRequests = 60, windowMs = 60000) {
    return (req, res, next) => {
        const key = req.user?.id || req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get or create rate limit entry
        let entry = rateLimitMap.get(key);
        if (!entry) {
            entry = { requests: [], blocked: false };
            rateLimitMap.set(key, entry);
        }

        // Clean old requests
        entry.requests = entry.requests.filter(time => time > windowStart);

        // Check rate limit
        if (entry.requests.length >= maxRequests) {
            return res.status(429).json({
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil((entry.requests[0] + windowMs - now) / 1000)
            });
        }

        // Add this request
        entry.requests.push(now);

        next();
    };
}

module.exports = {
    authMiddleware,
    requireFaculty,
    rateLimit
};

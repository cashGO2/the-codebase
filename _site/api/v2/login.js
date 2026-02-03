const {
  supabase,
  comparePassword,
  generateToken,
  generateHandoffCode,
  storeHandoffCode,
  addCorsHeaders
} = require('./_utils');
const cors = require('./cors');

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
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if username is an email
    const isEmail = /\S+@\S+\.\S+/.test(username);
    const field = isEmail ? 'email' : 'username';

    // Find user by username or email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq(field, username)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare provided password with stored hash
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username
    });

    // Get profile picture URL if exists
    let profilePicture = user.profile_picture;

    // Generate a one-time handoff code for secure token exchange
    const handoffCode = generateHandoffCode();

    // Get request metadata for optional validation
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress || '';

    // Store the handoff code (expires in 60 seconds)
    const stored = await storeHandoffCode(handoffCode, token, user.id, userAgent, ip);

    if (!stored) {
      // Fallback: return token directly if handoff storage fails
      console.warn('Handoff code storage failed, returning token directly');
      return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          hasAdminPrivileges: user.has_admin_privileges,
          isPlusUser: user.is_plus_user,
          profilePicture
        }
      });
    }

    // Return success response with handoff code (not the token!)
    return res.status(200).json({
      message: 'Login successful',
      handoffCode,  // One-time code to exchange for token
      token,        // Also return token for same-origin use (stored securely)
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        hasAdminPrivileges: user.has_admin_privileges,
        isPlusUser: user.is_plus_user,
        profilePicture
      }
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

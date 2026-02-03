const {
  supabase,
  hashPassword,
  generateToken,
  verifyToken,
  getTokenFromHeaders,
  corsHeaders,
  addCorsHeaders
} = require('./_utils');
const cors = require('./cors');

module.exports = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;
  addCorsHeaders(res, origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return cors(req, res);
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action;

  if (action === 'forgot-password') {
    return handleForgotPassword(req, res);
  } else if (action === 'admin-recovery') {
    return handleAdminRecovery(req, res);
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }
};

async function handleForgotPassword(req, res) {
  try {
    const { email, recoveryKey, newPassword } = req.body;

    // Validate inputs
    if (!email || !recoveryKey) {
      return res.status(400).json({ error: 'Email and recovery key are required' });
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify recovery key
    if (user.recovery_key !== recoveryKey) {
      return res.status(401).json({ error: 'Invalid recovery key' });
    }

    // Only proceed if newPassword is provided
    if (newPassword) {
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update password' });
      }

      // Generate a token for the user so they can be logged in immediately
      const token = generateToken(user);
      return res.status(200).json({
        message: 'Password updated successfully',
        token: token
      });
    } else {
      // Just verifying the key
      return res.status(200).json({
        verified: true,
        message: 'Recovery key valid'
      });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleAdminRecovery(req, res) {
  try {
    // Get token from headers
    const token = getTokenFromHeaders(req.headers);

    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get admin user and verify privileges
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, has_admin_privileges')
      .eq('id', decoded.id)
      .single();

    if (adminError || !adminUser || !adminUser.has_admin_privileges) {
      return res.status(403).json({ error: 'Admin privileges required for account recovery service' });
    }

    // Parse request body
    const { email, username } = req.body;

    // Validate required fields
    if (!email && !username) {
      return res.status(400).json({ error: 'Email or username is required' });
    }

    // Find target user
    let query = supabase.from('users').select('id, email, username, recovery_key');

    if (email) {
      query = query.eq('email', email);
    } else {
      query = query.eq('username', username);
    }

    const { data: targetUser, error: targetError } = await query.single();

    if (targetError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return the recovery key
    return res.status(200).json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username
      },
      recovery_key: targetUser.recovery_key
    });

  } catch (error) {
    console.error('Admin recovery error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

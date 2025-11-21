const { 
  supabase, 
  hashPassword, 
  generateToken 
} = require('./utils');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
        return res.status(500).json({ error: 'Failed to update password', details: updateError });
      }

      // Generate new token
      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username
      });

      // Return success response with token
      return res.status(200).json({
        message: 'Password reset successfully',
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email
        }
      });
    } else {
      // If no new password provided, just verify the recovery key
      return res.status(200).json({ 
        message: 'Recovery key verified',
        verified: true
      });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

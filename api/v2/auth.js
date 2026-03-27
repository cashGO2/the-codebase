const {
  supabase,
  supabaseAdmin,
  hashPassword,
  generateToken,
  verifyToken,
  getTokenFromHeaders,
  corsHeaders,
  addCorsHeaders
} = require('./_utils');
const { sendOTPEmail } = require('../_utils_shared/mailer');
const { getOTPTemplate } = require('../_utils_shared/otp_template');
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

  const action = req.query.action || (req.body && req.body.action);

  if (action === 'forgot-password') {
    return handleForgotPassword(req, res);
  } else if (action === 'admin-recovery') {
    return handleAdminRecovery(req, res);
  } else if (action === 'otp') {
    return handleOTP(req, res);
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }
};

async function handleForgotPassword(req, res) {
  try {
    const { email, recoveryKey, recoveryCode, otp, newPassword } = req.body;
 
    // Alias recoveryCode to recoveryKey for consistency with frontend naming
    const finalRecoveryKey = recoveryKey || recoveryCode;

    // Validate inputs
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Must have at least one method of verification
    if (!finalRecoveryKey && !otp) {
      return res.status(400).json({ error: 'Verification method (OTP or Recovery Key) is required' });
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify method
    let isVerified = false;

    if (otp) {
      // Check OTP in Supabase otps table
      const { data: otpRecord, error: otpError } = await supabase
        .from('otps')
        .select('*')
        .eq('email', email)
        .eq('otp', otp)
        .eq('type', 'recovery')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!otpError && otpRecord) {
        isVerified = true;
        // Clean up OTP
        await supabase.from('otps').delete().eq('id', otpRecord.id);
      }
    } else if (finalRecoveryKey) {
      isVerified = (user.recovery_key === finalRecoveryKey);
    }

    if (!isVerified) {
      return res.status(401).json({ error: 'Verification failed. Incorrect code or key.' });
    }

    // Only proceed if newPassword is provided
    if (newPassword) {
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      const updateData = {
          password: hashedPassword,
          updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
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
      // Just verifying the key/OTP
      return res.status(200).json({
        verified: true,
        message: 'Verification successful'
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
    if (!email || !username) {
      return res.status(400).json({ error: 'Both email and username are required for account recovery' });
    }

    // Find target user by email AND username for security
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, username, display_name, email, profile_picture, created_at, updated_at, recovery_key, has_admin_privileges, is_plus_user')
      .eq('email', email)
      .eq('username', username)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({
        error: 'User not found with the provided email and username combination',
        details: 'Both email and username must match exactly for security purposes'
      });
    }

    // Log the recovery attempt for audit purposes
    console.log(`Admin recovery attempted by ${adminUser.id} for user ${targetUser.id} (${targetUser.email})`);

    // Return the recovery key and all user data
    return res.status(200).json({
      message: 'Account recovery data retrieved successfully',
      recoveryService: 'Premium Admin Account Recovery',
      adminId: adminUser.id,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.display_name,
        email: targetUser.email,
        profilePicture: targetUser.profile_picture,
        recoveryKey: targetUser.recovery_key,
        hasAdminPrivileges: targetUser.has_admin_privileges,
        isPlusUser: targetUser.is_plus_user,
        createdAt: targetUser.created_at,
        updatedAt: targetUser.updated_at
      },
      securityNote: 'This recovery includes the user\'s recovery key for password reset purposes',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin recovery error:', error);
    return res.status(500).json({
      error: 'Internal server error during account recovery',
      details: error.message
    });
  }
}

async function handleOTP(req, res) {
  try {
    const { email, type } = req.body; // type: 'signup' or 'recovery'

    if (!email || !type) {
      return res.status(400).json({ error: 'Email and type are required' });
    }

    // Signup restricted to university email
    if (type === 'signup') {
      const universityRegex = /^\d{13}@paruluniversity\.ac\.in$/;
      if (!universityRegex.test(email)) {
        return res.status(400).json({ 
          error: 'Restricted Signup', 
          message: 'Only students with @paruluniversity.ac.in emails are allowed to create an account.' 
        });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store in Supabase otps table
    const { error: dbError } = await supabaseAdmin
      .from('otps')
      .insert({
        email,
        otp,
        type,
        expires_at: expiresAt
      });

    if (dbError) {
      console.error('OTP Save Error:', {
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code
      });
      return res.status(500).json({ error: 'Failed to generate verification code', details: dbError.message });
    }

    // Render Template
    const html = getOTPTemplate(otp, type, email);

    // Send Email
    const emailResult = await sendOTPEmail({
      to: email,
      otp,
      type,
      html
    });

    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send verification email', details: emailResult.error });
    }

    return res.status(200).json({ 
      success: true, 
      message: `A verification code has been sent to ${email}. It expires in 10 minutes.` 
    });

  } catch (error) {
    console.error('OTP Handler Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

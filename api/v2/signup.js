const { 
  supabaseAdmin, 
  hashPassword, 
  generateToken, 
  generateRecoveryKey,
  addCorsHeaders
} = require('./_utils');
const cors = require('./cors');

/**
 * API Endpoint: /api/v2/signup
 * Handles university-exclusive signup with OTP verification.
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
    const { 
      username, 
      displayName, 
      email, 
      password, 
      profilePicture, 
      otp,
      avatarVariant = 'shape', // shape, character, face (Avvvatars styles)
      inviteCode, // Optional gift code
      branch = 'Computer Science and Engineering',
      currentYear,
      passoutYear,
      specialization
    } = req.body;

    const hasInlineProfilePicture = typeof profilePicture === 'string' && profilePicture.startsWith('data:image');

    // Validate inputs (inviteCode is optional)
    if (!username || !displayName || !email || !password || !otp) {
      return res.status(400).json({ error: 'Missing required fields including verification code' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // University email validation during signup
    if (!normalizedEmail.endsWith('@paruluniversity.ac.in')) {
      return res.status(400).json({ error: 'Only Parul University emails are allowed (@paruluniversity.ac.in)' });
    }

    // STEP 1: Verify OTP
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('otp', otp)
      .eq('type', 'signup')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // STEP 1.5: Validate Optional Invite Code (Gift Code)
    let isPlusUser = false;
    let validInvite = null;

    if (inviteCode) {
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from('invites')
        .select('*')
        .eq('code', inviteCode.trim())
        .eq('redeemed', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (inviteError || !invite) {
        return res.status(400).json({ error: 'Invalid or expired gift code' });
      }
      
      validInvite = invite;
      isPlusUser = !!invite.contains_plus_perks;
    }

    // STEP 2: Check if user already exists
    const { data: existingUserByEmail } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUserByEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const { data: existingUserByUsername } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (existingUserByUsername) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // STEP 3: Create user
    const recoveryKey = generateRecoveryKey();
    const hashedPassword = await hashPassword(password);
    
    // Default fallback if capture fails (UI Avatars - neutral and clean)
    const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=128&bold=true`;
    
    const userData = {
      username,
      display_name: displayName,
      email: normalizedEmail,
      password: hashedPassword,
      recovery_key: recoveryKey,
      has_admin_privileges: false,
      is_plus_user: isPlusUser,
      branch: branch,
      current_year: currentYear,
      passout_year: passoutYear,
      specialization: specialization,
      university_roll_no: normalizedEmail.split('@')[0], // Entire roll number string before domain
      // Use captured picture if available, otherwise neutral fallback
      profile_picture: hasInlineProfilePicture ? profilePicture : fallbackAvatarUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (userError) {
      return res.status(500).json({ error: 'Failed to create user', details: userError });
    }

    // STEP 3.5: Mark Invite as Redeemed if used
    if (validInvite) {
      await supabaseAdmin
        .from('invites')
        .update({
          redeemed: true,
          redeemed_by: newUser.id,
          redeemed_date: new Date().toISOString()
        })
        .eq('id', validInvite.id);
    }

    // STEP 4: Handle profile picture upload if provided (replaces boring avatar)
    let finalProfilePic = userData.profile_picture;
    if (hasInlineProfilePicture) {
      try {
        const base64Data = profilePicture.split(',')[1];
        const mimeType = profilePicture.match(/data:(.*?);base64/)?.[1] || 'image/png';
        let fileExt = 'png';
        if (mimeType.includes('svg')) fileExt = 'svg';
        else if (mimeType.includes('jpeg')) fileExt = 'jpeg';
        else if (mimeType.includes('jpg')) fileExt = 'jpg';
        else if (mimeType.includes('webp')) fileExt = 'webp';
        const fileName = `${newUser.id}/profile.${fileExt}`;
        const bufferData = Buffer.from(base64Data, 'base64');
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from('profile-pictures')
          .upload(fileName, bufferData, {
            contentType: mimeType,
            upsert: true
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('profile-pictures')
            .getPublicUrl(fileName);

          finalProfilePic = publicUrl;
          await supabaseAdmin
            .from('users')
            .update({ profile_picture: finalProfilePic })
            .eq('id', newUser.id);
        }
      } catch (error) {
        console.error('Profile picture upload error:', error);
      }
    }

    // STEP 5: Clean up OTP
    await supabaseAdmin.from('otps').delete().eq('id', otpRecord.id);

    // STEP 6: Generate JWT token
    const token = generateToken({ 
      id: newUser.id, 
      email: newUser.email, 
      username: newUser.username 
    });

    // STEP 7: Return success
    return res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.display_name,
        email: newUser.email,
        hasAdminPrivileges: newUser.has_admin_privileges,
        isPlusUser: newUser.is_plus_user,
        profilePicture: finalProfilePic,
        recoveryKey
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

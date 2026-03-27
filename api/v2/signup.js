const { 
  supabase, 
  hashPassword, 
  generateToken, 
  generateRecoveryKey 
} = require('./_utils');

/**
 * API Endpoint: /api/v2/signup
 * Handles university-exclusive signup with OTP verification.
 */
module.exports = async (req, res) => {
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
      avatarVariant = 'beam', // beam, marble, pixel, sunset, bauhaus, ring
      inviteCode, // Optional gift code
      branch = 'Computer Science and Engineering',
      currentYear,
      passoutYear,
      specialization
    } = req.body;

    // Validate inputs (inviteCode is optional)
    if (!username || !displayName || !email || !password || !otp) {
      return res.status(400).json({ error: 'Missing required fields including verification code' });
    }

    // University email validation during signup
    const universityRegex = /^(\d{2})\d{7}(\d{4})@paruluniversity\.ac\.in$/;
    const emailMatch = email.match(universityRegex);
    if (!emailMatch) {
      return res.status(400).json({ error: 'Only Parul University emails are allowed (@paruluniversity.ac.in)' });
    }

    // STEP 1: Verify OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
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
      const { data: invite, error: inviteError } = await supabase
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
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingUserByEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const { data: existingUserByUsername } = await supabase
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
    
    // Default avatar if none provided (Boring Avatars - user selected variant)
    const boringAvatarUrl = `https://source.boringavatars.com/${avatarVariant}/120/${encodeURIComponent(username)}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`;
    
    const userData = {
      username,
      display_name: displayName,
      email,
      password: hashedPassword,
      recovery_key: recoveryKey,
      has_admin_privileges: false,
      is_plus_user: isPlusUser,
      branch: branch,
      current_year: currentYear,
      passout_year: passoutYear,
      specialization: specialization,
      university_roll_no: email.split('@')[0], // Entire numeric string
      profile_picture: boringAvatarUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (userError) {
      return res.status(500).json({ error: 'Failed to create user', details: userError });
    }

    // STEP 3.5: Mark Invite as Redeemed if used
    if (validInvite) {
      await supabase
        .from('invites')
        .update({
          redeemed: true,
          redeemed_by: newUser.id,
          redeemed_date: new Date().toISOString()
        })
        .eq('id', validInvite.id);
    }

    // STEP 4: Handle profile picture upload if provided (replaces boring avatar)
    let finalProfilePic = boringAvatarUrl;
    if (profilePicture && profilePicture.startsWith('data:image')) {
      try {
        const base64Data = profilePicture.split(',')[1];
        const fileExt = profilePicture.split(';')[0].split('/')[1] || 'png';
        const fileName = `${newUser.id}/profile.${fileExt}`;
        const bufferData = Buffer.from(base64Data, 'base64');
        
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('profile-pictures')
          .upload(fileName, bufferData, {
            contentType: `image/${fileExt}`,
            upsert: true
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('profile-pictures')
            .getPublicUrl(fileName);

          finalProfilePic = publicUrl;
          await supabase
            .from('users')
            .update({ profile_picture: finalProfilePic })
            .eq('id', newUser.id);
        }
      } catch (error) {
        console.error('Profile picture upload error:', error);
      }
    }

    // STEP 5: Clean up OTP
    await supabase.from('otps').delete().eq('id', otpRecord.id);

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

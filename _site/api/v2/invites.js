
const { 
  supabase, 
  supabaseAdmin,
  verifyToken, 
  getTokenFromHeaders,
  corsHeaders,
  generateRecoveryKey
} = require('./utils');

module.exports = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;
  
  console.log('Received request for path:', req.url);
  console.log('HTTP Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  try {
    // Extract action from path or query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/');
    const pathAction = pathParts[pathParts.length - 1];
    
    console.log('Path parts:', pathParts);
    console.log('Extracted pathAction:', pathAction);

    // Also check for action in the request body (for direct fetch approach)
    let bodyAction = null;
    if (req.method === 'POST' && req.body) {
      try {
        const body = req.body;
        bodyAction = body.action;
        console.log('Body action:', bodyAction);
      } catch (e) {
        console.log('Error parsing body:', e);
      }
    }
    
    // Check if the action is a valid endpoint or part of the path
    const isValidateEndpoint = pathAction === 'validate' || url.pathname.includes('/invites/validate');
    const isDiagnosticEndpoint = pathAction === 'diagnostic' || url.pathname.includes('/invites/diagnostic');
    const isToggleAdminEndpoint = pathAction === 'toggle-admin' || url.pathname.includes('/invites/toggle-admin');
    const isDeleteEndpoint = pathAction === 'delete' || url.pathname.includes('/invites/delete');
    const isSharelinkEndpoint = pathAction === 'sharelink' || url.pathname.includes('/sharelink') || bodyAction === 'sharelink';
    
    console.log('Endpoint checks:', {
      isValidateEndpoint,
      isDiagnosticEndpoint,
      isToggleAdminEndpoint,
      isDeleteEndpoint,
      isSharelinkEndpoint
    });
      // Handle special endpoints
    console.log('Checking which endpoint to use...');
    
    // Use more direct path checking for improved reliability
    if (url.pathname.indexOf('/validate') !== -1 && req.method === 'POST') {
      console.log('Using VALIDATE endpoint handler');
      return await validateInvite(req, res, origin);
    } else if (url.pathname.indexOf('/diagnostic') !== -1 && req.method === 'POST') {
      console.log('Using DIAGNOSTIC endpoint handler');
      return await diagnosticInvite(req, res, origin);
    } else if (url.pathname.indexOf('/toggle-admin') !== -1 && req.method === 'POST') {
      console.log('Using TOGGLE ADMIN endpoint handler');
      // For toggle-admin, we still need auth
      const token = getTokenFromHeaders(req.headers);
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get user and check admin privileges
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, has_admin_privileges')
        .eq('id', decoded.id)
        .single();

      if (userError || !user || !user.has_admin_privileges) {
        return res.status(403).json({ error: 'Admin privileges required' });
      }
      
      return await toggleAdmin(req, res, origin, user.id);
    } else if (url.pathname.indexOf('/toggle-plus') !== -1 && req.method === 'POST') {
      console.log('Using TOGGLE PLUS USER endpoint handler');
      // For toggle-plus, we need auth and admin privileges
      const token = getTokenFromHeaders(req.headers);
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get user and check admin privileges
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, has_admin_privileges')
        .eq('id', decoded.id)
        .single();

      if (userError || !user || !user.has_admin_privileges) {
        return res.status(403).json({ error: 'Admin privileges required' });
      }
      
      return await togglePlusUser(req, res, origin, user.id);
    } else if (isSharelinkEndpoint) {
      console.log('Using SHARELINK endpoint handler');
      console.log('Path:', url.pathname);
      console.log('Body:', req.body);
      console.log('Headers:', JSON.stringify(req.headers));
      // For sharelink, we need auth and admin privileges
      const token = getTokenFromHeaders(req.headers);
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get user and check admin privileges
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, has_admin_privileges')
        .eq('id', decoded.id)
        .single();

      if (userError || !user || !user.has_admin_privileges) {
        return res.status(403).json({ error: 'Admin privileges required' });
      }
      
      return await createSharelink(req, res, origin, user.id);
    } else if (isDeleteEndpoint && req.method === 'POST') {
      // For delete endpoint, we also need auth
      const token = getTokenFromHeaders(req.headers);
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get user and check admin privileges
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, has_admin_privileges')
        .eq('id', decoded.id)
        .single();

      if (userError || !user || !user.has_admin_privileges) {
        return res.status(403).json({ error: 'Admin privileges required' });
      }
      
      return await deleteInvite(req, res, origin, user.id);
    }
    
    // For all other actions, require authentication
    const token = getTokenFromHeaders(req.headers);
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user and check admin privileges
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, has_admin_privileges')
      .eq('id', decoded.id)
      .single();

    if (userError || !user || !user.has_admin_privileges) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }    // Process authenticated and admin-required actions
    if (req.method === 'POST') {
      return await createInvite(user.id, origin, req.body, res);
    } else if (req.method === 'GET') {
      return await getInvites(user.id, origin, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Invite API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Original invites.js functions
async function createInvite(userId, origin, requestBody = null, res) {
  try {
    // Parse request body if provided
    let containsPlusPerks = false;
    if (requestBody) {
      containsPlusPerks = !!requestBody.containsPlusPerks;
    }

    // Generate invite code similar to recovery key format
    const inviteCode = generateRecoveryKey();
    
    // Insert invite into database
    const { data: invite, error } = await supabase
      .from('invites')
      .insert({
        code: inviteCode,
        created_by: userId,
        contains_plus_perks: containsPlusPerks
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create invite', details: error });
    }

    return res.status(201).json({
      message: 'Invite created successfully',
      invite: {
        id: invite.id,
        code: invite.code,
        created_at: invite.created_at,
        expires_at: invite.expires_at,
        contains_plus_perks: invite.contains_plus_perks
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create invite', details: error.message });
  }
}

async function getInvites(userId, origin, res) {
  try {
    // Get all invites created by this admin user
    const { data: invites, error } = await supabase
      .from('invites')
      .select(`
        id,
        code,
        redeemed,
        redeemed_by,
        redeemed_date,
        created_at,
        expires_at,
        contains_plus_perks,
        redeemed_user:users!redeemed_by(id, username, display_name, has_admin_privileges, is_plus_user, profile_picture)
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch invites', details: error });
    }

    return res.status(200).json({
      invites: invites || []
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch invites', details: error.message });
  }
}

// From invites-validate.js
async function validateInvite(req, res, origin) {
  try {
    const { inviteCode } = req.body;
    
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }
      // Get the invite data - using admin client for reliability
    // Use case-insensitive comparison to handle URL normalization
    const { data: invite, error } = await supabase
      .from('invites')
      .select('id, code, redeemed, expires_at, created_at, contains_plus_perks')
      .ilike('code', inviteCode)
      .single();
      
    if (error || !invite) {
      console.log('Invite lookup failed:', { error, inviteCode });
      return res.status(200).json({ 
        valid: false, 
        message: 'Invalid invite code' 
      });
    }

    console.log('Invite found:', invite);

    // Check if invite is already redeemed
    if (invite.redeemed) {
      return res.status(200).json({ 
        valid: false, 
        message: 'Invite code has already been used' 
      });
    }

    // Check if invite is expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    
    if (now > expiresAt) {
      return res.status(200).json({ 
        valid: false, 
        message: 'Invite code has expired' 
      });
    }
    
    // Invite is valid
    console.log('Invite validation successful:', {
      inviteId: invite.id,
      inviteCode: invite.code,
      redeemed: invite.redeemed,
      expiresAt: invite.expires_at
    });

    return res.status(200).json({ 
      valid: true, 
      message: 'Invite code is valid',
      inviteId: invite.id
    });
  } catch (error) {
    console.error('Invite validation error:', error);
    return res.status(500).json({ 
      valid: false, 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

// From invite-diagnostic.js
async function diagnosticInvite(req, res, origin) {
  try {
    const { inviteCode } = req.body;
    
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }    // Get detailed invite information
    const { data: invite, error } = await supabase
      .from('invites')
      .select('*')
      .ilike('code', inviteCode)
      .single();

    if (error) {
      return res.status(200).json({ 
        found: false,
        error: error.message,
        code: inviteCode
      });
    }    // Check if reservation columns exist by trying to get them
    const { data: inviteWithReservation, error: reservationError } = await supabase
      .from('invites')
      .select('id, code, redeemed, expires_at, created_at, reserved_at, reserved_until, contains_plus_perks')
      .ilike('code', inviteCode)
      .single();

    const hasReservationColumns = !reservationError;

    // Get table schema info
    const { data: schema, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'invites')
      .order('ordinal_position');

    return res.status(200).json({
      found: true,
      inviteData: invite,
      inviteWithReservation: inviteWithReservation,
      hasReservationColumns,
      reservationError: reservationError?.message,
      schema: schema || [],
      schemaError: schemaError?.message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

// From toggle-admin.js
async function toggleAdmin(req, res, origin, adminUserId) {
  try {
    // Parse request body
    const { userId, hasAdminPrivileges } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Update user admin privileges
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ has_admin_privileges: hasAdminPrivileges })
      .eq('id', userId)
      .select('id, username, display_name, has_admin_privileges, is_plus_user')
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update user privileges', details: updateError });
    }

    return res.status(200).json({
      message: 'User privileges updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Toggle admin API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// Toggle plus user privileges
// From toggle-plus-user.js
async function togglePlusUser(req, res, origin, adminUserId) {
  try {
    // Parse request body
    const { userId, isPlusUser } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Update user plus status
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ is_plus_user: isPlusUser })
      .eq('id', userId)
      .select('id, username, display_name, has_admin_privileges, is_plus_user')
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update user status', details: updateError });
    }

    return res.status(200).json({
      message: 'User status updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Toggle plus user API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// Delete invite code
// From delete-invite.js
async function deleteInvite(req, res, origin, adminUserId) {
  try {
    // Parse request body
    const { inviteId } = req.body;
    
    if (!inviteId) {
      return res.status(400).json({ error: 'Invite ID is required' });
    }

    // Delete invite
    const { error: deleteError } = await supabase
      .from('invites')
      .delete()
      .eq('id', inviteId);

    if (deleteError) {
      return res.status(500).json({ error: 'Failed to delete invite', details: deleteError });
    }

    return res.status(200).json({ message: 'Invite deleted successfully' });
  } catch (error) {
    console.error('Delete invite API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// Create shareable link for invite
async function createSharelink(req, res, origin, userId) {
  try {
    // Parse request body and extract parameters
    const bodyData = req.body;
    
    // Support both direct parameters and nested action format
    let inviteCode, customHeading;
    
    if (bodyData.action === 'sharelink') {
      // New format with action field
      inviteCode = bodyData.inviteCode;
      customHeading = bodyData.customHeading;
    } else {
      // Original format
      inviteCode = bodyData.inviteCode;
      customHeading = bodyData.customHeading;
    }
    
    console.log('Parsed sharelink data:', { inviteCode, customHeading });
    
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Verify that the invite exists and belongs to this user
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('id, code, created_by, contains_plus_perks')
      .eq('code', inviteCode)
      .eq('created_by', userId)
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({ error: 'Invite not found or access denied' });
    }

    // Create the sharelink record
    const { data: sharelink, error: sharelinkError } = await supabase
      .from('sharelinks')
      .upsert({
        invite_code: inviteCode,
        custom_heading: customHeading || null,
        created_by: userId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'invite_code'
      })
      .select()
      .single();

    if (sharelinkError) {
      return res.status(500).json({ error: 'Failed to create sharelink', details: sharelinkError });
    }

    // Determine the base URL based on the environment
    const isLocalhost = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'));
    const baseUrl = isLocalhost ? origin : 'https://materioa.netlify.app';

    // Return the sharelink data
    return res.status(200).json({
      message: 'Sharelink created successfully',
      sharelink: {
        inviteCode: sharelink.invite_code,
        customHeading: sharelink.custom_heading,
        url: `${baseUrl}/invites/${sharelink.invite_code}`,
        createdAt: sharelink.created_at,
        updatedAt: sharelink.updated_at
      }
    });
  } catch (error) {
    console.error('Create sharelink error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

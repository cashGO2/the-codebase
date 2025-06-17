
const { 
  supabase, 
  supabaseAdmin,
  verifyToken, 
  getTokenFromHeaders,
  corsHeaders,
  generateRecoveryKey
} = require('./utils');

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin;
  
  console.log('Received request for path:', event.path);
  console.log('HTTP Method:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers));
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: ''
    };
  }  try {
    // Extract action from path or query parameters
    const pathParts = event.path.split('/');
    const pathAction = pathParts[pathParts.length - 1];
    
    console.log('Path parts:', pathParts);
    console.log('Extracted pathAction:', pathAction);
    
    // Check if the action is a valid endpoint or part of the path
    const isValidateEndpoint = pathAction === 'validate' || event.path.includes('/invites/validate');
    const isDiagnosticEndpoint = pathAction === 'diagnostic' || event.path.includes('/invites/diagnostic');
    const isToggleAdminEndpoint = pathAction === 'toggle-admin' || event.path.includes('/invites/toggle-admin');
    const isDeleteEndpoint = pathAction === 'delete' || event.path.includes('/invites/delete');
    
    console.log('Endpoint checks:', {
      isValidateEndpoint,
      isDiagnosticEndpoint,
      isToggleAdminEndpoint,
      isDeleteEndpoint
    });
      // Handle special endpoints
    console.log('Checking which endpoint to use...');
    
    // Use more direct path checking for improved reliability
    if (event.path.indexOf('/validate') !== -1 && event.httpMethod === 'POST') {
      console.log('Using VALIDATE endpoint handler');
      return await validateInvite(event, origin);
    } else if (event.path.indexOf('/diagnostic') !== -1 && event.httpMethod === 'POST') {
      console.log('Using DIAGNOSTIC endpoint handler');
      return await diagnosticInvite(event, origin);
    } else if (event.path.indexOf('/toggle-admin') !== -1 && event.httpMethod === 'POST') {
      console.log('Using TOGGLE ADMIN endpoint handler');
      // For toggle-admin, we still need auth
      const token = getTokenFromHeaders(event.headers);
      
      if (!token) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Authentication required' })
        };
      }

      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid token' })
        };
      }

      // Get user and check admin privileges
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, has_admin_privileges')
        .eq('id', decoded.id)
        .single();

      if (userError || !user || !user.has_admin_privileges) {
        return {
          statusCode: 403,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Admin privileges required' })
        };
      }
      
      return await toggleAdmin(event, origin, user.id);
    } else if (isDeleteEndpoint && event.httpMethod === 'POST') {
      // For delete endpoint, we also need auth
      const token = getTokenFromHeaders(event.headers);
      
      if (!token) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Authentication required' })
        };
      }

      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid token' })
        };
      }

      // Get user and check admin privileges
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, has_admin_privileges')
        .eq('id', decoded.id)
        .single();

      if (userError || !user || !user.has_admin_privileges) {
        return {
          statusCode: 403,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Admin privileges required' })
        };
      }
      
      return await deleteInvite(event, origin, user.id);
    }
    
    // For all other actions, require authentication
    const token = getTokenFromHeaders(event.headers);
    
    if (!token) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    // Get user and check admin privileges
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, has_admin_privileges')
      .eq('id', decoded.id)
      .single();

    if (userError || !user || !user.has_admin_privileges) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Admin privileges required' })
      };
    }    // Process authenticated and admin-required actions
    if (event.httpMethod === 'POST') {
      return await createInvite(user.id, origin);
    } else if (event.httpMethod === 'GET') {
      return await getInvites(user.id, origin);
    } else {
      return {
        statusCode: 405,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }
  } catch (error) {
    console.error('Invite API error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

// Original invites.js functions
async function createInvite(userId, origin) {
  try {
    // Generate invite code similar to recovery key format
    const inviteCode = generateRecoveryKey();
    
    // Insert invite into database
    const { data: invite, error } = await supabase
      .from('invites')
      .insert({
        code: inviteCode,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to create invite', details: error })
      };
    }

    return {
      statusCode: 201,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Invite created successfully',
        invite: {
          id: invite.id,
          code: invite.code,
          created_at: invite.created_at,
          expires_at: invite.expires_at
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to create invite', details: error.message })
    };
  }
}

async function getInvites(userId, origin) {
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
        redeemed_user:users!redeemed_by(id, username, display_name, has_admin_privileges)
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to fetch invites', details: error })
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invites: invites || []
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch invites', details: error.message })
    };
  }
}

// From invites-validate.js
async function validateInvite(event, origin) {
  try {
    const { inviteCode } = JSON.parse(event.body);
    
    if (!inviteCode) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invite code is required' })
      };
    }
      // Get the invite data - using admin client for reliability
    const { data: invite, error } = await supabase
      .from('invites')
      .select('id, code, redeemed, expires_at, created_at')
      .eq('code', inviteCode)
      .single();
      
    if (error || !invite) {
      console.log('Invite lookup failed:', { error, inviteCode });
      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          valid: false, 
          message: 'Invalid invite code' 
        })
      };
    }

    console.log('Invite found:', invite);

    // Check if invite is already redeemed
    if (invite.redeemed) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          valid: false, 
          message: 'Invite code has already been used' 
        })
      };
    }

    // Check if invite is expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    
    if (now > expiresAt) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          valid: false, 
          message: 'Invite code has expired' 
        })
      };
    }
    
    // Invite is valid
    console.log('Invite validation successful:', {
      inviteId: invite.id,
      inviteCode: invite.code,
      redeemed: invite.redeemed,
      expiresAt: invite.expires_at
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        valid: true, 
        message: 'Invite code is valid',
        inviteId: invite.id
      })
    };
  } catch (error) {
    console.error('Invite validation error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        valid: false, 
        error: 'Internal server error', 
        details: error.message 
      })
    };
  }
}

// From invite-diagnostic.js
async function diagnosticInvite(event, origin) {
  try {
    const { inviteCode } = JSON.parse(event.body);
    
    if (!inviteCode) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invite code is required' })
      };
    }    // Get detailed invite information
    const { data: invite, error } = await supabase
      .from('invites')
      .select('*')
      .eq('code', inviteCode)
      .single();

    if (error) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          found: false,
          error: error.message,
          code: inviteCode
        })
      };
    }    // Check if reservation columns exist by trying to get them
    const { data: inviteWithReservation, error: reservationError } = await supabase
      .from('invites')
      .select('id, code, redeemed, expires_at, created_at, reserved_at, reserved_until')
      .eq('code', inviteCode)
      .single();

    const hasReservationColumns = !reservationError;

    // Get table schema info
    const { data: schema, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'invites')
      .order('ordinal_position');

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        found: true,
        inviteData: invite,
        inviteWithReservation: inviteWithReservation,
        hasReservationColumns,
        reservationError: reservationError?.message,
        schema: schema || [],
        schemaError: schemaError?.message,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Diagnostic error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      })
    };
  }
}

// From toggle-admin.js
async function toggleAdmin(event, origin, adminUserId) {
  try {
    // Parse request body
    const { userId, hasAdminPrivileges } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    // Update user admin privileges
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ has_admin_privileges: hasAdminPrivileges })
      .eq('id', userId)
      .select('id, username, display_name, has_admin_privileges')
      .single();

    if (updateError) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to update user privileges', details: updateError })
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'User privileges updated successfully',
        user: updatedUser
      })
    };
  } catch (error) {
    console.error('Toggle admin API error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}

// Delete invite code
async function deleteInvite(event, origin, adminUserId) {
  try {
    console.log('Delete invite API called by admin:', adminUserId);
    console.log('Event body:', event.body);
    
    const { inviteId } = JSON.parse(event.body);
    console.log('Invite ID to delete:', inviteId);
    
    if (!inviteId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invite ID is required' })
      };
    }      // First, verify the invite exists and belongs to the admin user
    const { data: invite, error: getError } = await supabase
      .from('invites')
      .select('id, code, redeemed, created_by, expires_at')
      .eq('id', inviteId)
      .single();
    
    if (getError || !invite) {
      console.error('Invite lookup error:', getError);
      return {
        statusCode: 404,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invite not found' })
      };
    }
    
    console.log('Found invite:', invite);
    
    // Verify the invite belongs to this admin
    if (invite.created_by !== adminUserId) {
      console.error('Invite ownership mismatch:', {
        inviteCreatedBy: invite.created_by,
        requestingAdmin: adminUserId
      });
      return {
        statusCode: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'You can only delete your own invites' })
      };
    }
    
    // Verify the invite is not used (redeemed)
    if (invite.redeemed) {
      console.error('Cannot delete redeemed invite:', invite.id);
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Cannot delete a used invite code' })
      };
    }    // Delete the invite - using raw SQL with the admin client to bypass RLS
    console.log('Attempting to delete invite with ID:', inviteId, 'using direct SQL');
    
    try {      // Using direct SQL to delete the record (bypasses RLS)
      const { data: sqlResult, error: sqlError } = await supabase.rpc(
        'execute_sql', 
        { 
          query: `DELETE FROM invites WHERE id = '${inviteId}' RETURNING id, code;` 
        }
      );
      
      console.log('SQL Delete result:', { sqlResult, sqlError });
      
      if (sqlError) {
        console.error('SQL delete failed:', sqlError);
        // Fall back to normal delete method
        console.log('Falling back to normal delete method');
      } else if (sqlResult && sqlResult.length > 0) {
        console.log('Successfully deleted invite using SQL');
        return {
          statusCode: 200,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Invite deleted successfully (SQL method)',
            inviteId: inviteId
          })
        };
      }
    } catch (sqlExecutionError) {
      console.error('Error executing SQL delete:', sqlExecutionError);
      // Continue with normal delete method
      console.log('Continuing with normal delete method after SQL error');
    }
      // Try standard delete method if SQL approach failed
    console.log('Attempting standard delete method');
    const { data: deletedInvite, error: deleteError } = await supabase
      .from('invites')
      .delete()
      .eq('id', inviteId)
      .select();
    
    console.log('Delete operation result:', { 
      deletedInvite, 
      deleteError,
      deletedCount: deletedInvite ? deletedInvite.length : 0,
      client: 'admin'
    });
    
    if (deleteError) {
      console.error('Delete operation failed:', deleteError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to delete invite', details: deleteError })
      };
    }
    
    if (!deletedInvite || deletedInvite.length === 0) {      console.error('Delete operation did not return deleted record');
      // Try to verify if the invite was actually deleted despite not returning data
      const { data: checkInvite, error: checkError } = await supabase
        .from('invites')
        .select('id')
        .eq('id', inviteId)
        .single();
      
      console.log('Verification check result:', { checkInvite, checkError, client: 'admin' });

      if (!checkInvite) {
        console.log('Verified invite was deleted even though no data was returned');
        // The invite was deleted even though .select() didn't return data
        return {
          statusCode: 200,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Invite deleted successfully',
            inviteId: inviteId
          })
        };      } else {
        console.error('Invite still exists after delete operation');
          // Try one more time with explicit RLS bypass
        console.log('Attempting forced delete with RLS bypass...');
        
        const { error: forcedDeleteError } = await supabase
          .from('invites')
          .delete()
          .eq('id', inviteId);
          
        console.log('Forced delete result:', { forcedDeleteError });
        
        // Check if invite exists after forced delete
        const { data: checkAfterForce } = await supabase
          .from('invites')
          .select('id')
          .eq('id', inviteId)
          .single();
          
        if (!checkAfterForce) {
          console.log('Invite successfully deleted after force delete');
          return {
            statusCode: 200,
            headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'Invite deleted successfully (force delete)',
              inviteId: inviteId
            })
          };
        }
        
        return {
          statusCode: 500,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'Failed to delete invite: Record still exists after multiple attempts',
            details: 'Possible database permission issue or constraint violation'
          })
        };
      }
    }
    
    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Invite deleted successfully',
        inviteId: inviteId,
        deletedInvite: deletedInvite[0]
      })
    };
  } catch (error) {
    console.error('Delete invite error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}

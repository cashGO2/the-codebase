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

  // Parse body data to determine if it is an OAuth token request
  let bodyData = req.body || {};
  if (Buffer.isBuffer(req.body)) {
    try {
      const bodyStr = req.body.toString('utf8');
      try {
        bodyData = JSON.parse(bodyStr);
      } catch (jsonErr) {
        bodyData = Object.fromEntries(new URLSearchParams(bodyStr));
      }
    } catch (e) {}
  } else if (typeof req.body === 'string') {
    try {
      bodyData = JSON.parse(req.body);
    } catch (e) {
      try {
        bodyData = Object.fromEntries(new URLSearchParams(req.body));
      } catch (err) {}
    }
  }

  let action = req.query.action || bodyData.action;

  // Auto-detect OAuth Token exchange standard requests if action is not specified
  if (!action && req.method === 'POST') {
    const grantType = bodyData.grant_type || req.query.grant_type;
    if (grantType === 'authorization_code' || grantType === 'refresh_token') {
      action = 'oauth_token';
    }
  }

  // Method restrictions
  const isOauthGet = (action === 'oauth_list_apps' || action === 'oauth_client_info' || action === 'fetch_url_title') && req.method === 'GET';
  if (req.method !== 'POST' && !isOauthGet) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (action === 'forgot-password') {
    return handleForgotPassword(req, res);
  } else if (action === 'admin-recovery') {
    return handleAdminRecovery(req, res);
  } else if (action === 'otp') {
    return handleOTP(req, res);
  } else if (action === 'oauth_list_apps') {
    return handleOAuthListApps(req, res);
  } else if (action === 'oauth_register_app') {
    return handleOAuthRegisterApp(req, res);
  } else if (action === 'oauth_delete_app') {
    return handleOAuthDeleteApp(req, res);
  } else if (action === 'oauth_client_info') {
    return handleOAuthClientInfo(req, res);
  } else if (action === 'fetch_url_title') {
    return handleFetchUrlTitle(req, res);
  } else if (action === 'oauth_authorize') {
    return handleOAuthAuthorize(req, res);
  } else if (action === 'oauth_token') {
    return handleOAuthToken(req, res);
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

// ==========================================
// OAuth Helpers & Handlers
// ==========================================

async function getAuthedUser(req, res) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    res.status(401).json({ error: 'Authentication token required' });
    return null;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', decoded.id)
    .single();

  if (error || !user) {
    res.status(401).json({ error: 'User not found' });
    return null;
  }
  return user;
}

async function handleOAuthListApps(req, res) {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const { data: apps, error } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    return res.status(200).json({ apps: apps || [] });
  } catch (error) {
    console.error('oauth_list_apps error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleOAuthRegisterApp(req, res) {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const { name, redirectUri } = req.body || {};

    if (!name || !redirectUri) {
      return res.status(400).json({ error: 'Application name and redirect URI are required' });
    }

    const crypto = require('crypto');
    const clientId = 'client_' + crypto.randomBytes(8).toString('hex');
    const clientSecret = 'secret_' + crypto.randomBytes(16).toString('hex');

    const { data: app, error } = await supabaseAdmin
      .from('oauth_apps')
      .insert({
        client_id: clientId,
        client_secret: clientSecret,
        name,
        redirect_uri: redirectUri,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to register application', details: error.message });
    }

    return res.status(200).json({ success: true, app });
  } catch (error) {
    console.error('oauth_register_app error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleOAuthDeleteApp(req, res) {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const { clientId } = req.body || {};

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const { error } = await supabaseAdmin
      .from('oauth_apps')
      .delete()
      .eq('client_id', clientId)
      .eq('user_id', user.id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete application', details: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('oauth_delete_app error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleOAuthClientInfo(req, res) {
  try {
    const clientId = req.query.client_id || (req.body && req.body.client_id);

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const { data: app, error } = await supabaseAdmin
      .from('oauth_apps')
      .select('client_id, name, redirect_uri')
      .eq('client_id', clientId)
      .single();

    if (error || !app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    return res.status(200).json({
      client_id: app.client_id,
      name: app.name,
      redirect_uri: app.redirect_uri
    });
  } catch (error) {
    console.error('oauth_client_info error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleOAuthAuthorize(req, res) {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const { client_id, redirect_uri, code_challenge, code_challenge_method } = req.body || {};

    if (!client_id || !redirect_uri) {
      return res.status(400).json({ error: 'Client ID and Redirect URI are required' });
    }

    // Verify client and redirect_uri
    const { data: app, error } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('client_id', client_id)
      .single();

    if (error || !app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (app.redirect_uri !== redirect_uri) {
      return res.status(400).json({ error: 'Redirect URI mismatch' });
    }

    const crypto = require('crypto');
    const randomPart = crypto.randomBytes(16).toString('hex');
    let code = 'code_' + randomPart;
    if (code_challenge) {
      const pkceData = {
        r: randomPart,
        c: code_challenge,
        m: code_challenge_method || 'plain'
      };
      code = 'pkce_' + Buffer.from(JSON.stringify(pkceData)).toString('base64url');
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    const { error: insertError } = await supabaseAdmin
      .from('oauth_codes')
      .insert({
        code,
        client_id,
        user_id: user.id,
        redirect_uri,
        token: generateToken(user),
        expires_at: expiresAt
      });

    if (insertError) {
      return res.status(500).json({ error: 'Failed to generate authorization code', details: insertError.message });
    }

    return res.status(200).json({ success: true, code });
  } catch (error) {
    console.error('oauth_authorize error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleOAuthToken(req, res) {
  try {
    // RFC 6749 Section 5.1/5.2 requires no-store headers for all token responses
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    // Handle application/x-www-form-urlencoded if req.body is a string
    let bodyData = req.body || {};
    if (Buffer.isBuffer(req.body)) {
      req.body = req.body.toString('utf8');
    }
    if (typeof req.body === 'string') {
      try {
        bodyData = JSON.parse(req.body);
      } catch (e) {
        bodyData = Object.fromEntries(new URLSearchParams(req.body));
      }
    }

    // Resolve parameters from body or query string
    let client_id = bodyData.client_id || req.query.client_id;
    let client_secret = bodyData.client_secret || req.query.client_secret;
    let code = bodyData.code || req.query.code;
    let redirect_uri = bodyData.redirect_uri || req.query.redirect_uri;
    let grant_type = bodyData.grant_type || req.query.grant_type;
    let refresh_token = bodyData.refresh_token || req.query.refresh_token;

    // Check Authorization header for Basic Auth (Standard OAuth2 Client Auth)
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (authHeader.toLowerCase().startsWith('basic ')) {
      const b64auth = authHeader.substring(6).trim();
      const decodedStr = Buffer.from(b64auth, 'base64').toString();
      const firstColon = decodedStr.indexOf(':');
      if (firstColon !== -1) {
        const user = decodeURIComponent(decodedStr.substring(0, firstColon));
        const pass = decodeURIComponent(decodedStr.substring(firstColon + 1));
        if (!client_id) client_id = user;
        if (!client_secret) client_secret = pass;
      }
    }

    if (!client_id) {
      return res.status(400).json({ error: 'Client ID is required' });
    }
    // Parse PKCE code if present to see if we can bypass the client_secret check
    let expectedChallenge = null;
    let challengeMethod = null;
    if (grant_type === 'authorization_code' && code && code.startsWith('pkce_')) {
      try {
        const pkceStr = Buffer.from(code.substring(5), 'base64url').toString('utf8');
        const pkceData = JSON.parse(pkceStr);
        expectedChallenge = pkceData.c;
        challengeMethod = pkceData.m;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid authorization code format' });
      }
    }

    // Verify client
    const { data: app, error: appError } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('client_id', client_id)
      .single();

    if (appError || !app) {
      return res.status(401).json({ error: 'Invalid client credentials' });
    }

    // Only require client_secret if PKCE is NOT used
    if (!expectedChallenge && app.client_secret && app.client_secret !== client_secret) {
      return res.status(401).json({ error: 'Invalid client credentials' });
    }

    let tokenToReturn = null;
    let userIdToFetch = null;

    if (grant_type === 'authorization_code') {
      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }

      // If PKCE is used, verify code_verifier against the challenge
      if (expectedChallenge) {
        const code_verifier = bodyData.code_verifier || req.query.code_verifier;
        if (!code_verifier) {
          return res.status(400).json({ error: 'code_verifier is required for PKCE flow' });
        }

        const crypto = require('crypto');
        let calculatedChallenge = '';
        if (challengeMethod === 'S256') {
          calculatedChallenge = crypto
            .createHash('sha256')
            .update(code_verifier)
            .digest('base64url');
        } else {
          calculatedChallenge = code_verifier;
        }

        if (calculatedChallenge !== expectedChallenge) {
          return res.status(400).json({ error: 'Invalid code_verifier' });
        }
      }

      // Consume the code
      const { data: codeRecord, error: codeError } = await supabaseAdmin
        .from('oauth_codes')
        .delete()
        .eq('code', code)
        .eq('client_id', client_id)
        .gt('expires_at', new Date().toISOString())
        .select()
        .single();

      if (codeError || !codeRecord) {
        return res.status(400).json({ error: 'Invalid or expired authorization code' });
      }

      if (redirect_uri && codeRecord.redirect_uri !== redirect_uri) {
        return res.status(400).json({ error: 'Redirect URI mismatch' });
      }

      tokenToReturn = codeRecord.token;
      userIdToFetch = codeRecord.user_id;
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const decoded = verifyToken(refresh_token);
      if (!decoded) {
        return res.status(400).json({ error: 'Invalid or expired refresh token' });
      }

      userIdToFetch = decoded.id;
    } else {
      return res.status(400).json({ error: 'Unsupported grant type. Only authorization_code and refresh_token are supported.' });
    }

    // Fetch user details
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, has_admin_privileges, is_plus_user, is_lite_user, profile_picture')
      .eq('id', userIdToFetch)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (grant_type === 'refresh_token') {
      tokenToReturn = generateToken(user);
    }


    return res.status(200).json({
      access_token: tokenToReturn,
      token_type: 'Bearer',
      expires_in: 86400,
      refresh_token: tokenToReturn,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        hasAdminPrivileges: user.has_admin_privileges,
        isPlusUser: user.is_plus_user,
        isLiteUser: user.is_lite_user,
        profilePicture: user.profile_picture
      }
    });
  } catch (error) {
    console.error('oauth_token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleFetchUrlTitle(req, res) {
  try {
    const urlStr = req.query.url;
    if (!urlStr) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Basic URL validation
    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // SSRF prevention: do not fetch local/private IP addresses or loopbacks
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.')
    ) {
      let host = hostname;
      const dotIdx = host.indexOf('.');
      const derived = dotIdx > 0 ? host.substring(0, dotIdx) : host;
      return res.status(200).json({ title: derived.charAt(0).toUpperCase() + derived.slice(1), icon: '' });
    }

    // Fetch site title with a 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Failed to fetch site');
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : '';

    if (title) {
      // Decode HTML entities
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    }

    if (!title) {
      // Fallback: derive friendly title from domain name
      let host = parsedUrl.hostname;
      if (host.startsWith('www.')) host = host.substring(4);
      const dotIdx = host.indexOf('.');
      const derived = dotIdx > 0 ? host.substring(0, dotIdx) : host;
      title = derived.charAt(0).toUpperCase() + derived.slice(1);
    }

    // Search for custom icon link in the fetched HTML
    let iconUrl = '';
    const linkMatches = html.match(/<link[^>]+>/gi) || [];
    for (const linkTag of linkMatches) {
      const relMatch = linkTag.match(/rel\s*=\s*["']([^"']*icon[^"']*)["']/i);
      if (relMatch) {
        const hrefMatch = linkTag.match(/href\s*=\s*["']([^"']+)["']/i);
        if (hrefMatch) {
          const href = hrefMatch[1];
          try {
            iconUrl = new URL(href, urlStr).href;
            break; // take the first icon link found
          } catch (e) {
            // Ignore resolve error
          }
        }
      }
    }

    return res.status(200).json({ title, icon: iconUrl });
  } catch (error) {
    // Graceful fallback to capitalized hostname on error/timeout
    try {
      const parsedUrl = new URL(req.query.url);
      let host = parsedUrl.hostname;
      if (host.startsWith('www.')) host = host.substring(4);
      const dotIdx = host.indexOf('.');
      const derived = dotIdx > 0 ? host.substring(0, dotIdx) : host;
      const fallbackTitle = derived.charAt(0).toUpperCase() + derived.slice(1);
      return res.status(200).json({ title: fallbackTitle, icon: '' });
    } catch (e) {
      return res.status(200).json({ title: 'External Application', icon: '' });
    }
  }
}

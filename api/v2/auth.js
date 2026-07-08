const {
  supabase,
  supabaseAdmin,
  hashPassword,
  generateToken,
  generateIdToken,
  getJwks,
  generateOpaqueToken,
  hashToken,
  verifyToken,
  getTokenFromHeaders,
  corsHeaders,
  addCorsHeaders
} = require('./_utils');
const { sendOTPEmail } = require('../_utils_shared/mailer');
const { getOTPTemplate } = require('../_utils_shared/otp_template');
const cors = require('./cors');
const crypto = require('crypto');
const DEFAULT_ISSUER = 'https://getmaterio.app';
const DEFAULT_SCOPES = 'openid profile email admin';

function getIssuer(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return process.env.OAUTH_ISSUER || (host ? `${proto}://${host}` : DEFAULT_ISSUER);
}

function getAuthBaseUrl(req) {
  return process.env.OAUTH_PUBLIC_BASE_URL || getIssuer(req);
}

function normalizeScope(scope) {
  const requested = String(scope || '').split(/\s+/).filter(Boolean);
  const unique = [...new Set(requested.length ? requested : ['admin'])];
  return unique.join(' ');
}

function hasScope(scope, value) {
  return String(scope || '').split(/\s+/).includes(value);
}

function oauthError(res, status, error, description) {
  const payload = { error };
  if (description) payload.error_description = description;
  return res.status(status).json(payload);
}

function oauthRedirectError(res, redirectUri, error, description, state) {
  try {
    const target = new URL(redirectUri);
    target.searchParams.set('error', error);
    if (description) target.searchParams.set('error_description', description);
    if (state) target.searchParams.set('state', state);
    return res.redirect(302, target.toString());
  } catch (e) {
    return oauthError(res, 400, error, description);
  }
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function getClientRedirectUris(app) {
  const uris = parseJsonArray(app?.redirect_uris, []);
  if (app?.redirect_uri && !uris.includes(app.redirect_uri)) uris.push(app.redirect_uri);
  return uris;
}

function isRedirectUriAllowed(app, redirectUri) {
  const uris = getClientRedirectUris(app);
  return uris.length === 0 ? false : uris.includes(redirectUri);
}

function getBasicClientCredentials(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.toLowerCase().startsWith('basic ')) return {};
  const decodedStr = Buffer.from(authHeader.substring(6).trim(), 'base64').toString();
  const firstColon = decodedStr.indexOf(':');
  if (firstColon === -1) return {};
  return {
    client_id: decodeURIComponent(decodedStr.substring(0, firstColon)),
    client_secret: decodeURIComponent(decodedStr.substring(firstColon + 1))
  };
}

async function isTokenRevoked(token) {
  if (!token) return false;
  const { data } = await supabaseAdmin
    .from('oauth_revoked_tokens')
    .select('token_hash')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  return Boolean(data);
}

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
  const isOauthGet = (action === 'oauth_list_apps' || action === 'oauth_client_info' || action === 'fetch_url_title' || action === 'oauth_metadata' || action === 'oidc_metadata' || action === 'jwks' || action === 'userinfo') && req.method === 'GET';
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
  } else if (action === 'oauth_metadata' || action === 'oidc_metadata') {
    return handleOAuthMetadata(req, res, action === 'oidc_metadata');
  } else if (action === 'jwks') {
    return handleJwks(req, res);
  } else if (action === 'userinfo') {
    return handleUserInfo(req, res);
  } else if (action === 'oauth_revoke') {
    return handleOAuthRevoke(req, res);
  } else if (action === 'oauth_introspect') {
    return handleOAuthIntrospect(req, res);
  } else if (action === 'logout') {
    return handleLogout(req, res);
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }
};

async function handleOAuthMetadata(req, res, oidc = false) {
  const issuer = getIssuer(req);
  const baseUrl = getAuthBaseUrl(req);
  const metadata = {
    issuer,
    authorization_endpoint: `${baseUrl}/account/sso`,
    token_endpoint: `${baseUrl}/api/v2/auth`,
    jwks_uri: `${baseUrl}/api/v2/auth?action=jwks`,
    registration_endpoint: `${baseUrl}/api/v2/auth?action=oauth_register_app`,
    revocation_endpoint: `${baseUrl}/api/v2/auth?action=oauth_revoke`,
    introspection_endpoint: `${baseUrl}/api/v2/auth?action=oauth_introspect`,
    userinfo_endpoint: `${baseUrl}/api/v2/auth?action=userinfo`,
    end_session_endpoint: `${baseUrl}/api/v2/auth?action=logout`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: DEFAULT_SCOPES.split(' '),
    claims_supported: ['sub', 'email', 'email_verified', 'preferred_username', 'name', 'picture', 'auth_time'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [process.env.OIDC_PRIVATE_KEY || process.env.OIDC_PRIVATE_KEY_B64 ? 'RS256' : 'HS256']
  };

  if (!oidc) {
    delete metadata.claims_supported;
    delete metadata.subject_types_supported;
    delete metadata.id_token_signing_alg_values_supported;
  }

  return res.status(200).json(metadata);
}

async function handleJwks(req, res) {
  return res.status(200).json(getJwks());
}

async function handleUserInfo(req, res) {
  try {
    const token = getTokenFromHeaders(req.headers);
    if (!token) return oauthError(res, 401, 'invalid_token', 'Bearer token is required');
    if (await isTokenRevoked(token)) return oauthError(res, 401, 'invalid_token', 'Token has been revoked');

    const decoded = verifyToken(token);
    if (!decoded) return oauthError(res, 401, 'invalid_token', 'Token is invalid or expired');

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, profile_picture')
      .eq('id', decoded.id || decoded.sub)
      .single();

    if (error || !user) return oauthError(res, 404, 'invalid_token', 'User not found');

    return res.status(200).json({
      sub: String(user.id),
      email: user.email,
      email_verified: Boolean(user.email),
      preferred_username: user.username,
      name: user.display_name || user.username,
      picture: user.profile_picture || null
    });
  } catch (error) {
    console.error('userinfo error:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function handleOAuthRevoke(req, res) {
  try {
    const body = req.body || {};
    const token = body.token || req.query.token;
    const tokenTypeHint = body.token_type_hint || req.query.token_type_hint || null;
    if (!token) return oauthError(res, 400, 'invalid_request', 'token is required');

    let decoded = verifyToken(token);
    let userId = decoded?.id || decoded?.sub || null;
    let clientId = decoded?.client_id || body.client_id || req.query.client_id || null;

    await supabaseAdmin
      .from('oauth_revoked_tokens')
      .upsert({
        token_hash: hashToken(token),
        token_type_hint: tokenTypeHint,
        user_id: userId,
        client_id: clientId,
        expires_at: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
        revoked_at: new Date().toISOString()
      });

    if (tokenTypeHint === 'refresh_token' || !decoded) {
      await supabaseAdmin
        .from('oauth_refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', hashToken(token));
    }

    return res.status(200).send('');
  } catch (error) {
    console.error('oauth_revoke error:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function handleOAuthIntrospect(req, res) {
  try {
    const body = req.body || {};
    const token = body.token || req.query.token;
    if (!token) return oauthError(res, 400, 'invalid_request', 'token is required');

    // Resolve client credentials from Authorization header or body
    const basic = getBasicClientCredentials(req);
    const client_id = body.client_id || req.query.client_id || basic.client_id;
    const client_secret = body.client_secret || req.query.client_secret || basic.client_secret;

    if (!client_id) {
      return oauthError(res, 401, 'invalid_client', 'client_id is required for introspection');
    }

    // Look up client app
    const { data: app, error: appError } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    if (appError || !app) {
      return oauthError(res, 401, 'invalid_client', 'Client not found');
    }

    // Authenticate client
    const authMethod = app.token_endpoint_auth_method || (client_secret ? 'client_secret_post' : 'none');
    if (authMethod !== 'none' && app.client_secret && app.client_secret !== client_secret) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Materio OAuth"');
      return oauthError(res, 401, 'invalid_client', 'Invalid client credentials');
    }

    const decoded = verifyToken(token);
    if (!decoded || await isTokenRevoked(token)) {
      return res.status(200).json({ active: false });
    }

    // Check that the client calling introspection is the client to which the token was issued
    if (decoded.client_id !== client_id) {
      return oauthError(res, 403, 'forbidden', 'Token was not issued to this client');
    }

    return res.status(200).json({
      active: true,
      sub: String(decoded.sub || decoded.id),
      username: decoded.username,
      email: decoded.email,
      client_id: decoded.client_id,
      scope: decoded.scope,
      token_type: 'Bearer',
      exp: decoded.exp,
      iat: decoded.iat,
      iss: decoded.iss,
      aud: decoded.aud,
      jti: decoded.jti
    });
  } catch (error) {
    console.error('oauth_introspect error:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function handleLogout(req, res) {
  try {
    const postLogoutRedirectUri = req.query.post_logout_redirect_uri || '/';
    const state = req.query.state || '';

    // Clear standard cookie
    res.setHeader('Set-Cookie', [
      'materio_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax',
      'materio_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; domain=.getmaterio.app'
    ]);

    // Construct redirect URL
    let targetUrl;
    try {
      targetUrl = new URL(postLogoutRedirectUri);
      if (state) targetUrl.searchParams.set('state', state);
    } catch (e) {
      targetUrl = new URL('/', getIssuer(req));
    }

    // Return page to clear localStorage on the main domain
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Logging out...</title>
        <script>
          try {
            localStorage.removeItem('materio_auth_token');
            localStorage.removeItem('materio_user');
          } catch (e) {
            console.error('Failed to clear local storage:', e);
          }
          window.location.replace(${JSON.stringify(targetUrl.toString())});
        </script>
      </head>
      <body>
        <p>Logging out, please wait...</p>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Logout handler error:', error);
    return res.status(500).send('Internal Server Error');
  }
}
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
    const body = req.body || {};

    // RFC 7591-style Dynamic Client Registration. This branch intentionally does
    // not require a logged-in Materio user because the user grant happens later.
    if (Array.isArray(body.redirect_uris)) {
      if (body.redirect_uris.length === 0) {
        return oauthError(res, 400, 'invalid_client_metadata', 'redirect_uris must contain at least one URI');
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabaseAdmin
        .from('oauth_registration_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .gte('created_at', oneHourAgo);

      if (countError) {
        console.error('Failed to query registration logs:', countError);
      } else if (count && count >= 5) {
        return oauthError(res, 429, 'slow_down', 'Too many registration attempts. Please try again later.');
      }

      const clientId = body.client_id || 'client_' + crypto.randomBytes(12).toString('hex');
      const authMethod = body.token_endpoint_auth_method || 'none';
      const isPublicClient = authMethod === 'none';
      const clientSecret = isPublicClient ? null : 'secret_' + crypto.randomBytes(24).toString('hex');
      const clientName = body.client_name || 'OAuth Client';
      const scope = normalizeScope(body.scope || 'openid profile email');

      const extendedPayload = {
        client_id: clientId,
        client_secret: clientSecret || '',
        name: clientName,
        redirect_uri: body.redirect_uris[0],
        redirect_uris: body.redirect_uris,
        user_id: null,
        token_endpoint_auth_method: authMethod,
        scope,
        client_uri: body.client_uri || null,
        logo_uri: body.logo_uri || null,
        contacts: Array.isArray(body.contacts) ? body.contacts : []
      };

      const { error } = await supabaseAdmin
        .from('oauth_apps')
        .insert(extendedPayload);

      if (error) {
        return oauthError(res, 500, 'server_error', error.message || 'Failed to register client');
      }

      // Log successful registration for rate limiting
      await supabaseAdmin
        .from('oauth_registration_logs')
        .insert({ ip_address: ip });

      const responsePayload = {
        client_id: clientId,
        client_name: clientName,
        redirect_uris: body.redirect_uris,
        grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
        response_types: body.response_types || ['code'],
        token_endpoint_auth_method: authMethod,
        scope,
        client_id_issued_at: Math.floor(Date.now() / 1000)
      };

      if (clientSecret) {
        responsePayload.client_secret = clientSecret;
        responsePayload.client_secret_expires_at = 0;
      }

      return res.status(201).json(responsePayload);
    }

    // Existing dashboard app registration for authenticated Materio users.
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const { name, redirectUri } = body;
    if (!name || !redirectUri) {
      return res.status(400).json({ error: 'Application name and redirect URI are required' });
    }

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
    return res.status(500).json({ error: 'server_error' });
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

    const {
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      response_type = 'code',
      scope,
      state,
      nonce
    } = req.body || {};

    if (response_type !== 'code') {
      return redirect_uri
        ? oauthRedirectError(res, redirect_uri, 'unsupported_response_type', 'Only authorization code flow is supported', state)
        : oauthError(res, 400, 'unsupported_response_type', 'Only authorization code flow is supported');
    }

    if (!client_id || !redirect_uri) {
      return oauthError(res, 400, 'invalid_request', 'client_id and redirect_uri are required');
    }

    if (code_challenge && code_challenge_method !== 'S256') {
      return oauthRedirectError(res, redirect_uri, 'invalid_request', 'Only S256 PKCE is supported', state);
    }

    const { data: app, error } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    const isDynamicClient = (error || !app);
    if (isDynamicClient && !code_challenge) {
      return oauthRedirectError(res, redirect_uri, 'invalid_client', 'Dynamic clients must use PKCE', state);
    }

    if (!isDynamicClient && !isRedirectUriAllowed(app, redirect_uri)) {
      return oauthError(res, 400, 'invalid_request', 'Redirect URI mismatch');
    }

    if (isDynamicClient) {
      const clientSecret = 'secret_dynamic_' + crypto.randomBytes(16).toString('hex');
      let appName = 'Dynamic OAuth Client';
      if (client_id.startsWith('http')) {
        try { appName = new URL(client_id).hostname; } catch (e) {}
      }

      const extendedInsertPayload = {
        client_id,
        client_secret: clientSecret,
        name: appName,
        redirect_uri,
        redirect_uris: [redirect_uri],
        user_id: user.id,
        token_endpoint_auth_method: 'none',
        scope: normalizeScope(scope || 'admin')
      };
      const legacyInsertPayload = {
        client_id,
        client_secret: clientSecret,
        name: appName,
        redirect_uri,
        user_id: user.id
      };

      let { error: insertAppError } = await supabaseAdmin
        .from('oauth_apps')
        .insert(extendedInsertPayload);

      if (insertAppError) {
        const fallback = await supabaseAdmin.from('oauth_apps').insert(legacyInsertPayload);
        insertAppError = fallback.error;
      }

      if (insertAppError) {
        return oauthRedirectError(res, redirect_uri, 'server_error', 'Failed to register dynamic client', state);
      }
    }

    const code = generateOpaqueToken(32);
    const normalizedScope = normalizeScope(scope || app?.scope || 'admin');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const authTime = new Date().toISOString();
    const token = generateToken(user, {
      issuer: getIssuer(req),
      audience: client_id,
      clientId: client_id,
      scope: normalizedScope,
      tokenUse: 'access'
    });

    const extendedCodePayload = {
      code,
      client_id,
      user_id: user.id,
      redirect_uri,
      token,
      expires_at: expiresAt,
      code_challenge: code_challenge || null,
      code_challenge_method: code_challenge_method || null,
      scope: normalizedScope,
      nonce: nonce || null,
      auth_time: authTime
    };

    let { error: insertError } = await supabaseAdmin
      .from('oauth_codes')
      .insert(extendedCodePayload);

    if (insertError) {
      const legacyPayload = {
        code,
        client_id,
        user_id: user.id,
        redirect_uri,
        token,
        expires_at: expiresAt
      };
      const fallback = await supabaseAdmin.from('oauth_codes').insert(legacyPayload);
      insertError = fallback.error;
    }

    if (insertError) {
      return oauthRedirectError(res, redirect_uri, 'server_error', 'Failed to generate authorization code', state);
    }

    return res.status(200).json({ success: true, code, state });
  } catch (error) {
    console.error('oauth_authorize error:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
async function handleOAuthToken(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    let bodyData = req.body || {};
    if (Buffer.isBuffer(req.body)) bodyData = req.body.toString('utf8');
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); }
      catch (e) { bodyData = Object.fromEntries(new URLSearchParams(bodyData)); }
    }

    const basic = getBasicClientCredentials(req);
    let client_id = bodyData.client_id || req.query.client_id || basic.client_id;
    let client_secret = bodyData.client_secret || req.query.client_secret || basic.client_secret;
    const code = bodyData.code || req.query.code;
    const redirect_uri = bodyData.redirect_uri || req.query.redirect_uri;
    const grant_type = bodyData.grant_type || req.query.grant_type;
    const refresh_token = bodyData.refresh_token || req.query.refresh_token;
    const code_verifier = bodyData.code_verifier || req.query.code_verifier;

    if (!client_id) return oauthError(res, 400, 'invalid_request', 'client_id is required');

    const { data: app, error: appError } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    const isDynamicClient = appError || !app;
    const authMethod = app?.token_endpoint_auth_method || (client_secret ? 'client_secret_post' : 'none');

    const isPkceTokenRequest = grant_type === 'authorization_code' && Boolean(code_verifier);
    if (!isPkceTokenRequest && !isDynamicClient && authMethod !== 'none' && app.client_secret && app.client_secret !== client_secret) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Materio OAuth"');
      return oauthError(res, 401, 'invalid_client', 'Invalid client credentials');
    }

    let tokenToReturn = null;
    let userIdToFetch = null;
    let finalScope = 'admin';
    let finalNonce = null;
    let finalAuthTime = null;

    if (grant_type === 'authorization_code') {
      if (!code) return oauthError(res, 400, 'invalid_request', 'code is required');

      const { data: codeRecord, error: codeError } = await supabaseAdmin
        .from('oauth_codes')
        .delete()
        .eq('code', code)
        .eq('client_id', client_id)
        .gt('expires_at', new Date().toISOString())
        .select()
        .maybeSingle();

      if (codeError || !codeRecord) return oauthError(res, 400, 'invalid_grant', 'Invalid or expired authorization code');
      if (redirect_uri && codeRecord.redirect_uri !== redirect_uri) return oauthError(res, 400, 'invalid_grant', 'Redirect URI mismatch');

      let expectedChallenge = codeRecord.code_challenge || null;
      let challengeMethod = codeRecord.code_challenge_method || null;

      // Backward compatibility for pre-compliance PKCE codes that embedded challenge metadata.
      if (!expectedChallenge && code.startsWith('pkce_')) {
        try {
          const pkceData = JSON.parse(Buffer.from(code.substring(5), 'base64url').toString('utf8'));
          expectedChallenge = pkceData.c;
          challengeMethod = pkceData.m;
        } catch (e) {
          return oauthError(res, 400, 'invalid_grant', 'Invalid authorization code format');
        }
      }

      if (expectedChallenge) {
        if (!code_verifier) return oauthError(res, 400, 'invalid_request', 'code_verifier is required');
        if (challengeMethod !== 'S256') return oauthError(res, 400, 'invalid_grant', 'Only S256 PKCE is supported');
        const calculatedChallenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
        if (calculatedChallenge !== expectedChallenge) return oauthError(res, 400, 'invalid_grant', 'Invalid code_verifier');
      } else if (isDynamicClient || authMethod === 'none') {
        return oauthError(res, 400, 'invalid_grant', 'PKCE is required for public clients');
      }

      tokenToReturn = codeRecord.token;
      userIdToFetch = codeRecord.user_id;
      finalScope = normalizeScope(codeRecord.scope || app?.scope || 'admin');
      finalNonce = codeRecord.nonce || null;
      finalAuthTime = codeRecord.auth_time || codeRecord.created_at || null;
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) return oauthError(res, 400, 'invalid_request', 'refresh_token is required');

      const refreshHash = hashToken(refresh_token);
      const { data: storedRefresh } = await supabaseAdmin
        .from('oauth_refresh_tokens')
        .select('*')
        .eq('token_hash', refreshHash)
        .maybeSingle();

      if (storedRefresh) {
        if (storedRefresh.revoked_at || new Date(storedRefresh.expires_at) < new Date()) {
          return oauthError(res, 400, 'invalid_grant', 'Refresh token is invalid or expired');
        }
        userIdToFetch = storedRefresh.user_id;
        finalScope = normalizeScope(storedRefresh.scope || app?.scope || 'admin');
      } else {
        const decoded = verifyToken(refresh_token);
        if (!decoded || await isTokenRevoked(refresh_token)) {
          return oauthError(res, 400, 'invalid_grant', 'Refresh token is invalid or expired');
        }
        userIdToFetch = decoded.id || decoded.sub;
        finalScope = normalizeScope(decoded.scope || app?.scope || 'admin');
      }
    } else {
      return oauthError(res, 400, 'unsupported_grant_type', 'Only authorization_code and refresh_token are supported');
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, has_admin_privileges, is_plus_user, is_lite_user, profile_picture')
      .eq('id', userIdToFetch)
      .single();

    if (userError || !user) return oauthError(res, 400, 'invalid_grant', 'User not found');

    tokenToReturn = generateToken(user, {
      issuer: getIssuer(req),
      audience: client_id,
      clientId: client_id,
      scope: finalScope,
      tokenUse: 'access'
    });

    const newRefreshToken = generateOpaqueToken(48);
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    let refreshTokenToReturn = newRefreshToken;

    const refreshInsert = await supabaseAdmin
      .from('oauth_refresh_tokens')
      .insert({
        token_hash: hashToken(newRefreshToken),
        user_id: user.id,
        client_id,
        scope: finalScope,
        expires_at: refreshExpiresAt
      });

    if (refreshInsert.error) {
      refreshTokenToReturn = tokenToReturn;
    } else if (grant_type === 'refresh_token' && refresh_token) {
      await supabaseAdmin
        .from('oauth_refresh_tokens')
        .update({ revoked_at: new Date().toISOString(), replaced_by_hash: hashToken(newRefreshToken) })
        .eq('token_hash', hashToken(refresh_token));
    }

    const responsePayload = {
      access_token: tokenToReturn,
      token_type: 'Bearer',
      expires_in: 86400,
      refresh_token: refreshTokenToReturn,
      scope: finalScope,
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
    };

    if (hasScope(finalScope, 'openid')) {
      responsePayload.id_token = generateIdToken(user, {
        issuer: getIssuer(req),
        clientId: client_id,
        nonce: finalNonce,
        authTime: finalAuthTime
      });
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('oauth_token error:', error);
    return res.status(500).json({ error: 'server_error' });
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

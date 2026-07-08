const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
require('dotenv').config();

// Get config from our config file
const supabaseConfig = require('../_config_shared/supabase');
const SUPABASE_URL = supabaseConfig.SUPABASE_URL;
const SUPABASE_ANON_KEY = supabaseConfig.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = supabaseConfig.SUPABASE_SERVICE_KEY;
const JWT_SECRET = supabaseConfig.JWT_SECRET;
const JWT_EXPIRES_IN = supabaseConfig.JWT_EXPIRES_IN;

// Initialize Supabase clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Hash password function
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Compare password with hashed password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT access token. Extra OAuth/OIDC claims are optional for backwards compatibility.
const generateToken = (user, options = {}) => {
  const subject = String(user.id || user.sub || '');
  const payload = {
    id: subject,
    sub: subject,
    email: user.email,
    username: user.username,
    jti: options.jti || uuidv4(),
    token_use: options.tokenUse || 'access'
  };

  if (options.issuer) payload.iss = options.issuer;
  if (options.audience) payload.aud = options.audience;
  if (options.clientId) payload.client_id = options.clientId;
  if (options.scope) payload.scope = options.scope;

  return jwt.sign(payload, JWT_SECRET, { expiresIn: options.expiresIn || JWT_EXPIRES_IN });
};

const getOidcSigningKey = () => {
  if (process.env.OIDC_PRIVATE_KEY_B64) {
    return Buffer.from(process.env.OIDC_PRIVATE_KEY_B64, 'base64').toString('utf8');
  }
  if (process.env.OIDC_PRIVATE_KEY) {
    return process.env.OIDC_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  return JWT_SECRET;
};

const getOidcSigningAlg = () => {
  return process.env.OIDC_PRIVATE_KEY || process.env.OIDC_PRIVATE_KEY_B64 ? 'RS256' : 'HS256';
};

const generateIdToken = (user, options = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const authTime = options.authTime ? Math.floor(new Date(options.authTime).getTime() / 1000) : now;
  const subject = String(user.id || user.sub || '');
  const payload = {
    iss: options.issuer,
    sub: subject,
    aud: options.clientId,
    exp: now + (options.expiresInSeconds || 3600),
    iat: now,
    auth_time: authTime,
    email: user.email,
    email_verified: Boolean(user.email_verified || user.emailVerified || user.email),
    preferred_username: user.username,
    name: user.display_name || user.displayName || user.username,
    picture: user.profile_picture || user.profilePicture || undefined
  };

  if (options.nonce) payload.nonce = options.nonce;

  const signOptions = { algorithm: getOidcSigningAlg(), keyid: process.env.OIDC_KEY_ID || 'materio-default' };
  return jwt.sign(payload, getOidcSigningKey(), signOptions);
};

const getOidcPublicKey = () => {
  if (process.env.OIDC_PUBLIC_KEY_B64) {
    return Buffer.from(process.env.OIDC_PUBLIC_KEY_B64, 'base64').toString('utf8');
  }
  if (process.env.OIDC_PUBLIC_KEY) {
    return process.env.OIDC_PUBLIC_KEY.replace(/\\n/g, '\n');
  }
  return null;
};

const getJwks = () => {
  if (process.env.OIDC_JWKS) {
    try {
      const jwks = JSON.parse(process.env.OIDC_JWKS);
      if (jwks && Array.isArray(jwks.keys)) return jwks;
    } catch (e) {
      console.error('Invalid OIDC_JWKS JSON:', e.message);
    }
  }

  const publicKey = getOidcPublicKey();
  if (publicKey) {
    try {
      const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
      jwk.use = 'sig';
      jwk.alg = getOidcSigningAlg();
      jwk.kid = process.env.OIDC_KEY_ID || 'materio-default';
      return { keys: [jwk] };
    } catch (e) {
      console.error('Invalid OIDC public key:', e.message);
    }
  }

  return { keys: [] };
};

const generateOpaqueToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Generate unique recovery key
const generateRecoveryKey = () => {
  return uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
};

// Generate a cryptographically random handoff code
const generateHandoffCode = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex'); // 32-char hex string
};

// Store handoff code with JWT and metadata (expires in 60 seconds)
const storeHandoffCode = async (code, token, userId, userAgent, ip) => {
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60 seconds

  const { error } = await supabaseAdmin
    .from('handoff_codes')
    .insert({
      code,
      token,
      user_id: userId,
      user_agent: userAgent || null,
      ip_address: ip || null,
      expires_at: expiresAt,
      used: false
    });

  if (error) {
    console.error('Failed to store handoff code:', error);
    return false;
  }
  return true;
};

// Consume (validate and delete) a handoff code - returns the JWT if valid
const consumeHandoffCode = async (code, userAgent, ip) => {
  // First, find the code
  const { data: handoff, error: findError } = await supabaseAdmin
    .from('handoff_codes')
    .select('*')
    .eq('code', code)
    .eq('used', false)
    .single();

  if (findError || !handoff) {
    return { valid: false, error: 'Invalid or expired handoff code' };
  }

  // Check expiry
  if (new Date(handoff.expires_at) < new Date()) {
    // Delete expired code
    await supabaseAdmin.from('handoff_codes').delete().eq('code', code);
    return { valid: false, error: 'Handoff code has expired' };
  }

  // Optional: Validate IP/User-Agent match (can be disabled if too strict)
  // if (handoff.ip_address && handoff.ip_address !== ip) {
  //   return { valid: false, error: 'IP address mismatch' };
  // }

  // Mark as used (or delete it)
  const { error: updateError } = await supabaseAdmin
    .from('handoff_codes')
    .delete()
    .eq('code', code);

  if (updateError) {
    console.error('Failed to consume handoff code:', updateError);
    return { valid: false, error: 'Failed to process handoff' };
  }

  return { valid: true, token: handoff.token, userId: handoff.user_id };
};

// Extract token from request headers
const getTokenFromHeaders = (headers) => {
  const authHeader = headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

const { isAllowedOrigin } = require('../_config_shared/cors-origins');

// CORS headers for cross-origin requests
const corsHeaders = (origin) => {
  let corsOrigin = '*';
  if (origin && isAllowedOrigin(origin)) {
    corsOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
};

// Handle CORS preflight requests
const handleCorsPreflightRequest = (req, res) => {
  if (req.method === 'OPTIONS') {
    const headers = corsHeaders(req.headers.origin);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(204).end();
    return true;
  }
  return false;
};

// Add CORS headers to function responses
const addCorsHeaders = (res, origin) => {
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
};

module.exports = {
  supabase,
  supabaseAdmin,
  hashPassword,
  comparePassword,
  generateToken,
  generateIdToken,
  getJwks,
  generateOpaqueToken,
  hashToken,
  verifyToken,
  generateRecoveryKey,
  generateHandoffCode,
  storeHandoffCode,
  consumeHandoffCode,
  getTokenFromHeaders,
  corsHeaders,
  handleCorsPreflightRequest,
  addCorsHeaders
};

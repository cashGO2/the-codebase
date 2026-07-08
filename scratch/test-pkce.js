const crypto = require('crypto');
const { supabase, generateToken } = require('../api/v2/_utils');
const authHandler = require('../api/v2/auth');

function mockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end() { return this; }
  };
  return res;
}

async function testPkce() {
  console.log("🚀 Starting PKCE OAuth Flow Test...");

  // 1. Fetch test user
  const { data: user } = await supabase.from('users').select('*').limit(1).single();
  const token = generateToken(user);
  const authHeader = `Bearer ${token}`;

  // 2. Register test app
  console.log("\n1. Registering test app...");
  const regReq = {
    method: 'POST',
    query: {},
    headers: { authorization: authHeader },
    body: {
      action: 'oauth_register_app',
      name: 'PKCE Test App',
      redirectUri: 'https://oauth.pstmn.io/v1/callback'
    }
  };
  const regRes = mockResponse();
  await authHandler(regReq, regRes);
  const client = regRes.body.app;
  console.log(`✅ App registered: ${client.client_id}`);

  // 3. Generate PKCE verifier and challenge
  // S256 Method: challenge = BASE64URL-ENCODE(SHA256(verifier))
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  console.log(`\nGenerated PKCE values:\n  Verifier: ${codeVerifier}\n  Challenge: ${codeChallenge}`);

  // 4. Test oauth_authorize with PKCE
  console.log("\n2. Requesting auth code with challenge...");
  const authReq = {
    method: 'POST',
    query: {},
    headers: { authorization: authHeader },
    body: {
      action: 'oauth_authorize',
      client_id: client.client_id,
      redirect_uri: 'https://oauth.pstmn.io/v1/callback',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    }
  };
  const authRes = mockResponse();
  await authHandler(authReq, authRes);
  const code = authRes.body.code;
  console.log(`✅ Code generated: ${code}`);

  // 5. Test token exchange WITH WRONG verifier
  console.log("\n3. Testing token exchange with invalid verifier...");
  const tokenReqWrong = {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      action: 'oauth_token',
      grant_type: 'authorization_code',
      client_id: client.client_id,
      code: code,
      redirect_uri: 'https://oauth.pstmn.io/v1/callback',
      code_verifier: 'wrong_verifier_12345'
    }
  };
  const tokenResWrong = mockResponse();
  await authHandler(tokenReqWrong, tokenResWrong);
  if (tokenResWrong.statusCode === 400) {
    console.log("✅ Correctly rejected wrong verifier:", tokenResWrong.body.error);
  } else {
    console.error("❌ Failed to reject wrong verifier:", tokenResWrong.statusCode, tokenResWrong.body);
  }

  // 6. Test token exchange WITH CORRECT verifier and NO client secret (PKCE public client bypass)
  console.log("\n4. Testing token exchange with correct verifier and NO client secret...");
  const tokenReqCorrect = {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      action: 'oauth_token',
      grant_type: 'authorization_code',
      client_id: client.client_id,
      code: code,
      redirect_uri: 'https://oauth.pstmn.io/v1/callback',
      code_verifier: codeVerifier
    }
  };
  const tokenResCorrect = mockResponse();
  await authHandler(tokenReqCorrect, tokenResCorrect);

  if (tokenResCorrect.statusCode === 200) {
    console.log("✅ Token exchanged successfully using PKCE verifier!");
    console.log("Access Token:", tokenResCorrect.body.access_token.substring(0, 15) + "...");
  } else {
    console.error("❌ Token exchange failed:", tokenResCorrect.statusCode, tokenResCorrect.body);
  }

  // Cleanup
  const cleanupReq = {
    method: 'POST',
    query: {},
    headers: { authorization: authHeader },
    body: {
      action: 'oauth_delete_app',
      client_id: client.client_id
    }
  };
  await authHandler(cleanupReq, mockResponse());
}

testPkce();

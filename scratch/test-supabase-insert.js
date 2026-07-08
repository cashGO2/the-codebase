const { supabaseAdmin, generateToken } = require('../api/v2/_utils');
const authHandler = require('../api/v2/auth');

async function testInsert() {
  console.log("Checking OAuth authorize endpoint with dynamic client_id...");
  
  const testClientId = "https://chatgpt.com/oauth/BSSv8D8sZXar/client.json?token_endpoint_auth_method=none";
  
  // Get a valid user and token
  const { data: user } = await supabaseAdmin.from('users').select('*').limit(1).single();
  if (!user) {
    console.error("❌ No users found in database to test with");
    return;
  }
  const token = generateToken(user);
  const authHeader = `Bearer ${token}`;

  const req = {
    method: 'POST',
    query: {},
    headers: { authorization: authHeader },
    body: {
      action: 'oauth_authorize',
      client_id: testClientId,
      redirect_uri: 'https://chatgpt.com/connector/oauth/BSSv8D8sZXar',
      code_challenge: 'PxUdFKY2ZzfxsCyIqDKoZ3w8VEKSRH3NETpw59WRLD8',
      code_challenge_method: 'S256'
    }
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end() { return this; }
  };

  await authHandler(req, res);

  if (res.statusCode === 200 && res.body.code) {
    console.log("✅ Success! Authorization code generated:", res.body.code);
    
    // Cleanup generated app and code
    console.log("Cleaning up test records...");
    await supabaseAdmin.from('oauth_codes').delete().eq('code', res.body.code);
    await supabaseAdmin.from('oauth_apps').delete().eq('client_id', testClientId);
    console.log("Cleanup complete.");
  } else {
    console.error("❌ Authorization failed:", res.statusCode, JSON.stringify(res.body, null, 2));
  }
}

testInsert();

const path = require('path');
const { supabase, generateToken } = require('../api/v2/_utils');
const authHandler = require('../api/v2/auth');

// Simple mock response generator
function mockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('🚀 Starting OAuth E2E Test Suite...');

  // 1. Fetch a test user from DB
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single();

  if (userError || !user) {
    console.error('❌ Failed to fetch user from DB:', userError);
    process.exit(1);
  }

  console.log(`... Fetched test user: ${user.username} (${user.email})`);

  // 2. Generate a valid token for the test user
  const token = generateToken(user);
  const authHeader = `Bearer ${token}`;

  let registeredApp = null;

  // 3. Test: Register OAuth Application (oauth_register_app)
  {
    console.log('\n--- 1. Testing oauth_register_app ---');
    const req = {
      method: 'POST',
      query: {},
      headers: { authorization: authHeader },
      body: {
        action: 'oauth_register_app',
        name: 'Test OAuth Integration App',
        redirectUri: 'https://oauth.pstmn.io/v1/callback'
      }
    };
    const res = mockResponse();
    await authHandler(req, res);

    if (res.statusCode === 200 && res.body && res.body.success) {
      registeredApp = res.body.app;
      console.log('✅ Registered application successfully:', registeredApp.name);
      console.log('Client ID:', registeredApp.client_id);
      console.log('Client Secret:', registeredApp.client_secret);
    } else {
      console.error('❌ Failed to register app:', res.statusCode, res.body);
      process.exit(1);
    }
  }

  // 4. Test: Fetch Client Info (oauth_client_info)
  {
    console.log('\n--- 2. Testing oauth_client_info ---');
    const req = {
      method: 'GET',
      query: {
        action: 'oauth_client_info',
        client_id: registeredApp.client_id
      },
      headers: {},
      body: {}
    };
    const res = mockResponse();
    await authHandler(req, res);

    if (res.statusCode === 200 && res.body && res.body.client_id === registeredApp.client_id) {
      console.log('✅ Fetched client info successfully:', res.body.name);
    } else {
      console.error('❌ Failed to fetch client info:', res.statusCode, res.body);
      await cleanUp(registeredApp.client_id, authHeader);
      process.exit(1);
    }
  }

  // 5. Test: Authorize & Obtain Code (oauth_authorize)
  let authorizationCode = null;
  {
    console.log('\n--- 3. Testing oauth_authorize ---');
    const req = {
      method: 'POST',
      query: {},
      headers: { authorization: authHeader },
      body: {
        action: 'oauth_authorize',
        client_id: registeredApp.client_id,
        redirect_uri: registeredApp.redirect_uri
      }
    };
    const res = mockResponse();
    await authHandler(req, res);

    if (res.statusCode === 200 && res.body && res.body.success && res.body.code) {
      authorizationCode = res.body.code;
      console.log('✅ Obtained authorization code:', authorizationCode);
    } else {
      console.error('❌ Failed to authorize:', res.statusCode, res.body);
      await cleanUp(registeredApp.client_id, authHeader);
      process.exit(1);
    }
  }

  // 6. Test: Exchange Code for Access Token (oauth_token)
  {
    console.log('\n--- 4. Testing oauth_token ---');
    const req = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        action: 'oauth_token',
        grant_type: 'authorization_code',
        client_id: registeredApp.client_id,
        client_secret: registeredApp.client_secret,
        code: authorizationCode,
        redirect_uri: registeredApp.redirect_uri
      }
    };
    const res = mockResponse();
    await authHandler(req, res);

    if (res.statusCode === 200 && res.body && res.body.access_token) {
      console.log('✅ Swapped code for access token successfully!');
      console.log('Token Type:', res.body.token_type);
      console.log('Expires In:', res.body.expires_in);
      console.log('User Profile payload returned:', res.body.user.username, `(${res.body.user.email})`);
    } else {
      console.error('❌ Failed to swap code for token:', res.statusCode, res.body);
      await cleanUp(registeredApp.client_id, authHeader);
      process.exit(1);
    }
  }

  // 7. Test: List Applications (oauth_list_apps)
  {
    console.log('\n--- 5. Testing oauth_list_apps ---');
    const req = {
      method: 'GET',
      query: { action: 'oauth_list_apps' },
      headers: { authorization: authHeader },
      body: {}
    };
    const res = mockResponse();
    await authHandler(req, res);

    if (res.statusCode === 200 && res.body && res.body.apps) {
      const found = res.body.apps.find(a => a.client_id === registeredApp.client_id);
      if (found) {
        console.log(`✅ Listed apps successfully. Found registered app "${found.name}"`);
      } else {
        console.error('❌ App registered but not listed in list_apps');
        await cleanUp(registeredApp.client_id, authHeader);
        process.exit(1);
      }
    } else {
      console.error('❌ Failed to list apps:', res.statusCode, res.body);
      await cleanUp(registeredApp.client_id, authHeader);
      process.exit(1);
    }
  }

  // 8. Clean up and verify deletion (oauth_delete_app)
  await cleanUp(registeredApp.client_id, authHeader);
  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! E2E FLOW COMPLETED.');
}

async function cleanUp(clientId, authHeader) {
  console.log('\n--- Cleanup: Deleting test app ---');
  const req = {
    method: 'POST',
    query: {},
    headers: { authorization: authHeader },
    body: {
      action: 'oauth_delete_app',
      clientId: clientId
    }
  };
  const res = mockResponse();
  await authHandler(req, res);

  if (res.statusCode === 200 && res.body && res.body.success) {
    console.log('✅ Cleaned up registered test app successfully.');
  } else {
    console.error('❌ Failed to cleanup app:', res.statusCode, res.body);
  }
}

runTests().catch(err => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});

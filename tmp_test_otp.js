const authHandler = require('./api/v2/auth');

const req = {
  method: 'POST',
  query: { action: 'otp' },
  body: { email: '2301010101001@paruluniversity.ac.in', type: 'signup' },
  headers: { origin: 'http://localhost:1000' }
};

const res = {
  status: function(code) {
    console.log('Status:', code);
    return this;
  },
  json: function(data) {
    console.log('JSON Output:', JSON.stringify(data, null, 2));
    return this;
  },
  setHeader: function(name, value) {
    // console.log('Header:', name, value);
    return this;
  },
  send: function(data) {
    console.log('Send Output:', data);
    return this;
  },
  end: function() {
    return this;
  }
};

// Mock console.error
console.error = (...args) => {
    console.log('MOCK ERROR:', ...args);
};

process.env.SMTP_EMAIL = 'mock@example.com';
process.env.SMTP_PASSWORD = 'password';

console.log('Running test...');
authHandler(req, res).catch(err => console.log('CAUGHT SYNC ERROR:', err));

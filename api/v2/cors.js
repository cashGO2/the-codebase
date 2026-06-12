const { isAllowedOrigin } = require('../_config_shared/cors-origins');

// Handle CORS preflight requests for all functions
module.exports = async (req, res) => {
  // Return CORS headers for OPTIONS requests
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;

    let corsOrigin = '*';
    if (origin && isAllowedOrigin(origin)) {
      corsOrigin = origin;
    }

    console.log(`CORS preflight request from origin: ${origin}, responding with: ${corsOrigin}`);

    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    res.status(204).send('');
    return;
  }

  // Not an OPTIONS request, return an error
  return res.status(405).json({ error: 'This function only handles OPTIONS requests' });
};

// Handle CORS preflight requests for all functions
module.exports = async (req, res) => {
  // Return CORS headers for OPTIONS requests
  if (req.method === 'OPTIONS') {
    // Get the requesting origin
    const origin = req.headers.origin;

    // Determine if this origin should be allowed
    const allowedOrigins = [
      'http://localhost:8888',
      'https://materioa.netlify.app',
      'https://materioa.vercel.app',
      'https://materioapp.in'
    ];
    // Set Origin to the requesting origin if it's allowed, otherwise use wildcard
    // CORS spec requires a single origin value, not a comma-separated list
    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : '*';

    console.log(`CORS preflight request from origin: ${origin}, responding with: ${corsOrigin}`);

    res.status(204).set({
      'Access-Control-Allow-Origin': corsOrigin, // Single origin, not a list
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }).send('');
    return;
  }

  // Not an OPTIONS request, return an error
  return res.status(405).json({ error: 'This function only handles OPTIONS requests' });
};

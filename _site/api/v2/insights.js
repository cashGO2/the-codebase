const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const cors = require('./cors');

// Decode service account key from base64
const base64Key = process.env.GA_SERVICE_ACCOUNT_KEY_BASE64;
const credentials = base64Key ? JSON.parse(Buffer.from(base64Key, 'base64').toString()) : null;

// Initialize Analytics client
const analyticsDataClient = credentials ? new BetaAnalyticsDataClient({ credentials }) : null;

module.exports = async (req, res) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return cors(req, res);
  }

  if (!analyticsDataClient) {
    console.error('GA_SERVICE_ACCOUNT_KEY_BASE64 not configured');
    return res.status(500).json({ error: 'Analytics not configured' });
  }

  try {
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'activeUsers' }],
    });

    const users = response.rows?.[0]?.metricValues?.[0]?.value || '0';

    // Set Cache-Control header
    res.setHeader('Cache-Control', 'no-store');
    
    return res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching real-time users:', error);
    return res.status(500).json({ error: error.message });
  }
};

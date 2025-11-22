const { google } = require('googleapis');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const fs = require('fs');
const path = require('path');
const { verifyToken, corsHeaders, getTokenFromHeaders, supabase } = require('./_utils');

// ==========================================
// Google Drive Configuration
// ==========================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://auth-materioa.netlify.app/account/profile.html';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// ==========================================
// Google Analytics Configuration
// ==========================================
const base64Key = process.env.GA_SERVICE_ACCOUNT_KEY_BASE64;
const credentials = base64Key ? JSON.parse(Buffer.from(base64Key, 'base64').toString()) : null;
const analyticsDataClient = credentials ? new BetaAnalyticsDataClient({ credentials }) : null;

// ==========================================
// Main Handler
// ==========================================
module.exports = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Determine which feature is being requested
    // Check path first
    const isInsights = url.pathname.includes('/insights');
    const isSavePromo = url.pathname.includes('/save-promo');
    const isGoogleDrive = url.pathname.includes('/google-drive');
    
    // Check query param action
    const action = req.query.action;
    
    if (isInsights || action === 'insights') {
      return await handleInsights(req, res);
    }
    
    if (isSavePromo || action === 'save-promo') {
      return await handleSavePromo(req, res);
    }
    
    if (isGoogleDrive || action === 'google-drive') {
      return await handleGoogleDrive(req, res, url);
    }

    return res.status(404).json({ error: 'Feature not found' });

  } catch (error) {
    console.error('Features API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// ==========================================
// Feature Handlers
// ==========================================

async function handleInsights(req, res) {
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
}

async function handleSavePromo(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const promoData = req.body;
    const jsonContent = JSON.stringify(promoData, null, 2);
    
    // Define file paths relative to the Netlify build
    // Note: In Vercel serverless environment, writing to file system is ephemeral and usually not what you want for persistence.
    // But preserving the logic as requested.
    const sourceFile = path.join(process.cwd(), 'assets', 'data', 'promo.json');
    const siteFile = path.join(process.cwd(), '_site', 'assets', 'data', 'promo.json');
    
    console.log('Saving promo data to:', sourceFile);
    
    // Ensure directories exist
    const sourceDir = path.dirname(sourceFile);
    const siteDir = path.dirname(siteFile);
    
    if (!fs.existsSync(sourceDir)) {
      fs.mkdirSync(sourceDir, { recursive: true });
    }
    
    if (!fs.existsSync(siteDir)) {
      fs.mkdirSync(siteDir, { recursive: true });
    }
    
    // Write to both files
    fs.writeFileSync(sourceFile, jsonContent);
    fs.writeFileSync(siteFile, jsonContent);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Promotion data saved successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error saving promo files:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

async function handleGoogleDrive(req, res, url) {
  const { method, headers } = req;
  const body = req.body || {};
  
  // Extract auth token
  const authHeader = headers.authorization || headers.Authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Determine sub-endpoint
  // URL might be /api/v2/features/google-drive/auth-url or /api/v2/google-drive/auth-url
  // We look for the part after 'google-drive'
  let endpoint = '';
  const pathParts = url.pathname.split('/');
  const driveIndex = pathParts.indexOf('google-drive');
  if (driveIndex !== -1 && driveIndex < pathParts.length - 1) {
    endpoint = pathParts[driveIndex + 1];
  } else {
    // Fallback: check query param
    endpoint = req.query.subAction || '';
  }

  // Also check if it's a delete action with ID
  if (url.pathname.includes('/delete/')) {
    endpoint = 'delete';
  }

  switch (method) {
    case 'GET':
      if (endpoint === 'auth-url') {
        // Generate Google OAuth URL
        const scopes = [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.profile'
        ];
        
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes,
          state: user.id // Pass user ID in state
        });
        
        return res.status(200).json({ authUrl });
      }
      
      if (endpoint === 'status') {
        // Check if user has linked Google Drive
        const tokens = await getGoogleTokens(user.id);
        const linked = !!tokens;
        
        let materioFolderId = null;
        if (linked && tokens.access_token) {
          try {
            oauth2Client.setCredentials({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token
            });
            
            // Check if materio folder exists
            materioFolderId = await findOrCreateMaterioFolder();
          } catch (error) {
            console.error('Error checking materio folder:', error);
          }
        }
        
        return res.status(200).json({ 
          linked,
          materioFolderId
        });
      }
      
      if (endpoint === 'files') {
        // List user's files from Google Drive
        const tokens = await getGoogleTokens(user.id);
        if (!tokens) {
          return res.status(400).json({ error: 'Google Drive not linked' });
        }
        
        const refreshedTokens = await refreshTokensIfNeeded(user.id, tokens);
        if (!refreshedTokens) {
          return res.status(400).json({ error: 'Failed to refresh tokens' });
        }
        
        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token
        });
          try {
          // Get the folderId from query parameters if provided
          const { folderId } = req.query;
          
          let query = "trashed=false";
          if (folderId) {
            query += ` and '${folderId}' in parents`;
          } else {
            // Default to materio folder
            const materioFolderId = await findOrCreateMaterioFolder();
            query += ` and '${materioFolderId}' in parents`;
          }
          
          const response = await drive.files.list({
            pageSize: 50,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink)',
            q: query
          });
          
          return res.status(200).json({ files: response.data.files });
        } catch (error) {
          console.error('Error listing files:', error);
          return res.status(500).json({ error: 'Failed to list files' });
        }
      }
      break;

    case 'POST':
      if (endpoint === 'callback') {
        // Handle OAuth callback
        const { code, state } = body;
        
        if (state !== user.id) {
          return res.status(400).json({ error: 'Invalid state parameter' });
        }
        
        try {
          const { tokens } = await oauth2Client.getToken(code);
          await storeGoogleTokens(user.id, tokens);
          
          return res.status(200).json({ success: true });
        } catch (error) {
          console.error('Error exchanging code for tokens:', error);
          return res.status(400).json({ error: 'Failed to exchange code for tokens' });
        }        }
      
      if (endpoint === 'ensure-folder') {
        // Ensure materio folder exists
        const tokens = await getGoogleTokens(user.id);
        if (!tokens) {
          return res.status(400).json({ error: 'Google Drive not linked' });
        }

        const refreshedTokens = await refreshTokensIfNeeded(user.id, tokens);
        if (!refreshedTokens) {
          return res.status(400).json({ error: 'Failed to refresh tokens' });
        }

        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token
        });

        try {
          const folderId = await findOrCreateMaterioFolder();
          return res.status(200).json({ folderId });
        } catch (error) {
          console.error('Error ensuring materio folder:', error);
          return res.status(500).json({ error: 'Failed to ensure materio folder' });
        }
      }
      
      if (endpoint === 'upload') {
        // Upload file to Google Drive
        const tokens = await getGoogleTokens(user.id);
        if (!tokens) {
          return res.status(400).json({ error: 'Google Drive not linked' });
        }
        
        const refreshedTokens = await refreshTokensIfNeeded(user.id, tokens);
        if (!refreshedTokens) {
          return res.status(400).json({ error: 'Failed to refresh tokens' });
        }
        
        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token
        });
          const { fileName, fileContent, mimeType, folderId } = body;
        
        try {
          // Use provided folderId or default to materio folder
          const targetFolderId = folderId || await findOrCreateMaterioFolder();
          
          const response = await drive.files.create({
            requestBody: {
              name: fileName,
              parents: [targetFolderId] // Upload to materio folder
            },
            media: {
              mimeType: mimeType,
              body: Buffer.from(fileContent, 'base64')
            }
          });
          
          return res.status(200).json({ 
            success: true, 
            fileId: response.data.id,
            fileName: response.data.name
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          return res.status(500).json({ error: 'Failed to upload file' });
        }
      }
      
      break;

    case 'DELETE':
      if (endpoint === 'unlink') {
        // Unlink Google Drive
        try {
          const { error } = await supabase
            .from('google_drive_tokens')
            .delete()
            .eq('user_id', user.id);
          
          if (error) throw error;
          
          return res.status(200).json({ success: true });
        } catch (error) {
          console.error('Error unlinking Google Drive:', error);
          return res.status(500).json({ error: 'Failed to unlink Google Drive' });
        }
      }

      // Handle file deletion by ID
      // Assuming the URL is like /api/v2/google-drive/delete/FILE_ID
      // or we parse it from the path
      const deleteMatch = url.pathname.match(/\/delete\/(.+)$/);
      if (deleteMatch) {
        const fileId = deleteMatch[1];
        
        const tokens = await getGoogleTokens(user.id);
        if (!tokens) {
          return res.status(400).json({ error: 'Google Drive not linked' });
        }

        const refreshedTokens = await refreshTokensIfNeeded(user.id, tokens);
        if (!refreshedTokens) {
          return res.status(400).json({ error: 'Failed to refresh tokens' });
        }

        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token
        });

        try {
          await drive.files.delete({
            fileId: fileId
          });

          return res.status(200).json({ success: true });
        } catch (error) {
          console.error('Error deleting file:', error);
          return res.status(500).json({ error: 'Failed to delete file' });
        }
      }

      break;

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}

// ==========================================
// Google Drive Helpers
// ==========================================

const getUserFromToken = async (token) => {
  const decoded = verifyToken(token);
  if (!decoded) return null;
  
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', decoded.id)
    .single();
  
  return user;
};

const storeGoogleTokens = async (userId, tokens) => {
  const { error } = await supabase
    .from('google_drive_tokens')
    .upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + (tokens.expires_in * 1000)),
      updated_at: new Date()
    });
  
  return !error;
};

const getGoogleTokens = async (userId) => {
  const { data: tokens } = await supabase
    .from('google_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  return tokens;
};

const refreshTokensIfNeeded = async (userId, tokens) => {
  if (new Date() < new Date(tokens.expires_at)) {
    return tokens;
  }
  
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await storeGoogleTokens(userId, credentials);
    return await getGoogleTokens(userId);
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    return null;
  }
};

const findOrCreateMaterioFolder = async () => {
  try {
    // First, search for existing materio folder
    const response = await drive.files.list({
      q: "name='materio' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)'
    });
    
    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }
    
    // If not found, create the folder
    const folderResponse = await drive.files.create({
      resource: {
        name: 'materio',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    
    return folderResponse.data.id;
  } catch (error) {
    console.error('Error finding/creating materio folder:', error);
    throw error;
  }
};

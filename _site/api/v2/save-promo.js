const fs = require('fs');
const path = require('path');
const cors = require('./cors');

module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return cors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const promoData = req.body;
    const jsonContent = JSON.stringify(promoData, null, 2);
    
    // Define file paths relative to the Netlify build
    const sourceFile = path.join(process.cwd(), 'assets', 'data', 'promo.json');
    const siteFile = path.join(process.cwd(), '_site', 'assets', 'data', 'promo.json');
    
    console.log('Saving promo data to:', sourceFile);
    console.log('Saving promo data to:', siteFile);
    
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
    
    console.log('✅ Successfully saved promo.json files');
    
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
};

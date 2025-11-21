const { 
  supabaseAdmin, 
  corsHeaders
} = require('./utils');
const cors = require('./cors');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;
  
  console.log('Running migrations handler');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return cors(req, res);
  }
  
  try {
    // Read and execute the migrations
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir);
    
    const results = [];
    
    // Find the sharelinks migration specifically
    const sharelinksFile = files.find(file => file.includes('sharelinks'));
    const rpcFunctionsFile = files.find(file => file.includes('rpc_functions'));
    
    // First run the RPC functions migration if it exists
    if (rpcFunctionsFile) {
      console.log('Found RPC functions migration file:', rpcFunctionsFile);
      const migration = fs.readFileSync(path.join(migrationsDir, rpcFunctionsFile), 'utf8');
      
      // Execute the SQL
      const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: migration });
      
      results.push({
        file: rpcFunctionsFile,
        success: !error,
        error: error ? error.message : null
      });
      
      console.log('RPC functions migration result:', results[results.length - 1]);
    }
    
    // Then run the sharelinks migration if it exists
    if (sharelinksFile) {
      console.log('Found sharelinks migration file:', sharelinksFile);
      const migration = fs.readFileSync(path.join(migrationsDir, sharelinksFile), 'utf8');
      
      // Execute the SQL
      const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: migration });
      
      results.push({
        file: sharelinksFile,
        success: !error,
        error: error ? error.message : null
      });
      
      console.log('Sharelinks migration result:', results[results.length - 1]);
    } else {
      console.log('Sharelinks migration file not found');
      results.push({
        file: 'sharelinks_migration',
        success: false,
        error: 'Migration file not found'
      });
    }
    
    return res.status(200).json({
      message: 'Migrations attempted',
      results
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: 'Failed to run migrations', details: error.message });
  }
};

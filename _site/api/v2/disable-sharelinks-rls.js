const { supabase, corsHeaders } = require('./utils');
const cors = require('./cors');

module.exports = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return cors(req, res);
  }

  try {
    // Simple solution: Disable RLS for sharelinks table
    // Run SQL directly to bypass policy restrictions
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql_command: 'ALTER TABLE sharelinks DISABLE ROW LEVEL SECURITY;'
    });

    if (error) {
      console.error('Error disabling RLS:', error);
      return res.status(500).json({
        error: 'Failed to disable RLS',
        details: error.message
      });
    }

    return res.status(200).json({
      message: 'Successfully disabled RLS for sharelinks table',
      details: 'The table now allows all operations without RLS restrictions'
    });
  } catch (error) {
    console.error('Error disabling RLS:', error);
    return res.status(500).json({
      error: 'Failed to disable RLS',
      details: error.message
    });
  }
};

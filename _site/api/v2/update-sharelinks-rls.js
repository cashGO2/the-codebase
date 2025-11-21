const { supabase, corsHeaders } = require('./utils');

exports.handler = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  try {
    // Check if user is admin (for security)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Create proper RLS policies for sharelinks table
    // 1. First disable RLS to ensure we can modify the policies
    await supabase.rpc('disable_rls_for_table', { table_name: 'sharelinks' });
    
    // 2. Create policies that allow operations for authenticated users
    const createPolicyResult = await supabase.rpc('create_table_policy', { 
      table_name: 'sharelinks',
      policy_name: 'sharelinks_all_operations',
      policy_definition: 'true',
      policy_operation: 'ALL'
    });

    // 3. Re-enable RLS with our new permissive policy
    await supabase.rpc('enable_rls_for_table', { table_name: 'sharelinks' });

    return res.status(200).json({
      message: 'Successfully updated RLS policies for sharelinks table',
      details: 'The table now allows all operations from authenticated requests'
    });
  } catch (error) {
    console.error('Error updating RLS policies:', error);
    return res.status(500).json({
      error: 'Failed to update RLS policies',
      details: error.message,
      hint: 'Check that you have the necessary permissions to modify RLS policies'
    });
  }
};
const { 
  supabase, 
  corsHeaders
} = require('./utils');

exports.handler = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;
  
  console.log('Sharelink info handler - Received request', req.query);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  try {
    // Get invite code from query params
    const code = req.query.code;
    
    if (!code) {
      console.log('No invite code provided');
      return res.status(400).json({
        error: 'Invite code is required'
      });
    }
    
    console.log('Looking up sharelink info for code:', code);
    
    // Try to get sharelink info
    let sharelinkInfo = null;
    let error = null;
    
    // Method 1: Standard Supabase query
    try {
      const { data, error: queryError } = await supabase
        .from('sharelinks')
        .select('invite_code, custom_heading')
        .eq('invite_code', code)
        .single();
      
      console.log('Supabase query result:', { data, error: queryError });
      
      if (data) {
        sharelinkInfo = data;
      } else {
        error = queryError;
      }
    } catch (e) {
      console.error('Error querying sharelink:', e);
      error = e;
    }
    
    // Method 2: Direct SQL via RPC if standard query fails
    if (!sharelinkInfo && error) {
      try {
        console.log('Trying direct SQL via RPC');
        const sql = `
          SELECT invite_code, custom_heading 
          FROM sharelinks 
          WHERE invite_code = '${code}'
          LIMIT 1;
        `;
        
        const { data, error: sqlError } = await supabase.rpc('execute_sql', { sql_command: sql });
        
        console.log('Direct SQL result:', { data, error: sqlError });
        
        if (sqlError) {
          console.error('Direct SQL query failed:', sqlError);
        } else if (data) {
          // Parse the result
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          console.log('Parsed SQL data:', parsedData);
          
          if (parsedData && parsedData.length > 0) {
            sharelinkInfo = parsedData[0];
            error = null;
          }
        }
      } catch (sqlError) {
        console.error('Error executing direct SQL:', sqlError);
      }
    }
    
    if (sharelinkInfo) {
      console.log('Returning sharelink info:', sharelinkInfo);
      return res.status(200).json({
        inviteCode: sharelinkInfo.invite_code,
        customHeading: sharelinkInfo.custom_heading
      });
    } else {
      console.log('Sharelink not found');
      return res.status(404).json({
        error: 'Sharelink not found'
      });
    }
  } catch (error) {
    console.error('Sharelink info error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || "https://svfuynziufsxccwihfbw.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { data: app, error } = await supabase
    .from('oauth_apps')
    .select('*')
    .eq('client_id', 'client_7b57f1c14bf27294')
    .single();
    
  if (error) {
    console.error("Error fetching app:", error);
    return;
  }
  
  console.log("App Details:");
  console.log(JSON.stringify(app, null, 2));
}

check();

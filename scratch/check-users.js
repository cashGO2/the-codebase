const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || "https://svfuynziufsxccwihfbw.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, display_name, email, has_admin_privileges');
    
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }
  
  console.log("Registered Users:");
  console.log(JSON.stringify(users, null, 2));
}

check();

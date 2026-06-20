const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../migrations/20260620_create_oauth_tables.sql');
    console.log(`Reading migration from: ${migrationPath}`);
    let sql = fs.readFileSync(migrationPath, 'utf8');

    // Clean up our temporary test table and then run the OAuth tables migration
    sql = `
      DROP TABLE IF EXISTS test_table;
      ${sql}
      SELECT '{"success": true}'::json;
    `;

    console.log('Executing SQL migration on Supabase...');
    const { data, error } = await supabaseAdmin.rpc('execute_sql', { sql_command: sql });

    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }

    if (data && data.error) {
      console.error('Database query execution error:', data.error);
      process.exit(1);
    }

    console.log('Migration output:', data);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Failed to run migration:', error);
    process.exit(1);
  }
}

runMigration();

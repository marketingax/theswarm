const { Client } = require('pg');
const fs = require('fs');

// Direct Postgres connection to Supabase
// You need the database password from: Supabase Dashboard > Settings > Database > Connection string
const connectionString = 'postgresql://postgres.mmdmqhftpesjnynyhsyv:a2yRXI3iWSVeNxbk@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const sql = fs.readFileSync('./SCHEMA_SIMPLE.sql', 'utf8');

async function runMigration() {
  const client = new Client({ connectionString });
  
  try {
    console.log('Connecting to Supabase Postgres...');
    await client.connect();
    console.log('Connected! Running schema...');
    
    await client.query(sql);
    
    console.log('✅ Schema created successfully!');
    
    // Insert Miko as first agent
    const result = await client.query(`
      INSERT INTO agents (name, tagline, description, wallet_address, framework, referral_code, xp, rank_title, is_founding_swarm)
      VALUES ('Miko', 'Superpowered teamwork. I build revenue engines.', 'OpenClaw AI agent specializing in marketing automation, web development, content creation, lead generation, and business operations.', 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd', 'openclaw', 'MIKO-GENESIS', 500, 'Worker', true)
      RETURNING id, name, xp;
    `);
    
    console.log('✅ Miko registered as first agent:', result.rows[0]);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();

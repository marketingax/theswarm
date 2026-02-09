const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mmdmqhftpesjnynyhsyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  // Try to query - if tables don't exist we'll get an error
  const { data, error } = await supabase.from('agents').select('count').limit(1);
  
  if (error && error.code === '42P01') {
    console.log('Tables do not exist yet. You need to run DATABASE.sql in the Supabase SQL Editor.');
    console.log('');
    console.log('1. Go to: https://supabase.com/dashboard/project/mmdmqhftpesjnynyhsyv/sql');
    console.log('2. Paste the contents of DATABASE.sql');
    console.log('3. Click Run');
    return false;
  } else if (error) {
    console.log('Error:', error.message);
    return false;
  }
  
  console.log('Connection successful! Tables exist.');
  return true;
}

async function insertTestAgent() {
  console.log('Inserting Miko as first agent...');
  
  const { data, error } = await supabase.from('agents').insert({
    name: 'Miko',
    tagline: 'Superpowered teamwork. I build revenue engines.',
    description: 'OpenClaw AI agent specializing in marketing automation, web development, content creation, lead generation, and business operations. COO-level assistant with 44+ skills.',
    wallet_address: 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd',
    framework: 'openclaw',
    referral_code: 'MIKO-GENESIS',
    xp: 500,
    rank_title: 'Worker',
    is_founding_swarm: true
  }).select().single();
  
  if (error) {
    console.log('Insert error:', error.message);
    return null;
  }
  
  console.log('Miko registered!', data);
  return data;
}

async function main() {
  const connected = await testConnection();
  if (connected) {
    await insertTestAgent();
  }
}

main();

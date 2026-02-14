const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mmdmqhftpesjnynyhsyv.supabase.co';
const supabaseKey = 'REMOVED_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addAdminAgent() {
  const walletAddress = 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd';
  
  try {
    // Insert into agents table
    const { data, error } = await supabase
      .from('agents')
      .insert([
        {
          wallet_address: walletAddress,
          name: 'Preston',
          rank_title: 'Admin',
          xp: 1000,
          is_founding_swarm: true,
          trust_tier: 'admin'
        }
      ])
      .select();

    if (error) {
      console.error('Error inserting agent:', error);
      return;
    }

    console.log('✅ Agent added successfully:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

addAdminAgent();

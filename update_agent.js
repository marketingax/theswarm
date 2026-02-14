const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mmdmqhftpesjnynyhsyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAgent() {
  const walletAddress = 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd';
  
  try {
    const { data, error } = await supabase
      .from('agents')
      .update({
        is_verified: true,
        trust_tier: 'admin',
        rank_title: 'Admin'
      })
      .eq('wallet_address', walletAddress)
      .select();

    if (error) {
      console.error('Error updating agent:', error);
      return;
    }

    console.log('✅ Agent updated successfully:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

updateAgent();

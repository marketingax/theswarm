const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mmdmqhftpesjnynyhsyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupWallets() {
  const adminWallet = 'Fu7QnuVuGu1piks6FYeqp7GdP4P8MWjMeAeBbG5XYdUD';
  const agentWallet = 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd';
  
  try {
    // Step 1: Check if admin wallet exists
    const { data: adminData, error: adminCheckError } = await supabase
      .from('agents')
      .select('*')
      .eq('wallet_address', adminWallet);

    if (adminCheckError) {
      console.error('Error checking admin wallet:', adminCheckError);
      return;
    }

    if (adminData.length === 0) {
      // Create admin wallet entry
      console.log('Creating admin wallet entry...');
      const { data: newAdmin, error: newAdminError } = await supabase
        .from('agents')
        .insert([
          {
            wallet_address: adminWallet,
            name: 'Preston',
            rank_title: 'Admin',
            xp: 1000,
            is_founding_swarm: true,
            trust_tier: 'admin',
            is_verified: true
          }
        ])
        .select();

      if (newAdminError) {
        console.error('Error creating admin wallet:', newAdminError);
        return;
      }
      console.log('✅ Admin wallet created:', newAdmin[0].wallet_address);
    } else {
      // Update existing admin wallet
      console.log('Updating existing admin wallet...');
      const { data: updatedAdmin, error: updateAdminError } = await supabase
        .from('agents')
        .update({
          rank_title: 'Admin',
          trust_tier: 'admin',
          is_verified: true
        })
        .eq('wallet_address', adminWallet)
        .select();

      if (updateAdminError) {
        console.error('Error updating admin wallet:', updateAdminError);
        return;
      }
      console.log('✅ Admin wallet updated:', updatedAdmin[0].wallet_address);
    }

    // Step 2: Ensure agent wallet is set up correctly
    console.log('\nSetting up agent wallet...');
    const { data: agentData, error: agentCheckError } = await supabase
      .from('agents')
      .select('*')
      .eq('wallet_address', agentWallet);

    if (agentCheckError) {
      console.error('Error checking agent wallet:', agentCheckError);
      return;
    }

    if (agentData.length === 0) {
      // Create agent wallet entry
      const { data: newAgent, error: newAgentError } = await supabase
        .from('agents')
        .insert([
          {
            wallet_address: agentWallet,
            name: 'Miko',
            tagline: 'Superpowered teamwork. I build revenue engines.',
            framework: 'openclaw',
            xp: 2000,
            is_founding_swarm: true,
            trust_tier: 'normal',
            is_verified: true,
            rank_title: 'Worker'
          }
        ])
        .select();

      if (newAgentError) {
        console.error('Error creating agent wallet:', newAgentError);
        return;
      }
      console.log('✅ Agent wallet created:', newAgent[0].wallet_address);
    } else {
      // Update existing agent wallet to ensure verified
      const { data: updatedAgent, error: updateAgentError } = await supabase
        .from('agents')
        .update({
          is_verified: true,
          rank_title: 'Worker',
          trust_tier: 'normal'
        })
        .eq('wallet_address', agentWallet)
        .select();

      if (updateAgentError) {
        console.error('Error updating agent wallet:', updateAgentError);
        return;
      }
      console.log('✅ Agent wallet verified:', updatedAgent[0].wallet_address);
    }

    console.log('\n=== WALLET SETUP COMPLETE ===');
    console.log('Admin Wallet (Preston):', adminWallet.substring(0, 6) + '...' + adminWallet.substring(adminWallet.length - 4));
    console.log('Agent Wallet (Miko):', agentWallet.substring(0, 6) + '...' + agentWallet.substring(agentWallet.length - 4));
    console.log('You can now connect/disconnect between both wallets on The Swarm.');

  } catch (err) {
    console.error('Error:', err);
  }
}

setupWallets();

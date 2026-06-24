const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mmdmqhftpesjnynyhsyv.supabase.co';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupWallets() {
  const agentWallet = 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd';
  
  try {
    // Setup agent wallet (Miko only - no operator in agents table)
    console.log('Setting up agent wallet...');
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
      console.log('✓ Agent wallet created:', newAgent[0].wallet_address);
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
      console.log('✓ Agent wallet verified:', updatedAgent[0].wallet_address);
    }

    console.log('\n=== WALLET SETUP COMPLETE ===');
    console.log('Agent Wallet (Miko):', agentWallet.substring(0, 6) + '...' + agentWallet.substring(agentWallet.length - 4));
    console.log('Note: Operator wallet is NOT listed as an agent on The Swarm leaderboard.');

  } catch (err) {
    console.error('Error:', err);
  }
}

setupWallets();

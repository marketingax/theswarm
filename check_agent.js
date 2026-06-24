const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mmdmqhftpesjnynyhsyv.supabase.co';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgent() {
  const walletAddress = 'Hz6MqkncNL5UbPA4raYCoYpFac3ssa9Mjk5e8n9kDvCd';
  
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('wallet_address', walletAddress);

    if (error) {
      console.error('Error fetching agent:', error);
      return;
    }

    console.log('Agent record:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAgent();

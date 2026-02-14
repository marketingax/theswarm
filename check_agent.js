const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mmdmqhftpesjnynyhsyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

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

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import ora from 'ora';
import { getConfigDir, getConfigFile } from '../utils/config.js';

export const loginCommand = new Command('login')
  .description('Authenticate with your wallet or API key')
  .argument('<wallet>', 'Wallet address or API key')
  .action(async (wallet: string) => {
    const spinner = ora('Authenticating...').start();

    try {
      // Initialize Supabase client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmdmqhftpesjnynyhsyv.supabase.co';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Try to fetch agent by wallet
      const { data: agent, error } = await supabase
        .from('agents')
        .select('agent_id, name, wallet_address')
        .eq('wallet_address', wallet)
        .single();

      if (error || !agent) {
        spinner.fail('Agent not found. Please register at https://theswarm.chat/join');
        process.exit(1);
      }

      // Generate a token (in real app, this would be signed by the backend)
      const token = Buffer.from(JSON.stringify({
        agent_id: agent.agent_id,
        wallet: wallet,
        issued_at: new Date().toISOString()
      })).toString('base64');

      // Save token to config
      const configDir = getConfigDir();
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const configFile = getConfigFile();
      const config = {
        token,
        wallet,
        agent_id: agent.agent_id,
        agent_name: agent.name,
        logged_in_at: new Date().toISOString()
      };

      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      fs.chmodSync(configFile, 0o600); // Restrict permissions

      spinner.succeed(`Logged in as ${chalk.green(agent.name)} (${wallet.slice(0, 6)}...)`);
      console.log(chalk.gray(`Config saved to: ${configFile}`));
    } catch (error) {
      spinner.fail('Authentication failed');
      console.error(chalk.red(String(error)));
      process.exit(1);
    }
  });

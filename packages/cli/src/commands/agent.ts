import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import ora from 'ora';
import { getAuth } from '../utils/auth.js';

export const agentCommand = new Command('agent')
  .description('View agent information')
  .addCommand(
    new Command('stats')
      .description('Show agent XP, earnings, and trust tier')
      .action(showStats)
  )
  .addCommand(
    new Command('balance')
      .description('Show USD balance and withdrawal status')
      .action(showBalance)
  );

async function showStats() {
  const spinner = ora('Loading stats...').start();

  try {
    const auth = getAuth();
    if (!auth) {
      spinner.fail('Not logged in. Run: theswarm login <wallet>');
      process.exit(1);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmdmqhftpesjnynyhsyv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('agent_id', auth.agent_id)
      .single();

    if (error || !agent) {
      spinner.fail('Agent not found');
      process.exit(1);
    }

    spinner.stop();

    console.log('\n' + chalk.bold.cyan(`Agent: ${agent.name}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`XP:          ${chalk.yellow(agent.xp || 0)}`);
    console.log(`Trust Tier:  ${chalk.green(agent.trust_tier || 'Unranked')}`);
    console.log(`Earnings:    ${chalk.green('$' + (agent.usd_balance || 0).toFixed(2))}`);
    console.log(`Wallet:      ${chalk.gray(agent.wallet_address?.slice(0, 6) + '...' + agent.wallet_address?.slice(-4))}`);
    console.log(chalk.gray('─'.repeat(50)));

    // Get mission stats
    const { data: claims } = await supabase
      .from('claims')
      .select('status')
      .eq('agent_id', auth.agent_id);

    if (claims) {
      const submitted = claims.filter((c: any) => c.status === 'submitted').length;
      const verified = claims.filter((c: any) => c.status === 'verified').length;
      const rejected = claims.filter((c: any) => c.status === 'rejected').length;

      console.log(`\nClaims:`);
      console.log(`  Submitted: ${submitted}`);
      console.log(`  Verified:  ${chalk.green(verified)}`);
      console.log(`  Rejected:  ${chalk.red(rejected)}`);
    }

    console.log();
  } catch (error) {
    spinner.fail('Failed to load stats');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

async function showBalance() {
  const spinner = ora('Loading balance...').start();

  try {
    const auth = getAuth();
    if (!auth) {
      spinner.fail('Not logged in. Run: theswarm login <wallet>');
      process.exit(1);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmdmqhftpesjnynyhsyv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: agent, error } = await supabase
      .from('agents')
      .select('usd_balance, wallet_address')
      .eq('agent_id', auth.agent_id)
      .single();

    if (error || !agent) {
      spinner.fail('Agent not found');
      process.exit(1);
    }

    spinner.stop();

    console.log('\n' + chalk.bold.cyan('Balance'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Balance:     ${chalk.green('$' + (agent.usd_balance || 0).toFixed(2))}`);
    console.log(`Wallet:      ${chalk.gray(agent.wallet_address)}`);
    console.log(`Status:      ${chalk.blue('Ready to withdraw')}`);
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray('\nMinimum withdrawal: $10\n'));
  } catch (error) {
    spinner.fail('Failed to load balance');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getAuth } from '../utils/auth.js';
import { apiGet } from '../utils/api.js';

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

// All reads go through the public profile API — no DB key in the CLI.
async function loadProfile() {
  const auth = getAuth();
  if (!auth) {
    console.error(chalk.red('Not logged in. Run: theswarm login --secret <key>'));
    process.exit(1);
  }
  const res = await apiGet(`/api/agents/profile?wallet=${encodeURIComponent(auth.wallet)}`);
  if (!res.success || !res.agent) {
    console.error(chalk.red('Agent not found'));
    process.exit(1);
  }
  return res.agent;
}

async function showStats() {
  const spinner = ora('Loading stats...').start();
  try {
    const agent = await loadProfile();
    spinner.stop();
    console.log('\n' + chalk.bold.cyan(`Agent: ${agent.name}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`XP:          ${chalk.yellow(agent.xp || 0)}`);
    console.log(`Rank:        ${chalk.cyan(agent.rank_title || 'Drone')}`);
    console.log(`Trust Tier:  ${chalk.green(agent.trust_tier || 'probation')}`);
    console.log(`Missions:    ${agent.missions_completed || 0}`);
    console.log(`Earnings:    ${chalk.green('$' + (Number(agent.usd_balance) || 0).toFixed(2))}`);
    if (agent.wallet_address) {
      console.log(`Wallet:      ${chalk.gray(agent.wallet_address.slice(0, 6) + '...' + agent.wallet_address.slice(-4))}`);
    }
    console.log(chalk.gray('─'.repeat(50)) + '\n');
  } catch (error) {
    spinner.fail('Failed to load stats');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

async function showBalance() {
  const spinner = ora('Loading balance...').start();
  try {
    const agent = await loadProfile();
    spinner.stop();
    console.log('\n' + chalk.bold.cyan('Balance'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Available:   ${chalk.green('$' + (Number(agent.usd_balance) || 0).toFixed(2))}`);
    console.log(`Earned:      ${chalk.gray('$' + (Number(agent.total_earned) || 0).toFixed(2))}`);
    console.log(`XP:          ${chalk.yellow(agent.xp || 0)}`);
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray('\nMinimum withdrawal: $10\n'));
  } catch (error) {
    spinner.fail('Failed to load balance');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

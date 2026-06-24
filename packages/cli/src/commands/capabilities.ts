import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getAuth } from '../utils/auth.js';
import { apiGet, apiPost } from '../utils/api.js';

export const capabilitiesCommand = new Command('capabilities')
  .alias('caps')
  .description('Declare what this agent can do (used to match crew roles)')
  .addCommand(
    new Command('show')
      .description('Show your declared capabilities')
      .action(showCaps)
  )
  .addCommand(
    new Command('set')
      .description('Set your capabilities (replaces existing)')
      .argument('<caps...>', 'Space-separated capabilities, e.g. write_copy image_gen youtube_auth')
      .action(setCaps)
  );

async function showCaps() {
  const auth = getAuth();
  if (!auth) { console.error(chalk.red('Not logged in. Run: theswarm login <wallet>')); process.exit(1); }
  const spinner = ora('Loading capabilities...').start();
  try {
    const res = await apiGet(`/api/agents/capabilities?agent_id=${encodeURIComponent(auth.agent_id)}`);
    spinner.stop();
    console.log('\n' + chalk.bold.cyan(res.name || 'You'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Capabilities: ${res.capabilities?.length ? res.capabilities.map((c: string) => chalk.green(c)).join(', ') : chalk.gray('(none declared)')}`);
    console.log(`Collaboration score: ${chalk.yellow(res.collaboration_score)}`);
    console.log(`Crews completed: ${chalk.yellow(res.crew_missions_completed)}`);
    console.log();
  } catch (e) {
    spinner.fail('Failed to load capabilities');
    console.error(chalk.red(String(e))); process.exit(1);
  }
}

async function setCaps(caps: string[]) {
  const auth = getAuth();
  if (!auth) { console.error(chalk.red('Not logged in. Run: theswarm login <wallet>')); process.exit(1); }
  const spinner = ora('Saving capabilities...').start();
  try {
    const res = await apiPost('/api/agents/capabilities', { capabilities: caps });
    spinner.succeed(chalk.green(res.message || 'Capabilities updated'));
    console.log(chalk.gray(res.capabilities.join(', ')));
  } catch (e) {
    spinner.fail('Failed to update capabilities');
    console.error(chalk.red(String(e))); process.exit(1);
  }
}

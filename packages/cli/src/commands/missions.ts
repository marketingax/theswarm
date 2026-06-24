import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { execSync } from 'child_process';
import { getAuth } from '../utils/auth.js';
import { apiGet, apiPost } from '../utils/api.js';

export const missionsCommand = new Command('missions')
  .description('Manage missions')
  .addCommand(
    new Command('list')
      .description('List available missions')
      .option('--type <type>', 'Filter by mission type')
      .option('--sort <field>', 'Sort by field (xp|reward)', 'xp')
      .action(listMissions)
  )
  .addCommand(
    new Command('get')
      .description('View mission details')
      .argument('<id>', 'Mission ID')
      .action(getMission)
  )
  .addCommand(
    new Command('match')
      .description('List active missions YOUR capabilities can complete')
      .action(matchMissions)
  )
  .addCommand(
    new Command('auto')
      .description('AUTONOMOUS WORKER: discover, claim, do and submit matching missions')
      .option('--max <n>', 'Max missions to work this run', '5')
      .option('--executor <cmd>', 'Command to perform the action; receives "<mission_type> <target_url>" and must print a proof URL to stdout')
      .option('--proof <url>', 'Static proof URL to submit when no executor is set')
      .option('--dry-run', 'Show what would be worked without claiming')
      .action(autoWork)
  );

async function listMissions(options: any) {
  const spinner = ora('Loading missions...').start();
  try {
    const qs = new URLSearchParams({ status: 'active' });
    if (options.type) qs.set('type', options.type);
    const res = await apiGet(`/api/missions?${qs.toString()}`);
    const missions: any[] = res.missions || [];

    if (missions.length === 0) {
      spinner.stop();
      console.log(chalk.yellow('No missions available'));
      return;
    }

    const sorted = missions.sort((a, b) =>
      options.sort === 'reward'
        ? (b.usd_reward || 0) - (a.usd_reward || 0)
        : (b.xp_reward || 0) - (a.xp_reward || 0)
    );

    spinner.stop();
    const missionTable = table([
      ['ID', 'Type', 'XP', 'USD', 'Progress', 'Status'],
      ...sorted.map((m: any) => [
        String(m.id).slice(0, 8),
        m.mission_type || m.type || 'general',
        chalk.yellow(String(m.xp_reward || 0)),
        chalk.green('$' + String(m.usd_reward || 0)),
        `${m.current_count || 0}/${m.target_count || 1}`,
        chalk.blue(m.status),
      ]),
    ]);
    console.log('\n' + missionTable);
    console.log(chalk.gray(`\nRun: theswarm missions get <id> | theswarm missions auto\n`));
  } catch (error) {
    spinner.fail('Failed to load missions');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

async function getMission(id: string) {
  const spinner = ora('Loading mission...').start();
  try {
    const res = await apiGet(`/api/missions/${encodeURIComponent(id)}`);
    const mission = res.mission;
    spinner.stop();

    console.log('\n' + chalk.bold.cyan(`Mission ${mission.id}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Type:        ${mission.mission_type || mission.type || 'general'}`);
    console.log(`Target:      ${mission.target_name || mission.title || '—'}`);
    console.log(`Progress:    ${mission.current_count || 0}/${mission.target_count || 1}`);
    console.log(`XP Reward:   ${chalk.yellow(mission.xp_reward || 0)}`);
    console.log(`USD Reward:  ${chalk.green('$' + (mission.usd_reward || 0))}`);
    console.log(`Status:      ${chalk.blue(mission.status)}`);
    if (mission.instructions) console.log(`\nInstructions:\n${mission.instructions}`);
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`\nWork it: theswarm missions auto  (or claim manually in the app)\n`);
  } catch (error) {
    spinner.fail('Mission not found');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

// Show active missions this agent is capable of (server-side capability match).
async function matchMissions() {
  const auth = getAuth();
  if (!auth) { console.error(chalk.red('Not logged in. Run: theswarm login <wallet>')); process.exit(1); }
  const spinner = ora('Matching missions to your capabilities...').start();
  try {
    const res = await apiGet(`/api/missions/match?agent_id=${encodeURIComponent(auth.agent_id)}`);
    spinner.stop();
    if (!res.matches?.length) {
      console.log(chalk.yellow('No active missions match your capabilities.'));
      console.log(chalk.gray('Declare skills with: theswarm capabilities set <type...>  (e.g. youtube_subscribe)\n'));
      return;
    }
    const t = table([
      ['Mission', 'Type', 'Slots left', 'XP', 'USD'],
      ...res.matches.map((m: any) => [
        `#${m.mission_id} ${(m.target_name || '').slice(0, 22)}`,
        m.mission_type,
        String(m.slots_left),
        chalk.yellow(String(m.xp_reward)),
        chalk.green('$' + m.usd_reward),
      ]),
    ]);
    console.log('\n' + t);
    console.log(chalk.gray('Work them autonomously: theswarm missions auto\n'));
  } catch (e) { spinner.fail('Failed to match missions'); console.error(chalk.red(String(e))); process.exit(1); }
}

// AUTONOMOUS WORKER — the "agents accomplish things on their own" loop.
// Discover matching missions -> claim a slot -> perform the action -> submit proof.
//
// The platform action itself is performed by an operator-supplied --executor so
// each agent acts through ITS OWN authenticated account. You are responsible for
// keeping that executor within each platform's Terms of Service (authentic,
// account-holder-initiated actions only — no metric manipulation).
async function autoWork(options: any) {
  const auth = getAuth();
  if (!auth) { console.error(chalk.red('Not logged in. Run: theswarm login <wallet>')); process.exit(1); }
  const max = parseInt(options.max, 10) || 5;

  const spinner = ora('Scanning for missions you can complete...').start();
  let matches: any[] = [];
  try {
    const res = await apiGet(`/api/missions/match?agent_id=${encodeURIComponent(auth.agent_id)}`);
    matches = (res.matches || []).slice(0, max);
  } catch (e) { spinner.fail('Discovery failed'); console.error(chalk.red(String(e))); process.exit(1); }
  spinner.stop();

  if (!matches.length) { console.log(chalk.yellow('Nothing to work right now.')); return; }

  if (options.dryRun) {
    console.log(chalk.cyan(`\nWould work ${matches.length} mission(s):`));
    matches.forEach((m) => console.log(`  • #${m.mission_id} ${m.mission_type} — ${m.target_name} (${m.slots_left} slots, ${m.xp_reward} XP)`));
    console.log();
    return;
  }

  let done = 0;
  for (const m of matches) {
    try {
      // 1. Claim a slot
      const claimRes = await apiPost('/api/missions/claim', { mission_id: m.mission_id });
      const claimId = claimRes.claim?.id;
      console.log(chalk.gray(`· Claimed #${m.mission_id} (${m.mission_type})`));

      // 2. Perform the action through this agent's own account
      let proofUrl = options.proof || m.target_url;
      if (options.executor) {
        try {
          const out = execSync(`${options.executor} ${m.mission_type} ${m.target_url}`, { encoding: 'utf-8', timeout: 120000 }).trim();
          if (out) proofUrl = out.split('\n').pop()!.trim();
        } catch (e) {
          console.log(chalk.red(`  ✗ Executor failed for #${m.mission_id}, skipping submit`));
          continue;
        }
      }

      // 3. Submit proof
      await apiPost('/api/missions/submit', { claim_id: claimId, proof_url: proofUrl });
      console.log(chalk.green(`  ✓ Completed #${m.mission_id} — submitted proof`));
      done++;
    } catch (e) {
      console.log(chalk.gray(`· Skipped #${m.mission_id} (${String(e).replace('Error: ', '')})`));
    }
  }
  console.log(chalk.bold(`\nWorked ${done}/${matches.length} mission(s). Check: theswarm agent stats\n`));
}

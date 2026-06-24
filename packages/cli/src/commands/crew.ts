import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import * as fs from 'fs';
import { getAuth } from '../utils/auth.js';
import { apiGet, apiPost } from '../utils/api.js';

export const crewCommand = new Command('crew')
  .description('Collaborative crew missions — team up, split the pot')
  .addCommand(
    new Command('list')
      .description('Browse open crews on the board')
      .option('--status <status>', 'recruiting | in_progress | completed | all', 'recruiting')
      .option('--reward <type>', 'Filter by reward type: xp | usd')
      .action(listCrews)
  )
  .addCommand(
    new Command('get')
      .description('View a crew, its roles, shares and members')
      .argument('<id>', 'Crew ID')
      .action(getCrew)
  )
  .addCommand(
    new Command('match')
      .description('Show open roles YOUR capabilities can fill')
      .action(matchRoles)
  )
  .addCommand(
    new Command('join')
      .description('Claim a role in a crew')
      .argument('<crew-id>', 'Crew ID')
      .argument('<subtask-id>', 'Role (subtask) ID')
      .action(joinCrew)
  )
  .addCommand(
    new Command('submit')
      .description('Submit proof for a role you hold')
      .argument('<crew-id>', 'Crew ID')
      .argument('<subtask-id>', 'Role (subtask) ID')
      .argument('<proof-url>', 'Proof URL / link')
      .action(submitRole)
  )
  .addCommand(
    new Command('create')
      .description('Create a crew from a JSON spec file')
      .argument('<file>', 'Path to crew JSON spec')
      .action(createCrew)
  )
  .addCommand(
    new Command('auto')
      .description('AUTOPILOT: auto-claim every open role you are capable of')
      .option('--max <n>', 'Max roles to claim this run', '3')
      .option('--dry-run', 'Show what would be claimed without claiming')
      .action(autoPilot)
  );

async function listCrews(options: any) {
  const spinner = ora('Loading crews...').start();
  try {
    const qs = new URLSearchParams({ status: options.status });
    if (options.reward) qs.set('reward_type', options.reward);
    const res = await apiGet(`/api/crews?${qs.toString()}`);
    spinner.stop();
    if (!res.crews?.length) { console.log(chalk.yellow('No crews found.')); return; }
    const t = table([
      ['ID', 'Title', 'Reward', 'Pot', 'Roles (open/done/total)', 'Status'],
      ...res.crews.map((c: any) => [
        String(c.id),
        c.title?.slice(0, 28) || '',
        c.reward_type,
        c.reward_type === 'usd' ? chalk.green('$' + c.usd_pot) : chalk.yellow(c.xp_pot + ' XP'),
        `${c.open_roles}/${c.done_roles}/${c.total_roles}`,
        chalk.blue(c.status),
      ]),
    ]);
    console.log('\n' + t);
    console.log(chalk.gray('Run: theswarm crew get <id>  |  theswarm crew match\n'));
  } catch (e) { spinner.fail('Failed to load crews'); console.error(chalk.red(String(e))); process.exit(1); }
}

async function getCrew(id: string) {
  const spinner = ora('Loading crew...').start();
  try {
    const res = await apiGet(`/api/crews/${id}`);
    const c = res.crew;
    spinner.stop();
    console.log('\n' + chalk.bold.cyan(`Crew #${c.id}: ${c.title}`));
    console.log(chalk.gray('─'.repeat(60)));
    if (c.description) console.log(c.description + '\n');
    console.log(`Reward:  ${c.reward_type === 'usd' ? chalk.green('$' + c.pot) : chalk.yellow(c.pot + ' XP')}   Status: ${chalk.blue(c.status)}`);
    console.log(`Members: ${c.members?.length || 0}\n`);
    const t = table([
      ['Role ID', 'Title', 'Needs', 'Share', 'Worth', 'Status', 'Held by'],
      ...c.subtasks.map((s: any) => [
        String(s.id),
        s.title?.slice(0, 24) || '',
        s.required_capability || chalk.gray('any'),
        s.share_pct + '%',
        c.reward_type === 'usd' ? '$' + s.share_value : s.share_value + ' XP',
        statusColor(s.status),
        s.assigned_agent_id ? s.assigned_agent_id.slice(0, 8) : chalk.gray('open'),
      ]),
    ]);
    console.log(t);
    console.log(chalk.gray(`\nJoin a role: theswarm crew join ${c.id} <role-id>\n`));
  } catch (e) { spinner.fail('Failed to load crew'); console.error(chalk.red(String(e))); process.exit(1); }
}

function statusColor(s: string): string {
  if (s === 'verified') return chalk.green(s);
  if (s === 'open') return chalk.gray(s);
  if (s === 'rejected') return chalk.red(s);
  return chalk.blue(s);
}

async function matchRoles() {
  const auth = getAuth();
  if (!auth) { console.error(chalk.red('Not logged in. Run: theswarm login <wallet>')); process.exit(1); }
  const spinner = ora('Matching roles to your capabilities...').start();
  try {
    const res = await apiGet(`/api/crews/match?agent_id=${encodeURIComponent(auth.agent_id)}`);
    spinner.stop();
    if (!res.matches?.length) { console.log(chalk.yellow('No open roles match your capabilities right now.')); return; }
    const t = table([
      ['Crew', 'Role', 'Needs', 'Share', 'Est. reward', 'Join'],
      ...res.matches.map((m: any) => [
        `#${m.crew_id} ${m.crew_title?.slice(0, 18) || ''}`,
        m.role_title?.slice(0, 22) || '',
        m.required_capability || chalk.gray('any'),
        m.share_pct + '%',
        m.reward_type === 'usd' ? chalk.green('$' + m.estimated_reward) : chalk.yellow(m.estimated_reward + ' XP'),
        chalk.gray(`crew join ${m.crew_id} ${m.subtask_id}`),
      ]),
    ]);
    console.log('\n' + t + '\n');
  } catch (e) { spinner.fail('Failed to match roles'); console.error(chalk.red(String(e))); process.exit(1); }
}

async function joinCrew(crewId: string, subtaskId: string) {
  const spinner = ora('Claiming role...').start();
  try {
    const res = await apiPost(`/api/crews/${crewId}/join`, { subtask_id: parseInt(subtaskId, 10) });
    spinner.succeed(chalk.green(res.message));
    console.log(chalk.gray(`Submit when done: theswarm crew submit ${crewId} ${subtaskId} <proof-url>\n`));
  } catch (e) { spinner.fail('Failed to claim role'); console.error(chalk.red(String(e))); process.exit(1); }
}

async function submitRole(crewId: string, subtaskId: string, proofUrl: string) {
  const spinner = ora('Submitting proof...').start();
  try {
    const res = await apiPost(`/api/crews/${crewId}/submit`, { subtask_id: parseInt(subtaskId, 10), proof_url: proofUrl });
    spinner.succeed(chalk.green(res.message));
    if (res.settled) console.log(chalk.bold.green('💰 Crew complete — pot split to all members!'));
  } catch (e) { spinner.fail('Failed to submit proof'); console.error(chalk.red(String(e))); process.exit(1); }
}

async function createCrew(file: string) {
  const spinner = ora('Creating crew...').start();
  try {
    if (!fs.existsSync(file)) throw new Error(`Spec file not found: ${file}`);
    const spec = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const res = await apiPost('/api/crews', spec);
    spinner.succeed(chalk.green(`Crew #${res.crew.id} created — ${res.escrowed} ${res.crew.reward_type.toUpperCase()} escrowed`));
    console.log(chalk.gray(`Share it: theswarm crew get ${res.crew.id}\n`));
  } catch (e) { spinner.fail('Failed to create crew'); console.error(chalk.red(String(e))); process.exit(1); }
}

// AUTOPILOT — the agent-to-agent unlock. An agent runs this on a loop to
// discover and claim work it's capable of, with no human in the loop.
async function autoPilot(options: any) {
  const auth = getAuth();
  if (!auth) { console.error(chalk.red('Not logged in. Run: theswarm login <wallet>')); process.exit(1); }
  const max = parseInt(options.max, 10) || 3;
  const spinner = ora('Scanning the swarm for work you can do...').start();
  try {
    const res = await apiGet(`/api/crews/match?agent_id=${encodeURIComponent(auth.agent_id)}`);
    spinner.stop();
    const matches = (res.matches || []).slice(0, max);
    if (!matches.length) { console.log(chalk.yellow('Nothing to claim right now.')); return; }

    if (options.dryRun) {
      console.log(chalk.cyan(`\nWould claim ${matches.length} role(s):`));
      matches.forEach((m: any) => console.log(`  • Crew #${m.crew_id} "${m.role_title}" (${m.share_pct}%, ~${m.estimated_reward} ${m.reward_type})`));
      console.log();
      return;
    }

    let claimed = 0;
    for (const m of matches) {
      try {
        await apiPost(`/api/crews/${m.crew_id}/join`, { subtask_id: m.subtask_id });
        console.log(chalk.green(`✓ Claimed "${m.role_title}" in crew #${m.crew_id} (${m.share_pct}% share)`));
        claimed++;
      } catch (e) {
        console.log(chalk.gray(`· Skipped role ${m.subtask_id} (${String(e).replace('Error: ', '')})`));
      }
    }
    console.log(chalk.bold(`\nClaimed ${claimed} role(s). Do the work, then: theswarm crew submit <crew> <role> <proof>\n`));
  } catch (e) { spinner.fail('Autopilot failed'); console.error(chalk.red(String(e))); process.exit(1); }
}

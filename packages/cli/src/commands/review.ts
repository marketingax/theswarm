import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { getAuth } from '../utils/auth.js';
import { apiGet, apiPost } from '../utils/api.js';

export const reviewCommand = new Command('review')
  .description('Peer-review other agents\' work and earn XP')
  .addCommand(
    new Command('queue')
      .description('Show submissions awaiting your review')
      .action(showQueue)
  )
  .addCommand(
    new Command('vote')
      .description('Approve or reject a submission')
      .argument('<target-type>', "'claim' or 'crew_subtask'")
      .argument('<target-id>', 'Target ID')
      .argument('<vote>', "'approve' or 'reject'")
      .argument('[comment]', 'Optional comment')
      .action(vote)
  );

async function showQueue() {
  const auth = getAuth();
  if (!auth) { console.error(chalk.red('Not logged in. Run: theswarm login --secret <key>')); process.exit(1); }
  const spinner = ora('Loading review queue...').start();
  try {
    const res = await apiGet(`/api/reviews/queue?agent_id=${encodeURIComponent(auth.agent_id)}`);
    spinner.stop();
    if (!res.queue?.length) { console.log(chalk.yellow('Nothing to review right now.')); return; }
    const t = table([
      ['Type', 'ID', 'Title', 'Proof', 'Votes', 'Vote command'],
      ...res.queue.map((i: any) => [
        i.target_type,
        i.target_id,
        (i.title || '').slice(0, 22),
        (i.proof_url || '').slice(0, 26),
        `${i.votes.approve}✓/${i.votes.reject}✗`,
        chalk.gray(`review vote ${i.target_type} ${i.target_id} approve`),
      ]),
    ]);
    console.log('\n' + t + '\n');
  } catch (e) { spinner.fail('Failed to load queue'); console.error(chalk.red(String(e))); process.exit(1); }
}

async function vote(targetType: string, targetId: string, voteVal: string, comment?: string) {
  const spinner = ora('Recording vote...').start();
  try {
    const res = await apiPost('/api/reviews', { target_type: targetType, target_id: targetId, vote: voteVal, comment });
    spinner.succeed(chalk.green(res.message));
    if (res.finalized) console.log(chalk.bold(res.finalized === 'verified' ? '✅ Submission verified & paid.' : '❌ Submission rejected & slashed.'));
  } catch (e) { spinner.fail('Failed to vote'); console.error(chalk.red(String(e))); process.exit(1); }
}

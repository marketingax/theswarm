import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getAuth } from '../utils/auth.js';
import { apiPost } from '../utils/api.js';

export const claimCommand = new Command('claim')
  .description('Manage claims')
  .addCommand(
    new Command('submit')
      .description('Claim a mission and submit proof in one step')
      .argument('<mission-id>', 'Mission ID')
      .argument('<proof-url>', 'Proof URL or link')
      .action(submitClaim)
  );

// Routes through the authenticated API so escrow, audit and verification all
// run. (Previously this wrote straight into the claims table with a DB key,
// bypassing every check — removed.)
async function submitClaim(missionId: string, proofUrl: string) {
  const auth = getAuth();
  if (!auth) {
    console.error(chalk.red('Not logged in. Run: theswarm login --secret <key>'));
    process.exit(1);
  }

  const spinner = ora('Claiming mission...').start();
  try {
    // 1. Claim a slot (creates escrowed claim).
    const claimRes = await apiPost('/api/missions/claim', { mission_id: missionId });
    const claimId = claimRes.claim?.id;
    if (!claimId) {
      spinner.fail(claimRes.error || 'Failed to claim mission');
      process.exit(1);
    }

    // 2. Submit proof for verification.
    spinner.text = 'Submitting proof...';
    const subRes = await apiPost('/api/missions/submit', { claim_id: claimId, proof_url: proofUrl });

    spinner.succeed(chalk.green(subRes.message || 'Proof submitted'));
    if (subRes.audit?.auto_approved) console.log(chalk.gray('Auto-approved — reward released.'));
    else console.log(chalk.gray('Queued for verification.'));
    console.log(chalk.gray('\nCheck status: theswarm agent stats\n'));
  } catch (error) {
    spinner.fail('Failed to submit claim');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

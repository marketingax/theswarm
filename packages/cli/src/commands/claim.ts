import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import ora from 'ora';
import { getAuth } from '../utils/auth.js';

export const claimCommand = new Command('claim')
  .description('Manage claims')
  .addCommand(
    new Command('submit')
      .description('Submit a claim for a mission')
      .argument('<mission-id>', 'Mission ID')
      .argument('<proof-url>', 'Proof URL or link')
      .action(submitClaim)
  );

async function submitClaim(missionId: string, proofUrl: string) {
  const spinner = ora('Submitting claim...').start();

  try {
    const auth = getAuth();
    if (!auth) {
      spinner.fail('Not logged in. Run: theswarm login <wallet>');
      process.exit(1);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmdmqhftpesjnynyhsyv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create claim record
    const { data: claim, error } = await supabase
      .from('claims')
      .insert({
        mission_id: parseInt(missionId),
        agent_id: auth.agent_id,
        proof_url: proofUrl,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    spinner.succeed(chalk.green(`Claim submitted! ID: ${claim.id}`));
    console.log(chalk.gray(`\nStatus: ${claim.status}`));
    console.log(chalk.gray(`Submitted: ${new Date(claim.submitted_at).toLocaleString()}`));
    console.log(chalk.gray(`\nCheck status: theswarm agent stats\n`));
  } catch (error) {
    spinner.fail('Failed to submit claim');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

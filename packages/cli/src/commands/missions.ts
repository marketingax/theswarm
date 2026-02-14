import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { getAuth } from '../utils/auth.js';

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
  );

async function listMissions(options: any) {
  const spinner = ora('Loading missions...').start();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmdmqhftpesjnynyhsyv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('missions')
      .select('*')
      .eq('status', 'active');

    if (options.type) {
      query = query.eq('mission_type', options.type);
    }

    const { data: missions, error } = await query;

    if (error) throw error;

    if (!missions || missions.length === 0) {
      spinner.stop();
      console.log(chalk.yellow('No missions available'));
      return;
    }

    // Sort missions
    const sorted = missions.sort((a: any, b: any) => {
      if (options.sort === 'reward') {
        return (b.usd_reward || 0) - (a.usd_reward || 0);
      }
      return (b.xp_reward || 0) - (a.xp_reward || 0);
    });

    spinner.stop();

    // Format table
    const missionTable = table([
      ['ID', 'Type', 'XP Reward', 'USD Reward', 'Status'],
      ...sorted.map((m: any) => [
        String(m.id),
        m.mission_type || 'general',
        chalk.yellow(String(m.xp_reward || 0)),
        chalk.green('$' + String(m.usd_reward || 0)),
        chalk.blue(m.status)
      ])
    ]);

    console.log('\n' + missionTable);
    console.log(chalk.gray(`\nRun: theswarm missions get <id> for details\n`));
  } catch (error) {
    spinner.fail('Failed to load missions');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

async function getMission(id: string) {
  const spinner = ora('Loading mission...').start();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmdmqhftpesjnynyhsyv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZG1xaGZ0cGVzam55bnloc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwODY5MywiZXhwIjoyMDg2MTg0NjkzfQ.DbNi1XnO7NlifCleBNArKMmsB8nx9jaQa9YxChHs7ik';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: mission, error } = await supabase
      .from('missions')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error || !mission) {
      spinner.fail('Mission not found');
      process.exit(1);
    }

    spinner.stop();

    console.log('\n' + chalk.bold.cyan(`Mission #${mission.id}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Type:        ${mission.mission_type || 'general'}`);
    console.log(`XP Reward:   ${chalk.yellow(mission.xp_reward || 0)}`);
    console.log(`USD Reward:  ${chalk.green('$' + (mission.usd_reward || 0))}`);
    console.log(`Status:      ${chalk.blue(mission.status)}`);
    if (mission.description) {
      console.log(`\nDescription:\n${mission.description}`);
    }
    if (mission.instructions) {
      console.log(`\nInstructions:\n${mission.instructions}`);
    }
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`\nSubmit proof: theswarm claim submit ${mission.id} <proof-url>\n`);
  } catch (error) {
    spinner.fail('Failed to load mission');
    console.error(chalk.red(String(error)));
    process.exit(1);
  }
}

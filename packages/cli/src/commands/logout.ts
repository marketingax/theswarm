import { Command } from 'commander';
import * as fs from 'fs';
import chalk from 'chalk';
import { getConfigFile } from '../utils/config.js';

export const logoutCommand = new Command('logout')
  .description('Clear saved authentication token')
  .action(() => {
    try {
      const configFile = getConfigFile();
      if (fs.existsSync(configFile)) {
        fs.unlinkSync(configFile);
        console.log(chalk.green('✓ Logged out successfully'));
      } else {
        console.log(chalk.yellow('Not logged in'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to logout: ' + String(error)));
      process.exit(1);
    }
  });

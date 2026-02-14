#!/usr/bin/env node

import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { missionsCommand } from './commands/missions.js';
import { claimCommand } from './commands/claim.js';
import { agentCommand } from './commands/agent.js';

const program = new Command();

program
  .name('theswarm')
  .description('The Swarm CLI - Manage agents and missions')
  .version('1.0.0');

// Auth commands
program.addCommand(loginCommand);
program.addCommand(logoutCommand);

// Mission commands
program.addCommand(missionsCommand);

// Claim commands
program.addCommand(claimCommand);

// Agent commands
program.addCommand(agentCommand);

program.parse();

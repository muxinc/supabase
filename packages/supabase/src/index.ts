import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import packageJson from '../package.json';
import { queueWorkflowsForEvent } from './workflows/index.ts';

export { queueWorkflowsForEvent }

const program = new Command();

program
  .name('mux-supabase')
  .description('CLI tool to initialize Mux Sync Engine with Supabase')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize Mux Sync Engine with Supabase')
  .action(initCommand);

program.parse();

import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import packageJson from '../package.json'

const program = new Command()

program
  .name('mux-sync-supabase')
  .description('CLI tool to initialize Mux Sync Engine with Supabase')
  .version(packageJson.version)

program
  .command('init')
  .description('Initialize Mux Sync Engine with Supabase')
  .action(initCommand)

program.parse() 
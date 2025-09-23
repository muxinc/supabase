import chalk from 'chalk';
import fs from 'node:fs';

const supabaseDir = 'supabase';

export function checkIfSupabaseDirExists() {
  if (!fs.existsSync(supabaseDir)) {
    console.error(chalk.red('❌ Error: Supabase directory not found!'));
    console.log(
      chalk.yellow(
        '\nThis command must be run from a Supabase project root directory.'
      )
    );
    console.log(
      chalk.gray(
        'Make sure you have a "supabase" folder in your current directory.'
      )
    );
    console.log(chalk.gray("\nIf you haven't initialized Supabase yet, run:"));
    console.log(chalk.cyan('  supabase init'));
    process.exit(1);
  }
  console.log(chalk.green('✅ Found Supabase directory'));
}

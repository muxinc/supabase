import chalk from 'chalk';
import fs from 'node:fs';
import ora from 'ora';
import path from 'node:path';

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

export async function createMigrationFiles(
  migrations: { name: string; content: string }[]
): Promise<void> {
  const spinner = ora('\nCreating migration files...\n').start();

  const migrationsDir = path.join(supabaseDir, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  let timestampCounter = 0;
  const baseTimestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);

  const generateUniqueTimestamp = () => {
    const timestamp = baseTimestamp + String(timestampCounter).padStart(2, '0');
    timestampCounter++;
    return timestamp;
  };

  let createdCount = 0;
  let skippedCount = 0;

  for (const migration of migrations) {
    const existingFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(`_${migration.name}.sql`));

    if (existingFiles.length > 0) {
      spinner.warn(`Migration already exists, skipping: ${existingFiles[0]}`);
      skippedCount++;
      continue;
    }

    const filename = `${generateUniqueTimestamp()}_${migration.name}.sql`;
    const fullPath = path.join(migrationsDir, filename);
    fs.writeFileSync(fullPath, migration.content, 'utf-8');
    spinner.info(`Created migration: ${filename}`);
    createdCount++;
  }

  if (createdCount > 0 && skippedCount > 0) {
    spinner.succeed(
      `Migrations completed: ${createdCount} created, ${skippedCount} skipped`
    );
  } else if (createdCount > 0) {
    spinner.succeed(
      `Migration files created successfully (${createdCount} files)`
    );
  } else if (skippedCount > 0) {
    spinner.succeed(
      `All migration files already exist (${skippedCount} files skipped)`
    );
  } else {
    spinner.succeed('Migrations check completed');
  }
}

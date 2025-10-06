import chalk from 'chalk';
import fs from 'node:fs';
import ora from 'ora';
import path from 'node:path';
import inquirer from 'inquirer';
import { setTimeout, clearTimeout } from 'node:timers';

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

export async function promptForDatabaseUrl(): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'databaseUrl',
      message:
        'Enter your Supabase database URL:\n' +
        '(This value is shown as DB URL when running: ' +
        chalk.cyan('supabase start)') +
        chalk.gray(
          '\n💡 Tip: For production development, Click the "Connect" button in the Supabase dashboard\n' +
            'and use the "Session pooler" option toward the bottom. Replace [YOUR-PASSWORD]\n' +
            'with the database password you configured when setting up your project'
        ),
      validate: (input: string) => {
        if (!input) return 'Database URL is required';
        if (!input.includes('postgresql://'))
          return 'Please enter a valid PostgreSQL connection string';
        return true;
      },
    },
  ]);

  return answers.databaseUrl;
}

function getMigrationsPath(): string {
  try {
    const packageJsonPath = require.resolve('@mux/sync-engine/package.json');
    const packageDir = path.dirname(packageJsonPath);
    const migrationsPath = path.join(packageDir, 'dist', 'migrations');

    if (!fs.existsSync(migrationsPath)) {
      throw new Error(`Migrations directory not found at: ${migrationsPath}`);
    }

    return migrationsPath;
  } catch (error) {
    throw new Error(
      `Failed to locate migrations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function getMigrationFilesFromSyncEngine(): {
  name: string;
  content: string;
}[] {
  const migrationsPath = getMigrationsPath();

  if (!fs.existsSync(migrationsPath)) {
    console.log(
      chalk.yellow(`Migrations directory not found: ${migrationsPath}`)
    );
    return [];
  }

  const migrationFiles = fs
    .readdirSync(migrationsPath)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const migrations: { name: string; content: string }[] = [];

  for (const file of migrationFiles) {
    const fullPath = path.join(migrationsPath, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    // Remove the timestamp and .sql extension to get a clean name
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
    migrations.push({ name, content });
  }

  return migrations;
}

export async function createMigrationFilesWithSupabaseCli(
  migrations: { name: string; content: string }[]
): Promise<void> {
  const { spawn } = require('node:child_process');
  const spinner = ora(
    '\nCreating migration files using Supabase CLI...\n'
  ).start();

  const migrationsDir = path.join(supabaseDir, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

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

    try {
      spinner.text = `Creating migration: ${migration.name}`;

      // Use Supabase CLI to create a new migration file
      const migrationName = migration.name;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          reject(
            new Error(
              `Timeout: supabase migration new ${migrationName} took too long`
            )
          );
        }, 30000); // 30 second timeout

        const child = spawn('supabase', ['migration', 'new', migrationName], {
          stdio: 'pipe',
          cwd: process.cwd(),
          env: { ...process.env, SUPABASE_DISABLE_TELEMETRY: 'true' },
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(
              new Error(
                `Supabase CLI error (code ${code}): ${stderr || stdout}`
              )
            );
          }
        });

        child.on('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Failed to spawn supabase CLI: ${error.message}`));
        });
      });

      // Find the newly created migration file
      const newFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(`_${migration.name}.sql`))
        .sort();

      if (newFiles.length > 0) {
        const newFilePath = path.join(
          migrationsDir,
          newFiles[newFiles.length - 1]
        );
        // Replace the empty file contents with the actual migration content
        fs.writeFileSync(newFilePath, migration.content, 'utf-8');
        spinner.succeed(`Created migration: ${newFiles[newFiles.length - 1]}`);
        createdCount++;
      } else {
        spinner.warn(
          `Could not find created migration file for: ${migration.name}`
        );
      }
    } catch (error) {
      spinner.warn(
        `Failed to create migration ${migration.name}: ${error instanceof Error ? error.message : String(error)}`
      );
      // Fall back to direct file creation if CLI fails
      spinner.text = `Falling back to direct file creation for: ${migration.name}`;
      try {
        const timestamp = new Date()
          .toISOString()
          .replace(/[-:T.Z]/g, '')
          .slice(0, 14);
        const filename = `${timestamp}_${migration.name}.sql`;
        const fullPath = path.join(migrationsDir, filename);
        fs.writeFileSync(fullPath, migration.content, 'utf-8');
        spinner.succeed(`Created migration (fallback): ${filename}`);
        createdCount++;
      } catch (fallbackError) {
        spinner.fail(
          `Failed to create migration ${migration.name} even with fallback: ${fallbackError}`
        );
      }
    }
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

export function createFunctionsEnvFile(): void {
  const functionsEnvPath = path.join(supabaseDir, 'functions', '.env');
  if (!fs.existsSync(functionsEnvPath)) {
    const envContent = `# Used to develop Edge Functions locally.\n# Configure the secrets required by the mux-webhook function.\nMUX_TOKEN_ID=your-mux-token-id\nMUX_TOKEN_SECRET=your-mux-token-secret\nMUX_WEBHOOK_SECRET=your-mux-webhook-secret\n`;
    fs.writeFileSync(functionsEnvPath, envContent);
    console.log(chalk.green('✅ Created supabase/functions/.env'));
  } else {
    console.log(
      chalk.gray('supabase/functions/.env already exists. Skipping creation.')
    );
  }
}

export async function shouldOverwriteFunction(
  functionDir: string,
  functionName: string
): Promise<boolean> {
  if (!fs.existsSync(functionDir)) {
    return true;
  }

  console.log(
    chalk.yellow(`\n⚠️  Warning: ${functionName} function already exists!`)
  );

  const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
    {
      type: 'confirm',
      name: 'overwrite',
      message: `Do you want to overwrite the existing ${functionName} function?`,
      default: false,
    },
  ]);

  if (!overwrite) {
    console.log(chalk.blue('Files will not be modified.'));
    return false;
  }

  console.log(chalk.yellow('Proceeding with overwrite...'));
  return true;
}

export async function runSupabaseMigrations(): Promise<void> {
  const migrationSpinner = ora('Running supabase migration up...').start();
  try {
    const { spawn } = require('node:child_process');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Timeout: supabase migration up took too long'));
      }, 60000); // 60 second timeout

      const child = spawn('supabase', ['migration', 'up'], {
        stdio: 'pipe',
        cwd: process.cwd(),
        env: { ...process.env, SUPABASE_DISABLE_TELEMETRY: 'true' },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout);
          migrationSpinner.succeed(
            '✅ Database migrations applied successfully!'
          );
        } else {
          reject(
            new Error(
              `supabase migration up failed (code ${code}): ${stderr || stdout}`
            )
          );
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        // Check if it's the ENOENT error (command not found)
        if (error.code === 'ENOENT') {
          migrationSpinner.warn('⚠️ Supabase CLI not found in PATH');
          console.log(
            chalk.yellow('💡 Please manually run: supabase migration up')
          );
          resolve('');
        } else {
          reject(new Error(`Failed to spawn supabase CLI: ${error.message}`));
        }
      });
    });
  } catch (error) {
    migrationSpinner.fail('❌ Failed to apply migrations');
    console.error(
      chalk.red('Migration error:'),
      error instanceof Error ? error.message : String(error)
    );
    console.log(chalk.yellow('💡 You can manually run: supabase migration up'));
    throw error;
  }
}

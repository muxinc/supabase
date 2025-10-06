import { defineConfig } from 'tsup';
import fs from 'fs';
import path from 'path';

export default defineConfig([
  // Main CLI build
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    minify: true,
    treeshake: true,
    target: 'node18',
    platform: 'node',
    outDir: 'dist',
    outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
    banner: {
      js: '#!/usr/bin/env node',
    },
    esbuildOptions(options) {
      options.define = {
        ...options.define,
        'process.env.NODE_ENV': '"production"',
      };
    },
    async onSuccess() {
      // Copy migrations to dist
      const migrationsSource = path.join(__dirname, 'src', 'migrations');
      const migrationsTarget = path.join(__dirname, 'dist', 'migrations');

      if (fs.existsSync(migrationsSource)) {
        // Create target directory if it doesn't exist
        if (!fs.existsSync(migrationsTarget)) {
          fs.mkdirSync(migrationsTarget, { recursive: true });
        }

        // Copy all .sql files
        const files = fs.readdirSync(migrationsSource);
        for (const file of files) {
          if (file.endsWith('.sql')) {
            const sourcePath = path.join(migrationsSource, file);
            const targetPath = path.join(migrationsTarget, file);
            fs.copyFileSync(sourcePath, targetPath);
          }
        }
        console.log('✅ Copied migration files to dist/migrations');
      }
    },
  },
  // Deno-specific build
  {
    entry: { deno: 'deno.ts' },
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: false,
    treeshake: true,
    target: 'esnext',
    platform: 'neutral',
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
    external: [
      /^node:/,
      /^npm:/, // Keep node: and npm: imports external (after plugin rewrites)
      // Packages that should be external for Deno
      '@supabase/supabase-js',
      '@mux/mux-node',
      'toml',
    ],
    noExternal: [], // Override any noExternal from base config
    esbuildOptions(options) {
      options.define = {
        ...options.define,
        'process.env.NODE_ENV': '"production"',
      };
    },
  },
]);

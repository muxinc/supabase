import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs'],
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: true,
  treeshake: true,
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  outExtension: () => ({ js: '.cjs' }),
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: [],
  esbuildOptions(options) {
    options.define = {
      ...options.define,
      'process.env.NODE_ENV': '"production"',
    };
  },
});

import { defineConfig } from 'tsup';

export default defineConfig({
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
  noExternal: [/.*/],
  esbuildOptions(options) {
    options.define = {
      ...options.define,
      'process.env.NODE_ENV': '"production"',
    };
  },
});

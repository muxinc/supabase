#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const denoJsPath = path.join(__dirname, 'dist', 'deno.js');

if (fs.existsSync(denoJsPath)) {
  console.log('🔄 Rewriting Deno imports...');
  let contents = fs.readFileSync(denoJsPath, 'utf-8');

  const nodeBuiltins = new Set([
    'assert',
    'buffer',
    'child_process',
    'cluster',
    'crypto',
    'dgram',
    'dns',
    'domain',
    'events',
    'fs',
    'http',
    'https',
    'net',
    'os',
    'path',
    'punycode',
    'querystring',
    'readline',
    'repl',
    'stream',
    'string_decoder',
    'sys',
    'timers',
    'tls',
    'tty',
    'url',
    'util',
    'vm',
    'zlib',
  ]);

  // Rewrite import statements (exclude already prefixed ones)
  contents = contents.replace(
    /import\s+([^'"]*?)\s+from\s+['"](?!npm:|node:|jsr:|https?:|\.|\/)([^'"]+)['"]/g,
    (match, imports, pkg) => {
      if (nodeBuiltins.has(pkg)) {
        return `import ${imports} from 'node:${pkg}'`;
      } else {
        return `import ${imports} from 'npm:${pkg}'`;
      }
    }
  );

  // Also handle export ... from statements (exclude already prefixed ones)
  contents = contents.replace(
    /from\s+['"](?!npm:|node:|jsr:|https?:|\.|\/)([^'"]+)['"]/g,
    (match, pkg) => {
      if (nodeBuiltins.has(pkg)) {
        return `from 'node:${pkg}'`;
      } else {
        return `from 'npm:${pkg}'`;
      }
    }
  );

  fs.writeFileSync(denoJsPath, contents);
  console.log('✅ Rewrote Deno imports with npm: and node: prefixes');
} else {
  console.log('ℹ️  No deno.js file found, skipping import rewriting');
}

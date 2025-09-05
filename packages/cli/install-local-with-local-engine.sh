#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

# Run from the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Installing Mux Sync CLI with local sync-engine..."

# Get the root directory of the monorepo
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SYNC_ENGINE_DIR="$ROOT_DIR/packages/sync-engine"

echo "📁 Root directory: $ROOT_DIR"
echo "📁 Sync engine directory: $SYNC_ENGINE_DIR"

# Check if sync-engine directory exists
if [[ ! -d "$SYNC_ENGINE_DIR" ]]; then
    echo "❌ Error: Sync engine directory not found at $SYNC_ENGINE_DIR"
    exit 1
fi

# Build the sync-engine first
echo "🔨 Building sync-engine..."
cd "$SYNC_ENGINE_DIR"
npm run build
echo "✅ Sync-engine built successfully"

# Go back to CLI directory
cd "$SCRIPT_DIR"

# Uninstall any previous version to avoid conflicts
echo "🧹 Uninstalling any previous version..."
npm uninstall -g @mux/supabase >/dev/null 2>&1 || true

# Detect global npm bin dir
BIN_DIR="$(npm bin -g 2>/dev/null || true)"
if [[ -z "${BIN_DIR}" ]]; then
  PREFIX="$(npm prefix -g 2>/dev/null || true)"
  if [[ -n "${PREFIX}" ]]; then
    BIN_DIR="${PREFIX}/bin"
  fi
fi

# Remove any existing binary files if uninstall didn't clean them up
echo "🧹 Cleaning up any existing binary files..."
for name in mux-sync mux-supabase; do
  if command -v "$name" >/dev/null 2>&1; then
    BIN_PATH="$(command -v "$name")"
    if [[ -w "$BIN_PATH" ]]; then
      rm -f "$BIN_PATH" || true
    else
      echo "Warning: cannot remove existing $name at $BIN_PATH (no write permission)."
    fi
  fi
  if [[ -n "${BIN_DIR}" && -e "${BIN_DIR}/$name" ]]; then
    if [[ -w "${BIN_DIR}/$name" ]]; then
      rm -f "${BIN_DIR}/$name" || true
    else
      echo "Warning: cannot remove ${BIN_DIR}/$name (no write permission)."
    fi
  fi
done

# Backup original package.json
echo "💾 Backing up original package.json..."
cp package.json package.json.backup

# Modify package.json to use local sync-engine
echo "🔧 Modifying package.json to use local sync-engine..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies['@mux/sync-engine'] = 'file:../sync-engine';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"
echo "✅ Package.json modified"

# Install dependencies with the modified package.json
echo "📦 Installing dependencies..."
npm install

# Build the CLI
echo "🔨 Building the CLI..."
npm run build

# Install globally for testing
echo "📦 Installing globally with local sync-engine..."
npm install -g .

# Restore original package.json
echo "🔄 Restoring original package.json..."
mv package.json.backup package.json

echo ""
echo "✅ CLI installed globally with local sync-engine!"
echo "You can now test it with: mux-supabase init"
echo ""
echo "To uninstall later, run: npm uninstall -g @mux/supabase"
echo ""
echo "Note: The CLI is now using the local sync-engine from: $SYNC_ENGINE_DIR"

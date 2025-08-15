#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

# Run from the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Setting up test package with local sync-engine..."

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

# Go back to test directory
cd "$SCRIPT_DIR"

# Backup original package.json
echo "💾 Backing up original package.json..."
cp package.json package.json.backup

# Modify package.json to use local sync-engine
echo "🔧 Modifying package.json to use local sync-engine..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies['@r-delfino/mux-sync-engine'] = 'file:../sync-engine';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"
echo "✅ Package.json modified"

# Install dependencies with local sync-engine
echo "📦 Installing dependencies with local sync-engine..."
npm install

echo ""
echo "✅ Test package configured with local sync-engine!"
echo "You can now run tests with:"
echo "  npm run webhook-test"
echo "  npm run webhook-server"
echo "  npm run advanced-test"
echo ""
echo "To restore original package.json, run: ./restore-original.sh"

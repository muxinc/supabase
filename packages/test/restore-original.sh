#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

# Run from the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔄 Restoring original package.json..."

# Check if backup exists
if [[ ! -f "package.json.backup" ]]; then
    echo "❌ Error: No backup file found (package.json.backup)"
    echo "The package.json was not modified by the setup script."
    exit 1
fi

# Restore original package.json
echo "💾 Restoring from backup..."
mv package.json.backup package.json

# Reinstall dependencies with original version
echo "📦 Reinstalling dependencies with original sync-engine..."
npm install

echo ""
echo "✅ Original package.json restored!"
echo "The test package is now using the published version of @r-delfino/mux-sync-engine"

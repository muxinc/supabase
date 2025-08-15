#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

# Run from the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing Mux Sync Supabase CLI locally..."

# Uninstall any previous version to avoid conflicts
echo "Uninstalling any previous version..."
npm uninstall -g @r-delfino/mux-sync-supabase >/dev/null 2>&1 || true

# Detect global npm bin dir
BIN_DIR="$(npm bin -g 2>/dev/null || true)"
if [[ -z "${BIN_DIR}" ]]; then
  PREFIX="$(npm prefix -g 2>/dev/null || true)"
  if [[ -n "${PREFIX}" ]]; then
    BIN_DIR="${PREFIX}/bin"
  fi
fi

# Remove any existing binary files if uninstall didn't clean them up
echo "Cleaning up any existing binary files..."
for name in mux-sync mux-sync-supabase; do
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

# Build the CLI
echo "Building the CLI..."
npm run build

# Install globally for testing
echo "Installing globally..."
npm install -g .

echo "✅ CLI installed globally!"
echo "You can now test it with: mux-sync-supabase init"
echo ""
echo "To uninstall later, run: npm uninstall -g @r-delfino/mux-sync-supabase"
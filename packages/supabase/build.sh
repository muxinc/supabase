#!/bin/bash

# Build script for the CLI package

echo "Building Mux Sync Supabase CLI..."

# Clean previous build
npm run clean

# Install dependencies
npm ci

# Build the package
npm run build

# Make the CLI executable
chmod +x dist/index.cjs

echo "✅ CLI built successfully!"
echo "You can now run: npx mux-supabase init" 
#!/bin/bash
# This script organizes the iOS deployment files into their proper structure

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Setting up Infinite Voyager iOS deployment structure in: $BASE_DIR"

# Create directories
mkdir -p "$BASE_DIR/dist"
mkdir -p "$BASE_DIR/dist/AppIcon.appiconset"
mkdir -p "$BASE_DIR/.github/workflows"

# Copy index.html to dist
if [ -f "$BASE_DIR/index.html" ] && [ ! -f "$BASE_DIR/dist/index.html" ]; then
  cp "$BASE_DIR/index.html" "$BASE_DIR/dist/index.html"
  echo "✓ Copied index.html to dist/"
fi

# Move manifest.json to dist
if [ -f "$BASE_DIR/manifest.json" ]; then
  mv "$BASE_DIR/manifest.json" "$BASE_DIR/dist/manifest.json"
  echo "✓ Moved manifest.json to dist/"
fi

# Move sw.js to dist
if [ -f "$BASE_DIR/sw.js" ]; then
  mv "$BASE_DIR/sw.js" "$BASE_DIR/dist/sw.js"
  echo "✓ Moved sw.js to dist/"
fi

# Move Contents.json to dist/AppIcon.appiconset
if [ -f "$BASE_DIR/Contents.json" ]; then
  mv "$BASE_DIR/Contents.json" "$BASE_DIR/dist/AppIcon.appiconset/Contents.json"
  echo "✓ Moved Contents.json to dist/AppIcon.appiconset/"
fi

# Move ios-build.yml to .github/workflows
if [ -f "$BASE_DIR/ios-build.yml" ]; then
  mv "$BASE_DIR/ios-build.yml" "$BASE_DIR/.github/workflows/ios-build.yml"
  echo "✓ Moved ios-build.yml to .github/workflows/"
fi

echo ""
echo "Setup complete! Project structure:"
find "$BASE_DIR" -type f -name "*.json" -o -name "*.yml" -o -name "*.js" -o -name "*.html" | grep -v node_modules | sort

echo ""
echo "Next steps:"
echo "1. npm install"
echo "2. npx cap add ios"
echo "3. npx cap sync ios"

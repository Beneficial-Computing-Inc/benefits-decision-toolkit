#!/bin/bash
# Generate a JSON manifest of all DMN files for the audit tool

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DMN_DIR="$PROJECT_ROOT/public/dmn"
MANIFEST_FILE="$PROJECT_ROOT/public/dmn-manifest.json"

echo "Generating DMN manifest..."

# Find all .dmn files and output as JSON array
cd "$DMN_DIR"
FILES=$(find . -name "*.dmn" | sed 's|^\./||' | sort)

# Build JSON array
echo "[" > "$MANIFEST_FILE"
first=true
for file in $FILES; do
  if [ "$first" = true ]; then
    first=false
  else
    echo "," >> "$MANIFEST_FILE"
  fi
  printf '  "%s"' "$file" >> "$MANIFEST_FILE"
done
echo "" >> "$MANIFEST_FILE"
echo "]" >> "$MANIFEST_FILE"

COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "Generated manifest with $COUNT DMN files"
echo "Output: $MANIFEST_FILE"

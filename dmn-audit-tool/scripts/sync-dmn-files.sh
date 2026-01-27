#!/bin/bash
# Sync DMN files from BDT codebase to public folder for development
# Run this script whenever the DMN ruleset is updated

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BDT_RESOURCES="../benefits-decision-toolkit/library-api/src/main/resources"
DMN_DEST="$PROJECT_ROOT/public/dmn"

echo "Syncing DMN files from BDT codebase..."

# Create destination directory
mkdir -p "$DMN_DEST"

# Remove old files to ensure clean sync
rm -rf "$DMN_DEST/checks" "$DMN_DEST/benefits" "$DMN_DEST/bdt.dmn"

# Copy checks folder (eligibility checks by category)
if [ -d "$PROJECT_ROOT/$BDT_RESOURCES/checks" ]; then
  cp -r "$PROJECT_ROOT/$BDT_RESOURCES/checks" "$DMN_DEST/"
  echo "✓ Copied checks/"
else
  echo "✗ Warning: checks/ not found at $BDT_RESOURCES/checks"
fi

# Copy benefits folder (composite benefit DMNs)
if [ -d "$PROJECT_ROOT/$BDT_RESOURCES/benefits" ]; then
  cp -r "$PROJECT_ROOT/$BDT_RESOURCES/benefits" "$DMN_DEST/"
  echo "✓ Copied benefits/"
else
  echo "✗ Warning: benefits/ not found at $BDT_RESOURCES/benefits"
fi

# Copy bdt.dmn (type definitions)
if [ -f "$PROJECT_ROOT/$BDT_RESOURCES/bdt.dmn" ]; then
  cp "$PROJECT_ROOT/$BDT_RESOURCES/bdt.dmn" "$DMN_DEST/"
  echo "✓ Copied bdt.dmn"
else
  echo "✗ Warning: bdt.dmn not found"
fi

# Count files synced
CHECK_COUNT=$(find "$DMN_DEST/checks" -name "*.dmn" 2>/dev/null | wc -l | tr -d ' ')
BENEFIT_COUNT=$(find "$DMN_DEST/benefits" -name "*.dmn" 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "Sync complete!"
echo "  - Checks: $CHECK_COUNT DMN files"
echo "  - Benefits: $BENEFIT_COUNT DMN files"

# Regenerate manifest
echo ""
echo "Regenerating manifest..."
"$SCRIPT_DIR/generate-manifest.sh"

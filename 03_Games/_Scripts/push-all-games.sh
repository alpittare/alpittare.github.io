#!/bin/bash
# ============================================================================
# Push All Games to GitHub
# Run this from your 03_Games folder on your Mac:
#   cd path/to/03_Games && chmod +x push-all-games.sh && ./push-all-games.sh
# ============================================================================

set -e
GAMES_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  Pushing All 3 Games to GitHub"
echo "  Username: alpittare"
echo "============================================"
echo ""

# ── 1. Cricket Pro Bot AI (CrickBot) ──────────────────────────────────────
echo "▶ [1/3] Cricket Pro Bot AI (02_CrickBot)"
cd "$GAMES_DIR/02_CrickBot"
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Rename CrickBot → Cricket Pro Bot AI

Updated app name, bundle ID, manifest, service worker, CI/CD pipeline,
and Capacitor config for Cricket Pro Bot AI branding.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || echo "  (nothing to commit)"
git push origin main
echo "  ✓ Cricket Pro Bot AI pushed!"
echo ""

# ── 2. Football Pro Bot AI (GoalBot) ─────────────────────────────────────
echo "▶ [2/3] Football Pro Bot AI (03_GoalBot)"
cd "$GAMES_DIR/03_GoalBot"
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Rename GoalBot → Football Pro Bot AI

Updated app name, bundle ID, manifest, service worker, CI/CD pipeline,
and Capacitor config for Football Pro Bot AI branding.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || echo "  (nothing to commit)"
git push origin main
echo "  ✓ Football Pro Bot AI pushed!"
echo ""

# ── 3. Baseball Pro Bot AI (BaseHit) — NEW REPO ──────────────────────────
echo "▶ [3/3] Baseball Pro Bot AI (08_BaseHit) — Creating new repo"
cd "$GAMES_DIR/08_BaseHit"

# Initialize git if not already
if [ ! -d ".git" ]; then
    git init
    git branch -M main
fi

rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Initial commit — Baseball Pro Bot AI v1.0

AI-powered baseball game with 5 at-bats, balls/strikes system,
power-ups, combo multipliers, and full iOS deployment pipeline.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || echo "  (nothing to commit)"

# Create GitHub repo (requires gh CLI)
if command -v gh &> /dev/null; then
    echo "  Creating GitHub repo..."
    gh repo create alpittare/baseball-pro-bot-ai --public --source=. --remote=origin --push
    echo "  ✓ Baseball Pro Bot AI repo created and pushed!"
else
    echo ""
    echo "  ⚠ gh CLI not found. Create the repo manually:"
    echo "    1. Go to https://github.com/new"
    echo "    2. Name: baseball-pro-bot-ai"
    echo "    3. Public, no README, no .gitignore"
    echo "    4. Then run:"
    echo "       git remote add origin https://github.com/alpittare/baseball-pro-bot-ai.git"
    echo "       git push -u origin main"
fi

echo ""
echo "============================================"
echo "  All Done! Your repos:"
echo "  • https://github.com/alpittare/CrickBot"
echo "  • https://github.com/alpittare/GoalBot"
echo "  • https://github.com/alpittare/baseball-pro-bot-ai"
echo "============================================"

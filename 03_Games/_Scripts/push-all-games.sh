#!/bin/bash
# ============================================================================
# Push All 6 Games + Backend + Frontend to GitHub
# Run from your 07_Cluade_Code_folder:
#   cd path/to/07_Cluade_Code_folder && chmod +x 03_Games/_Scripts/push-all-games.sh
#   ./03_Games/_Scripts/push-all-games.sh
# ============================================================================

set -e
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
GAMES_DIR="$ROOT_DIR/03_Games"

echo "============================================"
echo "  Pushing All 6 Games + Backend + Frontend"
echo "  Username: alpittare"
echo "============================================"
echo ""

# ── Main repo (exafabs.ai) ─────────────────────────────────────
echo "▶ [1/1] Main Repo (exafabs.ai)"
cd "$ROOT_DIR"
rm -f .git/index.lock 2>/dev/null || true
git add -A
git commit -m "Update all games, backend, and frontend

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || echo "  (nothing to commit)"
git push origin main
echo "  ✓ Main repo pushed!"
echo ""

echo "============================================"
echo "  All Done!"
echo ""
echo "  Games in portfolio:"
echo "  🏏 02_Cricket_AI_2026     — CrickBot"
echo "  ⚽ 03_Football_AI_2026    — GoalBot"
echo "  ⚾ 04_Baseball_AI_2026    — BaseHit"
echo "  🎯 05_Survival_Arena_2026 — Survival Arena"
echo "  🚀 06_Infinite_Voyager_2026 — Infinite Voyager"
echo ""
echo "  Backend:  04_Convex_Backend (gallant-kingfisher-867)"
echo "  Frontend: 05_Frontend (Next.js dashboard)"
echo ""
echo "  Repo: https://github.com/alpittare/exafabs.ai"
echo "============================================"
echo ""
echo "  Don't forget to deploy Convex if schema changed:"
echo "    cd 04_Convex_Backend && npx convex deploy"
echo ""

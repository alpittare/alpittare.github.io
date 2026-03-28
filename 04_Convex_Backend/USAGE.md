# Convex Unified Game Backend — Usage Guide

Supports: **Cricket AI 2026** | **Football AI 2026** | **Baseball AI 2026**

Deployment: `tidy-weasel-627` — https://tidy-weasel-627.convex.cloud

---

## 1. First-Time Setup

```bash
cd Convex_Backend
npx convex login          # opens browser for auth
npx convex dev            # pushes schema + functions, watches for changes
```

## 2. Project Structure

```
Convex_Backend/
├── convex/
│   ├── schema.ts           # 5 tables: players, game_sessions, leaderboard, campaign_progress, achievements
│   ├── players.ts          # registerPlayer, updatePlayerStats, getPlayer, getPlayerByName
│   ├── sessions.ts         # submitGameSession, getMatchHistory, getRecentSessions
│   ├── leaderboard.ts      # getLeaderboard (per-game), getGlobalRanking, getPlayerRank
│   ├── campaign.ts         # syncCampaign, getCampaignProgress
│   ├── achievements.ts     # unlockAchievement, getPlayerAchievements, hasAchievement
│   ├── addScore.ts         # DEPRECATED — use sessions.submitGameSession
│   ├── getTopScores.ts     # DEPRECATED — use leaderboard.getLeaderboard
│   └── _generated/         # Auto-generated after `convex dev`
├── integration/
│   ├── convex-client.js          # ConvexGameClient — shared HTTP client for all games
│   ├── crickbot-integration.js   # CrickBot-specific hooks (submitMatch, syncCareer, syncCampaign)
│   ├── goalbot-integration.js    # GoalBot-specific hooks (submitMatch, syncCareer)
│   └── basehit-integration.js    # BaseHit-specific hooks (submitMatch, syncCareer, syncCampaign)
├── convex.json
├── package.json
└── USAGE.md
```

## 3. Schema Overview

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `players` | Player profiles + cross-game career stats | `by_name`, `by_level` |
| `game_sessions` | Per-game match history | `by_player_game`, `by_game_score` |
| `leaderboard` | Denormalized per-game rankings (fast top-k) | `by_game_score`, `by_player_game` |
| `campaign_progress` | BaseHit 100-level + CrickBot phase tracking | `by_player_game` |
| `achievements` | Cross-game achievement log | `by_player_achievement` |

## 4. Integrating Into Your Games

### Step 1: Add scripts to each game's `index.html`

```html
<!-- At the END of your game's index.html, before </body> -->
<script src="../Convex_Backend/integration/convex-client.js"></script>
<script src="../Convex_Backend/integration/crickbot-integration.js"></script>
```

### Step 2: Register player (once, on first launch)

```javascript
// In your game's init or menu screen
const convex = new ConvexGameClient();
await convex.getOrRegisterPlayer("Alpit");
```

### Step 3: Submit session after each game ends

**CrickBot:**
```javascript
// In your game-over handler (where matchHistory.push happens)
await crickbotSync.submitMatch(gameState);
await crickbotSync.syncCareerStats(gameState);
```

**GoalBot:**
```javascript
await goalbotSync.submitMatch({
  goalsFor: score.player,
  goalsAgainst: score.ai,
  totalShots: totalPenalties,
  round: currentRound,
  difficulty: currentDifficulty,
  won: score.player > score.ai,
});
```

**BaseHit:**
```javascript
await basehitSync.submitMatch(gameState, {
  score: finalScore,
  homeRuns: hrsHit,
  swings: totalSwings,
  perfectHits: perfectCount,
  streak: gameState.streak,
  won: hrsHit >= 1,
});
await basehitSync.syncCampaign(gameState);
```

### Step 4: Fetch leaderboard

```javascript
const convex = new ConvexGameClient();
const top10 = await convex.getLeaderboard("crickbot", 10);
// Returns: [{ rank, playerId, name, score, gamesPlayed }, ...]
```

## 5. API Reference (HTTP — no SDK needed)

```bash
# Register player
curl -X POST https://tidy-weasel-627.convex.cloud/api/mutation \
  -H "Content-Type: application/json" \
  -d '{"path": "players:registerPlayer", "args": {"name": "Alpit"}}'

# Submit game session
curl -X POST https://tidy-weasel-627.convex.cloud/api/mutation \
  -H "Content-Type: application/json" \
  -d '{
    "path": "sessions:submitGameSession",
    "args": {
      "playerId": "<id>",
      "game": "crickbot",
      "score": 85,
      "difficulty": "hard",
      "won": true,
      "stats": {"runs": 85, "wickets": 2, "overs": 5, "target": 60, "fours": 8, "sixes": 3}
    }
  }'

# Get leaderboard
curl "https://tidy-weasel-627.convex.cloud/api/query?path=leaderboard:getLeaderboard&args=%7B%22game%22:%22crickbot%22,%22limit%22:10%7D"
```

/**
 * Convex Schema — Unified Game Backend
 *
 * Supports: CrickBot, GoalBot, BaseHit
 *
 * Tables:
 *   players          – Player profiles with cross-game lifetime stats
 *   game_sessions    – Per-game match history with game-specific stats
 *   leaderboard      – Denormalized per-game + global rankings (fast top-k)
 *   campaign_progress – BaseHit 100-level + CrickBot phase progression
 *   achievements     – Cross-game achievement tracking
 *
 * Design:
 *   - leaderboard is denormalized for O(k) ranked reads
 *   - game_sessions.stats uses v.any() for game-specific payloads
 *   - campaign_progress is separate from players to avoid bloating reads
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Player Profiles ───────────────────────────────────────────────
  // One row per player. Cross-game identity.
  players: defineTable({
    name: v.string(),                // display name (unique, ≤50 chars)
    createdAt: v.number(),           // epoch ms

    // Cross-game lifetime stats
    totalGamesPlayed: v.number(),
    totalCoinsEarned: v.number(),
    level: v.number(),
    xp: v.number(),

    // Per-game best scores
    bestScores: v.object({
      crickbot: v.number(),          // best innings score
      goalbot: v.number(),           // best match goals
      basehit: v.number(),           // best game score
    }),

    // Per-game career stats
    crickbotStats: v.object({
      totalRuns: v.number(),
      totalFours: v.number(),
      totalSixes: v.number(),
      totalBallsFaced: v.number(),
      totalWins: v.number(),
      legendWins: v.number(),
    }),
    goalbotStats: v.object({
      totalGoals: v.number(),
      totalShots: v.number(),
      totalSaves: v.number(),        // shots saved by AI keeper (missed penalties)
      shotAccuracy: v.number(),      // 0-1
    }),
    basehitStats: v.object({
      totalHRs: v.number(),
      totalSwings: v.number(),
      totalGoodHits: v.number(),
      totalFouls: v.number(),
      totalStrikes: v.number(),
      bestStreak: v.number(),
    }),
  })
    .index("by_name", ["name"])
    .index("by_level", ["level"]),

  // ── Game Sessions ─────────────────────────────────────────────────
  // One row per completed game. History log.
  game_sessions: defineTable({
    playerId: v.id("players"),
    game: v.union(
      v.literal("crickbot"),
      v.literal("goalbot"),
      v.literal("basehit")
    ),
    score: v.number(),               // primary score for this session
    difficulty: v.string(),          // easy | medium | hard | legend
    won: v.boolean(),
    duration: v.optional(v.number()), // seconds
    playedAt: v.number(),            // epoch ms

    // Game-specific session stats (flexible payload)
    // CrickBot: { runs, wickets, overs, target, fours, sixes }
    // GoalBot:  { goalsFor, goalsAgainst, totalShots, round }
    // BaseHit:  { homeRuns, swings, streak, perfectHits }
    stats: v.any(),
  })
    .index("by_player", ["playerId"])
    .index("by_player_game", ["playerId", "game"])
    .index("by_game_score", ["game", "score"])
    .index("by_played", ["playedAt"]),

  // ── Leaderboard (denormalized) ────────────────────────────────────
  // One row per player per game. Fast top-k queries.
  leaderboard: defineTable({
    playerId: v.id("players"),
    name: v.string(),                // denormalized for display
    game: v.union(
      v.literal("crickbot"),
      v.literal("goalbot"),
      v.literal("basehit")
    ),
    score: v.number(),               // best score for this game
    gamesPlayed: v.number(),
    updatedAt: v.number(),
  })
    .index("by_game_score", ["game", "score"])
    .index("by_player_game", ["playerId", "game"]),

  // ── Campaign Progress ─────────────────────────────────────────────
  // Per-player campaign state (BaseHit 100-level, CrickBot phases, GoalBot 100-level)
  campaign_progress: defineTable({
    playerId: v.id("players"),
    game: v.union(
      v.literal("crickbot"),
      v.literal("goalbot"),
      v.literal("basehit")
    ),
    currentLevel: v.number(),        // BaseHit: 1-100, CrickBot: phase index
    totalStars: v.number(),
    levelStars: v.any(),             // { "1": 3, "2": 2, ... }
    updatedAt: v.number(),
  })
    .index("by_player_game", ["playerId", "game"]),

  // ── Achievements ──────────────────────────────────────────────────
  // Cross-game achievement log
  achievements: defineTable({
    playerId: v.id("players"),
    achievementId: v.string(),       // e.g. "crickbot_score50", "basehit_legend_win"
    game: v.string(),                // which game awarded it
    unlockedAt: v.number(),
  })
    .index("by_player", ["playerId"])
    .index("by_player_achievement", ["playerId", "achievementId"]),
});

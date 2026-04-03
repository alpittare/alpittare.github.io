/**
 * Convex Schema — Unified Game Backend
 *
 * Supports: CrickBot, GoalBot, BaseHit, SurvivalArena, InfiniteVoyager
 *
 * Tables:
 *   players            – Player profiles with cross-game lifetime stats
 *   game_sessions      – Per-game match history with game-specific stats
 *   leaderboard        – Denormalized per-game + global rankings (fast top-k)
 *   campaign_progress  – BaseHit 100-level + CrickBot phase progression
 *   achievements       – Cross-game achievement tracking
 *   matchmaking_queue  – Players waiting for multiplayer match
 *   match_rooms        – Active multiplayer match state (real-time synced)
 *
 * Design:
 *   - leaderboard is denormalized for O(k) ranked reads
 *   - game_sessions.stats uses v.any() for game-specific payloads
 *   - campaign_progress is separate from players to avoid bloating reads
 *   - match_rooms are real-time synced via Convex subscriptions (no WebSocket needed)
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
      survivalarena: v.optional(v.number()),  // best arena score
      infinitevoyager: v.optional(v.number()),  // best voyage distance
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
    survivalarenaStats: v.optional(v.object({
      totalKills: v.number(),
      totalWins: v.number(),
      bestKills: v.number(),
      bestStreak: v.number(),
      levelsCompleted: v.number(),
    })),
    infinitevoyagerStats: v.optional(v.object({
      totalDistance: v.number(),
      totalAliensKilled: v.number(),
      totalBossesDefeated: v.number(),
      totalStormsCollected: v.number(),
      bestDistance: v.number(),
      bestCombo: v.number(),
    })),
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
      v.literal("basehit"),
      v.literal("survivalarena"),
      v.literal("infinitevoyager")
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
      v.literal("basehit"),
      v.literal("survivalarena"),
      v.literal("infinitevoyager")
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
      v.literal("basehit"),
      v.literal("survivalarena"),
      v.literal("infinitevoyager")
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

  // ── Matchmaking Queue ────────────────────────────────────────────
  // Players waiting for a multiplayer match
  matchmaking_queue: defineTable({
    playerName: v.string(),
    difficulty: v.string(),
    status: v.string(),              // "waiting" | "matched"
    roomId: v.optional(v.id("match_rooms")),
    joinedAt: v.number(),
    matchedAt: v.optional(v.number()),
  })
    .index("by_name", ["playerName"])
    .index("by_status", ["status"]),

  // ── Match Rooms ──────────────────────────────────────────────────
  // Real-time multiplayer match state. Subscribed to by both players.
  match_rooms: defineTable({
    player1Name: v.string(),         // setter (bats first)
    player2Name: v.string(),         // chaser (bats second)
    difficulty: v.string(),
    status: v.string(),              // "waiting" | "innings1" | "innings2" | "completed"
    createdAt: v.number(),

    // Private room code (4-char alphanumeric, e.g. "A7X2")
    roomCode: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),

    // Innings 1 (setter)
    innings1Score: v.number(),
    innings1Wickets: v.number(),
    innings1Overs: v.number(),
    innings1Balls: v.number(),
    innings1Fours: v.number(),
    innings1Sixes: v.number(),
    innings1Complete: v.boolean(),

    // Innings 2 (chaser)
    innings2Score: v.number(),
    innings2Wickets: v.number(),
    innings2Overs: v.number(),
    innings2Balls: v.number(),
    innings2Fours: v.number(),
    innings2Sixes: v.number(),
    innings2Complete: v.boolean(),

    // Chase target
    target: v.number(),              // innings1Score + 1

    // Result
    winner: v.string(),
    winMargin: v.string(),
    updatedAt: v.number(),

    // Live ball-by-ball
    lastBallResult: v.string(),
    lastBallRuns: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_player1", ["player1Name"])
    .index("by_player2", ["player2Name"])
    .index("by_room_code", ["roomCode"]),

  // ── Arena Rooms (Survival Arena Multiplayer) ─────────────────────
  // One row per multiplayer arena match. Holds arena state + metadata.
  arena_rooms: defineTable({
    hostName: v.string(),
    difficulty: v.string(),              // easy | medium | hard | legend
    maxPlayers: v.number(),              // 5 or 10
    status: v.string(),                  // "lobby" | "countdown" | "playing" | "finished"
    roomCode: v.string(),                // 4-char invite code
    isPrivate: v.boolean(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),

    // Arena bounds (server-authoritative)
    arenaX: v.number(),
    arenaY: v.number(),
    arenaW: v.number(),
    arenaH: v.number(),
    shrinkTimer: v.number(),
    shrinkCount: v.number(),

    // Power-ups on the field (server-spawned)
    powerUps: v.array(v.object({
      id: v.number(),
      type: v.string(),
      x: v.number(),
      y: v.number(),
      alive: v.boolean(),
    })),

    // Server tick counter (clients detect new data by comparing)
    tick: v.number(),
    updatedAt: v.number(),

    // Result
    placements: v.optional(v.array(v.object({
      name: v.string(),
      isBot: v.boolean(),
      kills: v.number(),
      placement: v.number(),
    }))),
    winnerName: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_room_code", ["roomCode"])
    .index("by_host", ["hostName"]),

  // ── Arena Players (per-player state within an arena room) ────────
  // One row per player (human or bot) per room. Updated every tick.
  arena_players: defineTable({
    roomId: v.id("arena_rooms"),
    playerName: v.string(),
    isBot: v.boolean(),
    slot: v.number(),                    // 0-9 position in lobby
    skin: v.string(),                    // skin id

    // Position & movement (updated by client for humans, server for bots)
    x: v.number(),
    y: v.number(),
    vx: v.number(),
    vy: v.number(),

    // Combat state (server-authoritative)
    hp: v.number(),
    maxHp: v.number(),
    damage: v.number(),
    alive: v.boolean(),
    kills: v.number(),
    attackCooldown: v.number(),

    // Bot AI fields
    aiBehavior: v.optional(v.string()),  // chase | flee | wander | powerup
    aiTarget: v.optional(v.string()),    // target playerName

    // Placement (set on death)
    placement: v.optional(v.number()),
    diedAt: v.optional(v.number()),

    // Sync tracking
    lastInput: v.number(),               // last client update timestamp
    updatedAt: v.number(),
    isReady: v.boolean(),                // lobby ready state
    isDisconnected: v.boolean(),         // no input for 5s → bot takes over
  })
    .index("by_room", ["roomId"])
    .index("by_room_player", ["roomId", "playerName"])
    .index("by_room_alive", ["roomId", "alive"])
    .index("by_player_name", ["playerName"]),

  // ── Arena Matchmaking Queue ──────────────────────────────────────
  arena_queue: defineTable({
    playerName: v.string(),
    difficulty: v.string(),
    maxPlayers: v.number(),              // 5 or 10
    skin: v.string(),
    status: v.string(),                  // "waiting" | "matched"
    roomId: v.optional(v.id("arena_rooms")),
    joinedAt: v.number(),
    matchedAt: v.optional(v.number()),
  })
    .index("by_name", ["playerName"])
    .index("by_status_size", ["status", "maxPlayers"]),
});

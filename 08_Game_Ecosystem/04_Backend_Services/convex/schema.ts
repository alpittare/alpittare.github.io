import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    created: v.number(),
    lastSeen: v.number(),
    stats: v.object({
      gamesPlayed: v.number(),
      totalWins: v.number(),
      totalScore: v.number(),
    }),
    settings: v.object({
      soundEnabled: v.boolean(),
      musicEnabled: v.boolean(),
      difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
      theme: v.union(v.literal("light"), v.literal("dark")),
    }),
  })
    .index("by_email", ["email"])
    .index("by_created", ["created"])
    .index("by_lastSeen", ["lastSeen"]),

  sessions: defineTable({
    playerId: v.id("players"),
    game: v.union(
      v.literal("cricket"),
      v.literal("football"),
      v.literal("baseball")
    ),
    score: v.number(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    won: v.boolean(),
    duration: v.number(), // in seconds
    timestamp: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_game", ["game"])
    .index("by_timestamp", ["timestamp"])
    .index("by_playerId_game", ["playerId", "game"]),

  leaderboard: defineTable({
    playerId: v.id("players"),
    playerName: v.string(),
    game: v.union(
      v.literal("cricket"),
      v.literal("football"),
      v.literal("baseball")
    ),
    score: v.number(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    rank: v.number(),
    season: v.id("seasons"),
    updatedAt: v.number(),
  })
    .index("by_game", ["game"])
    .index("by_game_difficulty", ["game", "difficulty"])
    .index("by_season", ["season"])
    .index("by_playerId_game", ["playerId", "game"]),

  multiplayer_rooms: defineTable({
    code: v.string(),
    hostId: v.id("players"),
    guestId: v.optional(v.id("players")),
    game: v.union(
      v.literal("cricket"),
      v.literal("football"),
      v.literal("baseball")
    ),
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished")
    ),
    hostScore: v.optional(v.number()),
    guestScore: v.optional(v.number()),
    created: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_hostId", ["hostId"])
    .index("by_status", ["status"])
    .index("by_game", ["game"])
    .index("by_created", ["created"]),

  multiplayer_queue: defineTable({
    playerId: v.id("players"),
    game: v.union(
      v.literal("cricket"),
      v.literal("football"),
      v.literal("baseball")
    ),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    status: v.union(v.literal("searching"), v.literal("matched")),
    matchedRoomId: v.optional(v.id("multiplayer_rooms")),
    timestamp: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_game", ["game"])
    .index("by_status", ["status"])
    .index("by_game_status", ["game", "status"]),

  achievements: defineTable({
    playerId: v.id("players"),
    achievementId: v.string(),
    unlockedAt: v.number(),
    game: v.union(
      v.literal("cricket"),
      v.literal("football"),
      v.literal("baseball")
    ),
  })
    .index("by_playerId", ["playerId"])
    .index("by_game", ["game"])
    .index("by_playerId_game", ["playerId", "game"]),

  campaign_progress: defineTable({
    playerId: v.id("players"),
    game: v.union(
      v.literal("cricket"),
      v.literal("football"),
      v.literal("baseball")
    ),
    level: v.number(),
    stars: v.number(),
    bestScore: v.number(),
    completedAt: v.optional(v.number()),
    lastPlayedAt: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_game", ["game"])
    .index("by_playerId_game", ["playerId", "game"]),

  seasons: defineTable({
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    game: v.union(
      v.literal("cricket"),
      v.literal("football"),
      v.literal("baseball")
    ),
    active: v.boolean(),
  })
    .index("by_game", ["game"])
    .index("by_active", ["active"]),

  analytics_events: defineTable({
    playerId: v.id("players"),
    event: v.string(),
    game: v.optional(
      v.union(
        v.literal("cricket"),
        v.literal("football"),
        v.literal("baseball")
      )
    ),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))
    ),
    metadata: v.object({}),
    timestamp: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_event", ["event"])
    .index("by_timestamp", ["timestamp"]),
});

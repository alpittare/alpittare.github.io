import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getLeaderboard = query({
  args: {
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const limit = args.limit || 100;

    const leaderboard = await ctx.db
      .query("leaderboard")
      .withIndex("by_game_difficulty", (q) =>
        q.eq("game", args.game).eq("difficulty", args.difficulty)
      )
      .collect();

    return leaderboard
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.updatedAt - b.updatedAt; // Earlier update = better (achieved first)
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
      .slice(0, limit);
  },
});

export const getPlayerRank = query({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  },
  async handler(ctx, args) {
    const playerEntry = await ctx.db
      .query("leaderboard")
      .withIndex("by_playerId_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .first();

    if (!playerEntry) {
      return null;
    }

    const allEntries = await ctx.db
      .query("leaderboard")
      .withIndex("by_game_difficulty", (q) =>
        q.eq("game", args.game).eq("difficulty", args.difficulty)
      )
      .collect();

    const ranked = allEntries
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.updatedAt - b.updatedAt;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    const playerRank = ranked.find((e) => e.playerId === args.playerId);
    return playerRank || null;
  },
});

export const updateLeaderboard = mutation({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
    score: v.number(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  },
  async handler(ctx, args) {
    if (args.score < 0) {
      throw new Error("Score cannot be negative");
    }

    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    // Get active season
    const activeSeason = await ctx.db
      .query("seasons")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

    if (!activeSeason) {
      throw new Error("No active season found");
    }

    // Check if entry already exists
    const existing = await ctx.db
      .query("leaderboard")
      .withIndex("by_playerId_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Only update if new score is better
      if (args.score > existing.score) {
        const updated = {
          ...existing,
          score: args.score,
          difficulty: args.difficulty,
          updatedAt: now,
        };
        await ctx.db.replace(existing._id, updated);
        return updated;
      }
      return existing;
    } else {
      // Create new entry
      const entryId = await ctx.db.insert("leaderboard", {
        playerId: args.playerId,
        playerName: player.name,
        game: args.game,
        score: args.score,
        difficulty: args.difficulty,
        rank: 0, // Will be calculated on query
        season: activeSeason._id,
        updatedAt: now,
      });

      const entry = await ctx.db.get(entryId);
      return entry;
    }
  },
});

export const getSeasonLeaderboard = query({
  args: {
    seasonId: v.id("seasons"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const limit = args.limit || 100;

    const entries = await ctx.db
      .query("leaderboard")
      .withIndex("by_season", (q) => q.eq("season", args.seasonId))
      .collect();

    const filtered = entries.filter((e) => e.game === args.game);

    return filtered
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.updatedAt - b.updatedAt;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
      .slice(0, limit);
  },
});

export const getAllSeasons = query({
  async handler(ctx) {
    return await ctx.db.query("seasons").collect();
  },
});

export const getActiveSeason = query({
  async handler(ctx) {
    return await ctx.db
      .query("seasons")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();
  },
});

export const createSeason = mutation({
  args: {
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
  },
  async handler(ctx, args) {
    if (args.endDate <= args.startDate) {
      throw new Error("End date must be after start date");
    }

    // Deactivate other seasons for this game
    const existingSeasons = await ctx.db
      .query("seasons")
      .withIndex("by_game", (q) => q.eq("game", args.game))
      .collect();

    for (const season of existingSeasons) {
      if (season.active) {
        await ctx.db.replace(season._id, {
          ...season,
          active: false,
        });
      }
    }

    return await ctx.db.insert("seasons", {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      game: args.game,
      active: true,
    });
  },
});

export const getTopPlayers = query({
  args: {
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const limit = args.limit || 10;

    const allEntries = await ctx.db.query("leaderboard").collect();

    // Group by playerId and get best score across all games/difficulties
    const playerScores = new Map<string, { playerId: Id<"players">; playerName: string; totalScore: number }>();

    for (const entry of allEntries) {
      const key = entry.playerId.toString();
      if (playerScores.has(key)) {
        const existing = playerScores.get(key)!;
        existing.totalScore += entry.score;
      } else {
        playerScores.set(key, {
          playerId: entry.playerId,
          playerName: entry.playerName,
          totalScore: entry.score,
        });
      }
    }

    return Array.from(playerScores.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit);
  },
});

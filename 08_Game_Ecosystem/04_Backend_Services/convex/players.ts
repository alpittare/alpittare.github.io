import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const registerPlayer = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
  },
  async handler(ctx, args) {
    // Validate input
    if (!args.name || args.name.trim().length === 0) {
      throw new Error("Player name is required");
    }
    if (args.name.length > 100) {
      throw new Error("Player name must be 100 characters or less");
    }

    // Check if email already exists (if provided)
    if (args.email) {
      const existing = await ctx.db
        .query("players")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();

      if (existing) {
        throw new Error("Email already registered");
      }
    }

    const now = Date.now();
    const playerId = await ctx.db.insert("players", {
      name: args.name.trim(),
      email: args.email,
      created: now,
      lastSeen: now,
      stats: {
        gamesPlayed: 0,
        totalWins: 0,
        totalScore: 0,
      },
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        difficulty: "medium",
        theme: "light",
      },
    });

    return { playerId };
  },
});

export const getPlayer = query({
  args: {
    playerId: v.id("players"),
  },
  async handler(ctx, args) {
    const player = await ctx.db.get(args.playerId);

    if (!player) {
      throw new Error("Player not found");
    }

    return player;
  },
});

export const updatePlayerStats = mutation({
  args: {
    playerId: v.id("players"),
    gamesPlayed: v.optional(v.number()),
    totalWins: v.optional(v.number()),
    totalScore: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const player = await ctx.db.get(args.playerId);

    if (!player) {
      throw new Error("Player not found");
    }

    const updated = {
      ...player,
      stats: {
        gamesPlayed: args.gamesPlayed ?? player.stats.gamesPlayed,
        totalWins: args.totalWins ?? player.stats.totalWins,
        totalScore: args.totalScore ?? player.stats.totalScore,
      },
    };

    await ctx.db.replace(args.playerId, updated);
    return updated;
  },
});

export const updatePlayerSettings = mutation({
  args: {
    playerId: v.id("players"),
    soundEnabled: v.optional(v.boolean()),
    musicEnabled: v.optional(v.boolean()),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))
    ),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
  },
  async handler(ctx, args) {
    const player = await ctx.db.get(args.playerId);

    if (!player) {
      throw new Error("Player not found");
    }

    const updated = {
      ...player,
      settings: {
        soundEnabled:
          args.soundEnabled !== undefined
            ? args.soundEnabled
            : player.settings.soundEnabled,
        musicEnabled:
          args.musicEnabled !== undefined
            ? args.musicEnabled
            : player.settings.musicEnabled,
        difficulty: args.difficulty ?? player.settings.difficulty,
        theme: args.theme ?? player.settings.theme,
      },
    };

    await ctx.db.replace(args.playerId, updated);
    return updated;
  },
});

export const updateLastSeen = mutation({
  args: {
    playerId: v.id("players"),
  },
  async handler(ctx, args) {
    const player = await ctx.db.get(args.playerId);

    if (!player) {
      throw new Error("Player not found");
    }

    const updated = {
      ...player,
      lastSeen: Date.now(),
    };

    await ctx.db.replace(args.playerId, updated);
    return updated;
  },
});

export const getPlayerByEmail = query({
  args: {
    email: v.string(),
  },
  async handler(ctx, args) {
    const player = await ctx.db
      .query("players")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    return player || null;
  },
});

export const searchPlayers = query({
  args: {
    search: v.string(),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const limit = args.limit || 10;
    const searchTerm = args.search.toLowerCase();

    const allPlayers = await ctx.db.query("players").collect();

    return allPlayers
      .filter((p) => p.name.toLowerCase().includes(searchTerm))
      .slice(0, limit);
  },
});

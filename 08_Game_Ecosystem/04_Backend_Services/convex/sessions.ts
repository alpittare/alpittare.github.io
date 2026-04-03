import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const submitGameSession = mutation({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
    score: v.number(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    won: v.boolean(),
    duration: v.number(),
  },
  async handler(ctx, args) {
    // Validate input
    if (args.score < 0) {
      throw new Error("Score cannot be negative");
    }
    if (args.duration < 0) {
      throw new Error("Duration cannot be negative");
    }

    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    // Insert session
    const sessionId = await ctx.db.insert("sessions", {
      playerId: args.playerId,
      game: args.game,
      score: args.score,
      difficulty: args.difficulty,
      won: args.won,
      duration: args.duration,
      timestamp: Date.now(),
    });

    // Update player stats
    const newStats = {
      ...player.stats,
      gamesPlayed: player.stats.gamesPlayed + 1,
      totalWins: args.won ? player.stats.totalWins + 1 : player.stats.totalWins,
      totalScore: player.stats.totalScore + args.score,
    };

    const updated = {
      ...player,
      stats: newStats,
      lastSeen: Date.now(),
    };

    await ctx.db.replace(args.playerId, updated);

    return {
      sessionId,
      stats: newStats,
    };
  },
});

export const getPlayerSessions = query({
  args: {
    playerId: v.id("players"),
    limit: v.optional(v.number()),
    game: v.optional(
      v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball"))
    ),
  },
  async handler(ctx, args) {
    const limit = args.limit || 20;

    let query = ctx.db
      .query("sessions")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId));

    const sessions = await query.collect();

    const filtered = args.game
      ? sessions.filter((s) => s.game === args.game)
      : sessions;

    return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  },
});

export const getSessionStats = query({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
  },
  async handler(ctx, args) {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_playerId_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .collect();

    if (sessions.length === 0) {
      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        averageScore: 0,
        averageDuration: 0,
        bestScore: 0,
        difficultyBreakdown: {
          easy: { games: 0, wins: 0 },
          medium: { games: 0, wins: 0 },
          hard: { games: 0, wins: 0 },
        },
      };
    }

    const wins = sessions.filter((s) => s.won).length;
    const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const bestScore = Math.max(...sessions.map((s) => s.score));

    const difficultyBreakdown = {
      easy: {
        games: sessions.filter((s) => s.difficulty === "easy").length,
        wins: sessions.filter((s) => s.difficulty === "easy" && s.won).length,
      },
      medium: {
        games: sessions.filter((s) => s.difficulty === "medium").length,
        wins: sessions.filter((s) => s.difficulty === "medium" && s.won).length,
      },
      hard: {
        games: sessions.filter((s) => s.difficulty === "hard").length,
        wins: sessions.filter((s) => s.difficulty === "hard" && s.won).length,
      },
    };

    return {
      totalGames: sessions.length,
      wins,
      winRate: wins / sessions.length,
      averageScore: totalScore / sessions.length,
      averageDuration: totalDuration / sessions.length,
      bestScore,
      difficultyBreakdown,
    };
  },
});

export const getRecentSessions = query({
  args: {
    game: v.optional(
      v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball"))
    ),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const limit = args.limit || 50;
    const allSessions = await ctx.db
      .query("sessions")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const filtered = args.game
      ? allSessions.filter((s) => s.game === args.game)
      : allSessions;

    return filtered.slice(0, limit);
  },
});

export const deleteSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  async handler(ctx, args) {
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // Update player stats
    const player = await ctx.db.get(session.playerId);
    if (player) {
      const newStats = {
        ...player.stats,
        gamesPlayed: Math.max(0, player.stats.gamesPlayed - 1),
        totalWins: session.won
          ? Math.max(0, player.stats.totalWins - 1)
          : player.stats.totalWins,
        totalScore: Math.max(0, player.stats.totalScore - session.score),
      };

      const updated = {
        ...player,
        stats: newStats,
      };

      await ctx.db.replace(session.playerId, updated);
    }

    await ctx.db.delete(args.sessionId);
    return { success: true };
  },
});

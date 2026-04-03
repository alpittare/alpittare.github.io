/**
 * Player mutations
 *
 * registerPlayer  – create new player with zeroed stats
 * updatePlayerStats – sync lifetime stats from device after session ends
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Mutations ───────────────────────────────────────────────────────

export const registerPlayer = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new Error("Name cannot be empty");
    if (trimmed.length > 50) throw new Error("Name must be ≤50 characters");

    // Prevent duplicates
    const existing = await ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", trimmed))
      .first();
    if (existing) throw new Error(`Player "${trimmed}" already exists`);

    const now = Date.now();
    const zeroBestScores = { crickbot: 0, goalbot: 0, basehit: 0 };
    const zeroCrickbot = {
      totalRuns: 0, totalFours: 0, totalSixes: 0,
      totalBallsFaced: 0, totalWins: 0, legendWins: 0,
    };
    const zeroGoalbot = {
      totalGoals: 0, totalShots: 0, totalSaves: 0, shotAccuracy: 0,
    };
    const zeroBasehit = {
      totalHRs: 0, totalSwings: 0, totalGoodHits: 0,
      totalFouls: 0, totalStrikes: 0, bestStreak: 0,
    };

    const playerId = await ctx.db.insert("players", {
      name: trimmed,
      createdAt: now,
      totalGamesPlayed: 0,
      totalCoinsEarned: 0,
      level: 1,
      xp: 0,
      bestScores: zeroBestScores,
      crickbotStats: zeroCrickbot,
      goalbotStats: zeroGoalbot,
      basehitStats: zeroBasehit,
    });

    return playerId;
  },
});

export const updatePlayerStats = mutation({
  args: {
    playerId: v.id("players"),
    totalGamesPlayed: v.optional(v.number()),
    totalCoinsEarned: v.optional(v.number()),
    level: v.optional(v.number()),
    xp: v.optional(v.number()),
    bestScores: v.optional(v.object({
      crickbot: v.optional(v.number()),
      goalbot: v.optional(v.number()),
      basehit: v.optional(v.number()),
      survivalarena: v.optional(v.number()),
    })),
    crickbotStats: v.optional(v.object({
      totalRuns: v.number(),
      totalFours: v.number(),
      totalSixes: v.number(),
      totalBallsFaced: v.number(),
      totalWins: v.number(),
      legendWins: v.number(),
    })),
    goalbotStats: v.optional(v.object({
      totalGoals: v.number(),
      totalShots: v.number(),
      totalSaves: v.number(),
      shotAccuracy: v.number(),
    })),
    basehitStats: v.optional(v.object({
      totalHRs: v.number(),
      totalSwings: v.number(),
      totalGoodHits: v.number(),
      totalFouls: v.number(),
      totalStrikes: v.number(),
      bestStreak: v.number(),
    })),
    survivalarenaStats: v.optional(v.object({
      totalKills: v.number(),
      totalWins: v.number(),
      bestKills: v.number(),
      bestStreak: v.number(),
      levelsCompleted: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    // Build patch object — only include fields that were sent
    const patch: Record<string, any> = {};
    if (args.totalGamesPlayed != null) patch.totalGamesPlayed = args.totalGamesPlayed;
    if (args.totalCoinsEarned != null) patch.totalCoinsEarned = args.totalCoinsEarned;
    if (args.level != null) patch.level = args.level;
    if (args.xp != null) patch.xp = args.xp;

    // Merge bestScores — preserve existing, overlay new
    if (args.bestScores) {
      const merged = { ...player.bestScores };
      if (args.bestScores.crickbot != null) merged.crickbot = Math.max(merged.crickbot ?? 0, args.bestScores.crickbot);
      if (args.bestScores.goalbot != null) merged.goalbot = Math.max(merged.goalbot ?? 0, args.bestScores.goalbot);
      if (args.bestScores.basehit != null) merged.basehit = Math.max(merged.basehit ?? 0, args.bestScores.basehit);
      if (args.bestScores.survivalarena != null) merged.survivalarena = Math.max(merged.survivalarena ?? 0, args.bestScores.survivalarena);
      patch.bestScores = merged;
    }

    // Game-specific stats — only patch if provided
    if (args.crickbotStats) patch.crickbotStats = args.crickbotStats;
    if (args.goalbotStats) patch.goalbotStats = args.goalbotStats;
    if (args.basehitStats) patch.basehitStats = args.basehitStats;
    if (args.survivalarenaStats) patch.survivalarenaStats = args.survivalarenaStats;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.playerId, patch);
    }

    return { success: true };
  },
});

// ── Queries ─────────────────────────────────────────────────────────

export const getPlayer = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, { playerId }) => {
    return ctx.db.get(playerId);
  },
});

export const getPlayerByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", name.trim()))
      .first();
  },
});

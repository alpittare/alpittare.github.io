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
    totalGamesPlayed: v.number(),
    totalCoinsEarned: v.number(),
    level: v.number(),
    xp: v.number(),
    bestScores: v.object({
      crickbot: v.number(),
      goalbot: v.number(),
      basehit: v.number(),
    }),
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
      totalSaves: v.number(),
      shotAccuracy: v.number(),
    }),
    basehitStats: v.object({
      totalHRs: v.number(),
      totalSwings: v.number(),
      totalGoodHits: v.number(),
      totalFouls: v.number(),
      totalStrikes: v.number(),
      bestStreak: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    await ctx.db.patch(args.playerId, {
      totalGamesPlayed: args.totalGamesPlayed,
      totalCoinsEarned: args.totalCoinsEarned,
      level: args.level,
      xp: args.xp,
      bestScores: args.bestScores,
      crickbotStats: args.crickbotStats,
      goalbotStats: args.goalbotStats,
      basehitStats: args.basehitStats,
    });

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

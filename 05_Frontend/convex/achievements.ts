/**
 * Achievement mutations & queries
 *
 * unlockAchievement   – record a newly unlocked achievement
 * getPlayerAchievements – all achievements for a player
 * hasAchievement       – check if a specific achievement is unlocked
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const unlockAchievement = mutation({
  args: {
    playerId: v.id("players"),
    achievementId: v.string(),
    game: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    // Idempotent: don't double-insert
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_player_achievement", (q) =>
        q.eq("playerId", args.playerId).eq("achievementId", args.achievementId)
      )
      .first();

    if (existing) return existing._id; // already unlocked

    return ctx.db.insert("achievements", {
      playerId: args.playerId,
      achievementId: args.achievementId,
      game: args.game,
      unlockedAt: Date.now(),
    });
  },
});

export const getPlayerAchievements = query({
  args: {
    playerId: v.id("players"),
    game: v.optional(v.string()),
  },
  handler: async (ctx, { playerId, game }) => {
    const all = await ctx.db
      .query("achievements")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .collect();

    if (game) return all.filter((a) => a.game === game);
    return all;
  },
});

export const hasAchievement = query({
  args: {
    playerId: v.id("players"),
    achievementId: v.string(),
  },
  handler: async (ctx, { playerId, achievementId }) => {
    const entry = await ctx.db
      .query("achievements")
      .withIndex("by_player_achievement", (q) =>
        q.eq("playerId", playerId).eq("achievementId", achievementId)
      )
      .first();

    return entry !== null;
  },
});

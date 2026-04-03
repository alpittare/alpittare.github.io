/**
 * Campaign Progress — sync + query
 *
 * syncCampaign       – upsert campaign state from device
 * getCampaignProgress – fetch saved campaign state
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncCampaign = mutation({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("crickbot"), v.literal("goalbot"), v.literal("basehit"), v.literal("survivalarena"), v.literal("infinitevoyager")),
    currentLevel: v.number(),
    totalStars: v.number(),
    levelStars: v.any(), // { "1": 3, "2": 2, ... }
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    const now = Date.now();

    // Check for existing entry
    const existing = await ctx.db
      .query("campaign_progress")
      .withIndex("by_player_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .first();

    if (existing) {
      // Always merge using Math.max — safe for offline sync conflicts.
      // Even if device sends lower values, patch only writes the max.
      const newLevel = Math.max(args.currentLevel, existing.currentLevel);
      const newStars = Math.max(args.totalStars, existing.totalStars);

      // Skip write entirely if nothing changed (saves a DB op)
      if (
        newLevel === existing.currentLevel &&
        newStars === existing.totalStars
      ) {
        return existing._id;
      }

      await ctx.db.patch(existing._id, {
        currentLevel: newLevel,
        totalStars: newStars,
        levelStars: args.levelStars,
        updatedAt: now,
      });
      return existing._id;
    }

    // First sync — create
    return ctx.db.insert("campaign_progress", {
      playerId: args.playerId,
      game: args.game,
      currentLevel: args.currentLevel,
      totalStars: args.totalStars,
      levelStars: args.levelStars,
      updatedAt: now,
    });
  },
});

export const getCampaignProgress = query({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("crickbot"), v.literal("goalbot"), v.literal("basehit"), v.literal("survivalarena"), v.literal("infinitevoyager")),
  },
  handler: async (ctx, { playerId, game }) => {
    return ctx.db
      .query("campaign_progress")
      .withIndex("by_player_game", (q) =>
        q.eq("playerId", playerId).eq("game", game)
      )
      .first();
  },
});

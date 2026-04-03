import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const syncCampaign = mutation({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
    level: v.number(),
    stars: v.number(),
    bestScore: v.number(),
  },
  async handler(ctx, args) {
    if (args.level < 1) {
      throw new Error("Level must be 1 or higher");
    }
    if (args.stars < 0 || args.stars > 3) {
      throw new Error("Stars must be between 0 and 3");
    }
    if (args.bestScore < 0) {
      throw new Error("Best score cannot be negative");
    }

    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    // Find existing progress
    const existing = await ctx.db
      .query("campaign_progress")
      .withIndex("by_playerId_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Only update if better progress
      const updated = {
        ...existing,
        level: Math.max(existing.level, args.level),
        stars: Math.max(existing.stars, args.stars),
        bestScore: Math.max(existing.bestScore, args.bestScore),
        lastPlayedAt: now,
        completedAt:
          args.level > existing.level ? now : existing.completedAt,
      };

      await ctx.db.replace(existing._id, updated);
      return updated;
    } else {
      const progressId = await ctx.db.insert("campaign_progress", {
        playerId: args.playerId,
        game: args.game,
        level: args.level,
        stars: args.stars,
        bestScore: args.bestScore,
        lastPlayedAt: now,
        completedAt: args.level > 1 ? now : undefined,
      });

      return await ctx.db.get(progressId);
    }
  },
});

export const getCampaignProgress = query({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
  },
  async handler(ctx, args) {
    const progress = await ctx.db
      .query("campaign_progress")
      .withIndex("by_playerId_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .first();

    if (!progress) {
      // Return default progress for new players
      return {
        playerId: args.playerId,
        game: args.game,
        level: 1,
        stars: 0,
        bestScore: 0,
        lastPlayedAt: Date.now(),
      };
    }

    return progress;
  },
});

export const getAllCampaignProgress = query({
  args: {
    playerId: v.id("players"),
  },
  async handler(ctx, args) {
    const allProgress = await ctx.db
      .query("campaign_progress")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();

    // Ensure all games are represented
    const games = ["cricket", "football", "baseball"] as const;
    const result = games.map((game) => {
      const existing = allProgress.find((p) => p.game === game);
      return (
        existing || {
          playerId: args.playerId,
          game,
          level: 1,
          stars: 0,
          bestScore: 0,
          lastPlayedAt: Date.now(),
        }
      );
    });

    return result;
  },
});

export const getCampaignLeaderboard = query({
  args: {
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
    level: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const limit = args.limit || 100;

    const allProgress = await ctx.db
      .query("campaign_progress")
      .withIndex("by_game", (q) => q.eq("game", args.game))
      .collect();

    const filtered = args.level
      ? allProgress.filter((p) => p.level === args.level)
      : allProgress;

    return filtered
      .sort((a, b) => {
        // Sort by best score descending, then by level descending
        if (b.bestScore !== a.bestScore) {
          return b.bestScore - a.bestScore;
        }
        return b.level - a.level;
      })
      .slice(0, limit)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  },
});

export const getCampaignStats = query({
  args: {
    playerId: v.id("players"),
  },
  async handler(ctx, args) {
    const allProgress = await ctx.db
      .query("campaign_progress")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();

    const totalStars = allProgress.reduce((sum, p) => sum + p.stars, 0);
    const maxLevelPerGame = {
      cricket: Math.max(
        ...(allProgress
          .filter((p) => p.game === "cricket")
          .map((p) => p.level) || [0])
      ),
      football: Math.max(
        ...(allProgress
          .filter((p) => p.game === "football")
          .map((p) => p.level) || [0])
      ),
      baseball: Math.max(
        ...(allProgress
          .filter((p) => p.game === "baseball")
          .map((p) => p.level) || [0])
      ),
    };

    const totalLevelsCompleted = allProgress.reduce((sum, p) => {
      return sum + (p.completedAt ? 1 : 0);
    }, 0);

    const averageScorePerGame = {
      cricket:
        allProgress
          .filter((p) => p.game === "cricket")
          .reduce((sum, p) => sum + p.bestScore, 0) /
          Math.max(
            allProgress.filter((p) => p.game === "cricket").length,
            1
          ) || 0,
      football:
        allProgress
          .filter((p) => p.game === "football")
          .reduce((sum, p) => sum + p.bestScore, 0) /
          Math.max(
            allProgress.filter((p) => p.game === "football").length,
            1
          ) || 0,
      baseball:
        allProgress
          .filter((p) => p.game === "baseball")
          .reduce((sum, p) => sum + p.bestScore, 0) /
          Math.max(
            allProgress.filter((p) => p.game === "baseball").length,
            1
          ) || 0,
    };

    return {
      totalStars,
      maxLevelPerGame,
      totalLevelsCompleted,
      averageScorePerGame,
    };
  },
});

export const unlockNextLevel = mutation({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
  },
  async handler(ctx, args) {
    const progress = await ctx.db
      .query("campaign_progress")
      .withIndex("by_playerId_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .first();

    if (!progress) {
      throw new Error("No campaign progress found");
    }

    const maxLevels = 50; // Configure as needed
    if (progress.level >= maxLevels) {
      throw new Error("Already at maximum level");
    }

    const updated = {
      ...progress,
      level: progress.level + 1,
      lastPlayedAt: Date.now(),
    };

    await ctx.db.replace(progress._id, updated);
    return updated;
  },
});

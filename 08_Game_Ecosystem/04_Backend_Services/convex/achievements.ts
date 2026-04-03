import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Achievement definitions - can be expanded
const ACHIEVEMENT_DEFINITIONS: Record<string, { name: string; description: string; category: string }> = {
  first_win: {
    name: "First Blood",
    description: "Win your first game",
    category: "milestone",
  },
  ten_wins: {
    name: "Winning Streak",
    description: "Win 10 games",
    category: "milestone",
  },
  fifty_wins: {
    name: "Champion",
    description: "Win 50 games",
    category: "milestone",
  },
  perfect_score: {
    name: "Perfect Shot",
    description: "Achieve perfect score in a game",
    category: "skill",
  },
  speedrun: {
    name: "Speed Demon",
    description: "Complete a game in under 30 seconds",
    category: "skill",
  },
  leaderboard_top_10: {
    name: "Top 10 Player",
    description: "Reach top 10 in any leaderboard",
    category: "rank",
  },
  hard_mode_master: {
    name: "Hard Mode Master",
    description: "Win 10 games on hard difficulty",
    category: "difficulty",
  },
  multiplayer_win: {
    name: "Head-to-Head Victor",
    description: "Win your first multiplayer match",
    category: "multiplayer",
  },
  all_games: {
    name: "Versatile Player",
    description: "Play all three games",
    category: "exploration",
  },
};

export const unlockAchievement = mutation({
  args: {
    playerId: v.id("players"),
    achievementId: v.string(),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
  },
  async handler(ctx, args) {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    if (!ACHIEVEMENT_DEFINITIONS[args.achievementId]) {
      throw new Error("Invalid achievement ID");
    }

    // Check if already unlocked
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_playerId_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .collect();

    const alreadyUnlocked = existing.some(
      (a) => a.achievementId === args.achievementId
    );

    if (alreadyUnlocked) {
      throw new Error("Achievement already unlocked");
    }

    const achievementId = await ctx.db.insert("achievements", {
      playerId: args.playerId,
      achievementId: args.achievementId,
      game: args.game,
      unlockedAt: Date.now(),
    });

    return await ctx.db.get(achievementId);
  },
});

export const getPlayerAchievements = query({
  args: {
    playerId: v.id("players"),
    game: v.optional(
      v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball"))
    ),
  },
  async handler(ctx, args) {
    let query = ctx.db
      .query("achievements")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId));

    const achievements = await query.collect();

    const filtered = args.game
      ? achievements.filter((a) => a.game === args.game)
      : achievements;

    return filtered
      .map((a) => ({
        ...a,
        ...ACHIEVEMENT_DEFINITIONS[a.achievementId],
      }))
      .sort((a, b) => b.unlockedAt - a.unlockedAt);
  },
});

export const getAchievementProgress = query({
  args: {
    playerId: v.id("players"),
    achievementId: v.string(),
    game: v.optional(
      v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball"))
    ),
  },
  async handler(ctx, args) {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    const definition = ACHIEVEMENT_DEFINITIONS[args.achievementId];
    if (!definition) {
      throw new Error("Invalid achievement ID");
    }

    // Get all sessions for this player
    let sessionsQuery = ctx.db
      .query("sessions")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId));

    const sessions = await sessionsQuery.collect();

    let progress = 0;
    let unlocked = false;
    let requirement = 0;

    // Calculate progress based on achievement type
    switch (args.achievementId) {
      case "first_win":
        progress = sessions.some((s) => s.won) ? 1 : 0;
        requirement = 1;
        break;

      case "ten_wins": {
        const wins = sessions.filter((s) => s.won).length;
        progress = Math.min(wins, 10);
        requirement = 10;
        break;
      }

      case "fifty_wins": {
        const wins = sessions.filter((s) => s.won).length;
        progress = Math.min(wins, 50);
        requirement = 50;
        break;
      }

      case "perfect_score": {
        const perfect = sessions.some((s) => s.score >= 100);
        progress = perfect ? 1 : 0;
        requirement = 1;
        break;
      }

      case "speedrun": {
        const speedrun = sessions.some((s) => s.duration < 30);
        progress = speedrun ? 1 : 0;
        requirement = 1;
        break;
      }

      case "hard_mode_master": {
        const hardWins = sessions.filter(
          (s) => s.difficulty === "hard" && s.won
        ).length;
        progress = Math.min(hardWins, 10);
        requirement = 10;
        break;
      }

      case "all_games": {
        const games = new Set(sessions.map((s) => s.game));
        progress = Math.min(games.size, 3);
        requirement = 3;
        break;
      }

      default:
        progress = 0;
        requirement = 1;
    }

    unlocked = progress >= requirement;

    return {
      achievementId: args.achievementId,
      ...definition,
      progress,
      requirement,
      unlocked,
      percentage: Math.min((progress / requirement) * 100, 100),
    };
  },
});

export const getAllAchievements = query({
  async handler(ctx) {
    return Object.entries(ACHIEVEMENT_DEFINITIONS).map(([id, def]) => ({
      id,
      ...def,
    }));
  },
});

export const getPlayerAchievementStats = query({
  args: {
    playerId: v.id("players"),
  },
  async handler(ctx, args) {
    const achievements = await ctx.db
      .query("achievements")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();

    const byGame = {
      cricket: achievements.filter((a) => a.game === "cricket").length,
      football: achievements.filter((a) => a.game === "football").length,
      baseball: achievements.filter((a) => a.game === "baseball").length,
    };

    const byCategory = {
      milestone: achievements.filter(
        (a) => ACHIEVEMENT_DEFINITIONS[a.achievementId]?.category === "milestone"
      ).length,
      skill: achievements.filter(
        (a) => ACHIEVEMENT_DEFINITIONS[a.achievementId]?.category === "skill"
      ).length,
      rank: achievements.filter(
        (a) => ACHIEVEMENT_DEFINITIONS[a.achievementId]?.category === "rank"
      ).length,
      difficulty: achievements.filter(
        (a) => ACHIEVEMENT_DEFINITIONS[a.achievementId]?.category === "difficulty"
      ).length,
      multiplayer: achievements.filter(
        (a) => ACHIEVEMENT_DEFINITIONS[a.achievementId]?.category === "multiplayer"
      ).length,
      exploration: achievements.filter(
        (a) => ACHIEVEMENT_DEFINITIONS[a.achievementId]?.category === "exploration"
      ).length,
    };

    return {
      total: achievements.length,
      byGame,
      byCategory,
      completionPercentage: (achievements.length / Object.keys(ACHIEVEMENT_DEFINITIONS).length) * 100,
    };
  },
});

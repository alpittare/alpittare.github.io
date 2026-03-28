/**
 * Game Session mutations & queries
 *
 * submitGameSession – log a completed game + update leaderboard
 * getMatchHistory   – per-player, per-game session history
 * getRecentSessions – global recent sessions feed
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Mutations ───────────────────────────────────────────────────────

export const submitGameSession = mutation({
  args: {
    playerId: v.id("players"),
    game: v.union(
      v.literal("crickbot"),
      v.literal("goalbot"),
      v.literal("basehit")
    ),
    score: v.number(),
    difficulty: v.string(),
    won: v.boolean(),
    duration: v.optional(v.number()),
    // Game-specific stats payload:
    // CrickBot: { runs, wickets, overs, target, fours, sixes }
    // GoalBot:  { goalsFor, goalsAgainst, totalShots, round }
    // BaseHit:  { homeRuns, swings, streak, perfectHits }
    stats: v.any(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");
    if (!Number.isFinite(args.score) || args.score < 0) {
      throw new Error("Score must be a non-negative number");
    }

    const now = Date.now();

    // 1. Insert session record
    const sessionId = await ctx.db.insert("game_sessions", {
      playerId: args.playerId,
      game: args.game,
      score: args.score,
      difficulty: args.difficulty,
      won: args.won,
      duration: args.duration,
      playedAt: now,
      stats: args.stats,
    });

    // 2. Update leaderboard if this is a new best score
    const leaderboardEntry = await ctx.db
      .query("leaderboard")
      .withIndex("by_player_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .first();

    // Count total games for this player+game
    const sessionCount = await ctx.db
      .query("game_sessions")
      .withIndex("by_player_game", (q) =>
        q.eq("playerId", args.playerId).eq("game", args.game)
      )
      .collect();

    if (leaderboardEntry) {
      // Update: only bump score if new best
      const newBest = Math.max(leaderboardEntry.score, args.score);
      await ctx.db.patch(leaderboardEntry._id, {
        score: newBest,
        name: player.name,
        gamesPlayed: sessionCount.length,
        updatedAt: now,
      });
    } else {
      // First session for this game — create leaderboard row
      await ctx.db.insert("leaderboard", {
        playerId: args.playerId,
        name: player.name,
        game: args.game,
        score: args.score,
        gamesPlayed: sessionCount.length,
        updatedAt: now,
      });
    }

    // 3. Update player's bestScores if applicable
    const currentBest = player.bestScores[args.game] ?? 0;
    if (args.score > currentBest) {
      const updatedBestScores = { ...player.bestScores };
      updatedBestScores[args.game] = args.score;
      await ctx.db.patch(args.playerId, {
        bestScores: updatedBestScores,
        totalGamesPlayed: player.totalGamesPlayed + 1,
      });
    } else {
      await ctx.db.patch(args.playerId, {
        totalGamesPlayed: player.totalGamesPlayed + 1,
      });
    }

    return sessionId;
  },
});

// ── Queries ─────────────────────────────────────────────────────────

export const getMatchHistory = query({
  args: {
    playerId: v.id("players"),
    game: v.optional(
      v.union(
        v.literal("crickbot"),
        v.literal("goalbot"),
        v.literal("basehit")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { playerId, game, limit }) => {
    const take = limit ?? 20;

    if (game) {
      return ctx.db
        .query("game_sessions")
        .withIndex("by_player_game", (q) =>
          q.eq("playerId", playerId).eq("game", game)
        )
        .order("desc")
        .take(take);
    }

    return ctx.db
      .query("game_sessions")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .order("desc")
      .take(take);
  },
});

export const getRecentSessions = query({
  args: {
    game: v.optional(
      v.union(
        v.literal("crickbot"),
        v.literal("goalbot"),
        v.literal("basehit")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { game, limit }) => {
    const take = limit ?? 20;

    const sessions = await ctx.db
      .query("game_sessions")
      .withIndex("by_played")
      .order("desc")
      .take(take * 3); // over-fetch for filter

    const filtered = game
      ? sessions.filter((s) => s.game === game).slice(0, take)
      : sessions.slice(0, take);

    // Hydrate player names
    return Promise.all(
      filtered.map(async (s) => {
        const player = await ctx.db.get(s.playerId);
        return { ...s, playerName: player?.name ?? "Unknown" };
      })
    );
  },
});

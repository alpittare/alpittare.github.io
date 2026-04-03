/**
 * Leaderboard queries
 *
 * getLeaderboard    – top-N per game (indexed descending scan)
 * getGlobalRanking  – top players across all games (sum of best scores)
 * getPlayerRank     – single player's rank in a specific game
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

export const getLeaderboard = query({
  args: {
    game: v.union(
      v.literal("crickbot"),
      v.literal("goalbot"),
      v.literal("basehit"),
      v.literal("survivalarena")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { game, limit }) => {
    const topN = limit ?? 10;

    // Collect all entries for this game, then sort by score descending in JS
    // (Convex .order("desc") orders by _creationTime, not by trailing index field)
    const entries = await ctx.db
      .query("leaderboard")
      .withIndex("by_game_score", (q) => q.eq("game", game))
      .collect();

    entries.sort((a, b) => b.score - a.score);
    const topEntries = entries.slice(0, topN);

    return topEntries.map((entry, i) => ({
      rank: i + 1,
      playerId: entry.playerId,
      name: entry.name,
      score: entry.score,
      gamesPlayed: entry.gamesPlayed,
    }));
  },
});

export const getGlobalRanking = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const topN = limit ?? 10;

    // Aggregate best scores across all 3 games per player
    const allEntries = await ctx.db.query("leaderboard").collect();

    // Group by playerId and sum scores
    const playerScores = new Map<
      string,
      { name: string; total: number; games: number }
    >();

    for (const entry of allEntries) {
      const pid = entry.playerId;
      const existing = playerScores.get(pid);
      if (existing) {
        existing.total += entry.score;
        existing.games += entry.gamesPlayed;
      } else {
        playerScores.set(pid, {
          name: entry.name,
          total: entry.score,
          games: entry.gamesPlayed,
        });
      }
    }

    // Sort descending by total, take top-N
    const sorted = Array.from(playerScores.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, topN);

    return sorted.map(([playerId, data], i) => ({
      rank: i + 1,
      playerId,
      name: data.name,
      totalScore: data.total,
      totalGamesPlayed: data.games,
    }));
  },
});

export const getPlayerRank = query({
  args: {
    playerId: v.id("players"),
    game: v.union(
      v.literal("crickbot"),
      v.literal("goalbot"),
      v.literal("basehit"),
      v.literal("survivalarena")
    ),
  },
  handler: async (ctx, { playerId, game }) => {
    // Get all entries for this game, sort by score descending in JS
    const all = await ctx.db
      .query("leaderboard")
      .withIndex("by_game_score", (q) => q.eq("game", game))
      .collect();

    all.sort((a, b) => b.score - a.score);
    const idx = all.findIndex((e) => e.playerId === playerId);
    if (idx === -1) return null;

    return {
      rank: idx + 1,
      totalPlayers: all.length,
      score: all[idx].score,
      name: all[idx].name,
    };
  },
});

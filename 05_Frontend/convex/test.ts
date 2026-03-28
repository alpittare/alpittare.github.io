import { query } from "./_generated/server";

export const testAuth = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    return user ?? "NOT LOGGED IN";
  },
});

export const healthCheck = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    const sessions = await ctx.db.query("game_sessions").collect();
    const leaderboard = await ctx.db.query("leaderboard").collect();
    const achievements = await ctx.db.query("achievements").collect();
    const campaign = await ctx.db.query("campaign_progress").collect();

    return {
      ok: true,
      tables: 5,
      counts: {
        players: players.length,
        game_sessions: sessions.length,
        leaderboard: leaderboard.length,
        achievements: achievements.length,
        campaign_progress: campaign.length,
      },
    };
  },
});
/**
 * Survival Arena IO → Convex Integration
 *
 * Drop this into Survival Arena's index.html (after game code loads).
 *
 * Hooks into:
 *   1. Game over → submitSession with arena-specific stats
 *   2. Campaign level complete → sync progress
 *   3. Achievement unlock → sync to cloud
 *   4. Periodic stats sync
 *   5. Leaderboard fetch → populate in-game leaderboard
 */

const convex = new ConvexGameClient();

const arenaSync = {
  /**
   * Submit completed game to Convex
   * @param {Object} gs - gameState instance
   * @param {Object} gameResult - Results from the just-completed game
   * @param {number} gameResult.score - Points scored
   * @param {number} gameResult.kills - Enemies eliminated
   * @param {number} gameResult.bestStreak - Best kill streak this game
   * @param {number} gameResult.surgeLevel - Max surge level reached
   * @param {boolean} gameResult.usedRage - Whether rage mode was activated
   * @param {number} gameResult.placement - Final placement (#1 = win)
   * @param {boolean} gameResult.won
   * @param {number} [gameResult.duration] - Seconds
   */
  async submitMatch(gs, gameResult) {
    try {
      const difficulty = gs.difficulty || "medium";
      await convex.submitSession(
        "survivalarena",
        gameResult.score,
        difficulty,
        gameResult.won,
        {
          kills: gameResult.kills || 0,
          bestStreak: gameResult.bestStreak || 0,
          surgeLevel: gameResult.surgeLevel || 0,
          usedRage: gameResult.usedRage || false,
          placement: gameResult.placement || 0,
          powerUpsCollected: gameResult.powerUpsCollected || 0,
          level: gs.level || 1,
        },
        gameResult.duration
      );
      console.log("[SurvivalArena→Convex] Session submitted");
    } catch (e) {
      console.warn("[SurvivalArena→Convex] Submit failed:", e.message);
    }
  },

  /**
   * Sync career stats
   * @param {Object} gs - gameState
   */
  async syncCareerStats(gs) {
    try {
      await convex.syncPlayerStats({
        totalGamesPlayed: gs.totalGames,
        totalCoinsEarned: gs.coins || 0,
        level: gs.level,
        xp: gs.xp,
        bestScores: {
          crickbot: 0,
          goalbot: 0,
          basehit: 0,
          survivalarena: gs.bestScore || 0,
        },
        crickbotStats: {
          totalRuns: 0, totalFours: 0, totalSixes: 0,
          totalBallsFaced: 0, totalWins: 0, legendWins: 0,
        },
        goalbotStats: {
          totalGoals: 0, totalShots: 0, totalSaves: 0, shotAccuracy: 0,
        },
        basehitStats: {
          totalHRs: 0, totalSwings: 0, totalGoodHits: 0,
          totalFouls: 0, totalStrikes: 0, bestStreak: 0,
        },
        survivalarenaStats: {
          totalKills: gs.missionProgress?.totalScore || 0,
          totalWins: gs.wins || 0,
          bestKills: gs.bestKills || 0,
          bestStreak: gs.missionProgress?.bestStreak || 0,
          levelsCompleted: gs.missionProgress?.levelsCompleted || 0,
        },
      });
      console.log("[SurvivalArena→Convex] Career stats synced");
    } catch (e) {
      console.warn("[SurvivalArena→Convex] Stats sync failed:", e.message);
    }
  },

  /**
   * Sync 100-level campaign progress
   * @param {Object} gs - gameState
   */
  async syncCampaign(gs) {
    try {
      const totalStars = Object.values(gs.levelStars || {}).reduce((a, b) => a + b, 0);
      await convex.syncCampaign(
        "survivalarena",
        gs.currentCampaignLevel || 1,
        totalStars,
        gs.levelStars || {}
      );
      console.log("[SurvivalArena→Convex] Campaign synced");
    } catch (e) {
      console.warn("[SurvivalArena→Convex] Campaign sync failed:", e.message);
    }
  },

  /**
   * Unlock an achievement
   * @param {string} achievementId
   */
  async unlockAchievement(achievementId) {
    try {
      await convex.unlockAchievement(achievementId, "survivalarena");
    } catch (e) {
      console.warn("[SurvivalArena→Convex] Achievement sync failed:", e.message);
    }
  },

  /**
   * Fetch leaderboard for display
   * @param {number} [limit=10]
   */
  async getLeaderboard(limit = 10) {
    try {
      return await convex.getLeaderboard("survivalarena", limit);
    } catch (e) {
      console.warn("[SurvivalArena→Convex] Leaderboard fetch failed:", e.message);
      return [];
    }
  },

  /**
   * Get player's rank
   */
  async getPlayerRank() {
    try {
      return await convex.getPlayerRank("survivalarena");
    } catch (e) {
      return null;
    }
  },
};

window.arenaSync = arenaSync;

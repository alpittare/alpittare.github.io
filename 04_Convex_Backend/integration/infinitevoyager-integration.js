/**
 * Infinite Voyager IO → Convex Integration
 *
 * Drop this into Infinite Voyager's index.html (after game code loads).
 *
 * Hooks into:
 *   1. Game over → submitSession with voyager-specific stats
 *   2. Campaign level complete → sync progress
 *   3. Achievement unlock → sync to cloud
 *   4. Periodic stats sync
 *   5. Leaderboard fetch → populate in-game leaderboard
 */

const convex = new ConvexGameClient();

const voyagerSync = {
  /**
   * Submit completed game to Convex
   * @param {Object} gs - gameState instance
   * @param {Object} gameResult - Results from the just-completed game
   * @param {number} gameResult.distance - Distance traveled
   * @param {number} gameResult.aliensKilled - Enemies eliminated
   * @param {number} gameResult.bossesDefeated - Number of bosses defeated
   * @param {number} gameResult.stormsCollected - Storms collected
   * @param {number} gameResult.bestCombo - Best combo multiplier achieved
   * @param {boolean} gameResult.won
   * @param {number} [gameResult.duration] - Seconds
   */
  async submitMatch(gs, gameResult) {
    try {
      const difficulty = gs.difficulty || "medium";
      await convex.submitSession(
        "infinitevoyager",
        gameResult.distance || 0,
        difficulty,
        gameResult.won,
        {
          distance: gameResult.distance || 0,
          aliensKilled: gameResult.aliensKilled || 0,
          bossesDefeated: gameResult.bossesDefeated || 0,
          stormsCollected: gameResult.stormsCollected || 0,
          bestCombo: gameResult.bestCombo || 0,
          powerUpsUsed: gameResult.powerUpsUsed || 0,
          companionLevel: gs.companionLevel || 0,
        },
        gameResult.duration
      );
      console.log("[InfiniteVoyager→Convex] Session submitted");
    } catch (e) {
      console.warn("[InfiniteVoyager→Convex] Submit failed:", e.message);
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
          survivalarena: 0,
          infinitevoyager: gs.bestDistance || 0,
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
          totalKills: 0,
          totalWins: 0,
          bestKills: 0,
          bestStreak: 0,
          levelsCompleted: 0,
        },
        infinitevoyagerStats: {
          totalDistance: gs.totalDistance || 0,
          totalAliensKilled: gs.stats?.totalAliensKilled || 0,
          totalBossesDefeated: gs.stats?.totalBossesDefeated || 0,
          totalStormsCollected: gs.stats?.totalStormsCollected || 0,
          bestDistance: gs.bestDistance || 0,
          bestCombo: gs.stats?.bestCombo || 0,
        },
      });
      console.log("[InfiniteVoyager→Convex] Career stats synced");
    } catch (e) {
      console.warn("[InfiniteVoyager→Convex] Stats sync failed:", e.message);
    }
  },

  /**
   * Sync campaign progress
   * @param {Object} gs - gameState
   */
  async syncCampaign(gs) {
    try {
      const totalStars = Object.values(gs.levelStars || {}).reduce((a, b) => a + b, 0);
      await convex.syncCampaign(
        "infinitevoyager",
        gs.currentCampaignLevel || 1,
        totalStars,
        gs.levelStars || {}
      );
      console.log("[InfiniteVoyager→Convex] Campaign synced");
    } catch (e) {
      console.warn("[InfiniteVoyager→Convex] Campaign sync failed:", e.message);
    }
  },

  /**
   * Unlock an achievement
   * @param {string} achievementId
   */
  async unlockAchievement(achievementId) {
    try {
      await convex.unlockAchievement(achievementId, "infinitevoyager");
    } catch (e) {
      console.warn("[InfiniteVoyager→Convex] Achievement sync failed:", e.message);
    }
  },

  /**
   * Fetch leaderboard for display
   * @param {number} [limit=10]
   */
  async getLeaderboard(limit = 10) {
    try {
      return await convex.getLeaderboard("infinitevoyager", limit);
    } catch (e) {
      console.warn("[InfiniteVoyager→Convex] Leaderboard fetch failed:", e.message);
      return [];
    }
  },

  /**
   * Get player's rank
   */
  async getPlayerRank() {
    try {
      return await convex.getPlayerRank("infinitevoyager");
    } catch (e) {
      return null;
    }
  },
};

window.voyagerSync = voyagerSync;

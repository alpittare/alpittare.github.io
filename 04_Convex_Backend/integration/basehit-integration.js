/**
 * BaseHit → Convex Integration
 *
 * Drop this into BaseHit's index.html (after game code loads).
 *
 * Hooks into:
 *   1. Game over → submitSession with baseball-specific stats
 *   2. Campaign level complete → sync progress
 *   3. Achievement unlock → sync to cloud
 *   4. Periodic stats sync
 */

const convex = new ConvexGameClient();

const basehitSync = {
  /**
   * Submit completed game to Convex
   * @param {GameState} gs - BaseHit's GameState instance
   * @param {Object} gameResult - Results from the just-completed game
   * @param {number} gameResult.score - Points scored
   * @param {number} gameResult.homeRuns - HRs hit
   * @param {number} gameResult.swings - Total swings
   * @param {number} gameResult.perfectHits - Perfect timing hits
   * @param {number} gameResult.streak - Consecutive wins
   * @param {boolean} gameResult.won
   * @param {number} [gameResult.duration] - Seconds
   */
  async submitMatch(gs, gameResult) {
    try {
      const difficulty = gs.settings?.difficulty || "medium";
      await convex.submitSession(
        "basehit",
        gameResult.score,
        difficulty,
        gameResult.won,
        {
          homeRuns: gameResult.homeRuns || 0,
          swings: gameResult.swings || 0,
          streak: gameResult.streak || gs.streak || 0,
          perfectHits: gameResult.perfectHits || 0,
          level: gs.campaignLevel || 1,
        },
        gameResult.duration
      );
      console.log("[BaseHit→Convex] Session submitted");
    } catch (e) {
      console.warn("[BaseHit→Convex] Submit failed:", e.message);
    }
  },

  /**
   * Sync career stats
   * @param {GameState} gs
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
          basehit: Math.max(
            gs.bestScoreByDiff.easy || 0,
            gs.bestScoreByDiff.medium || 0,
            gs.bestScoreByDiff.hard || 0,
            gs.bestScoreByDiff.legend || 0
          ),
        },
        crickbotStats: {
          totalRuns: 0, totalFours: 0, totalSixes: 0,
          totalBallsFaced: 0, totalWins: 0, legendWins: 0,
        },
        goalbotStats: {
          totalGoals: 0, totalShots: 0, totalSaves: 0, shotAccuracy: 0,
        },
        basehitStats: {
          totalHRs: gs.totalHRs || 0,
          totalSwings: gs.totalSwings || 0,
          totalGoodHits: gs.totalGoodHits || 0,
          totalFouls: gs.totalFouls || 0,
          totalStrikes: gs.totalStrikes || 0,
          bestStreak: gs.bestStreak || 0,
        },
      });
      console.log("[BaseHit→Convex] Career stats synced");
    } catch (e) {
      console.warn("[BaseHit→Convex] Stats sync failed:", e.message);
    }
  },

  /**
   * Sync 100-level campaign progress
   * @param {GameState} gs
   */
  async syncCampaign(gs) {
    try {
      await convex.syncCampaign(
        "basehit",
        gs.campaignLevel,
        gs.totalStars,
        gs.levelStars
      );
    } catch (e) {
      console.warn("[BaseHit→Convex] Campaign sync failed:", e.message);
    }
  },

  async unlockAchievement(achievementId) {
    try {
      await convex.unlockAchievement(achievementId, "basehit");
    } catch (e) {
      console.warn("[BaseHit→Convex] Achievement sync failed:", e.message);
    }
  },
};

window.basehitSync = basehitSync;

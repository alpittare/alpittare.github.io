/**
 * GoalBot → Convex Integration
 *
 * Drop this into GoalBot's index.html (after game code loads).
 *
 * Hooks into:
 *   1. Match end → submitSession with football-specific stats
 *   2. Achievement unlock → sync to cloud
 *   3. Periodic stats sync
 */

const convex = new ConvexGameClient();

const goalbotSync = {
  /**
   * Submit completed match to Convex
   * @param {Object} matchData
   * @param {number} matchData.goalsFor - Player's goals
   * @param {number} matchData.goalsAgainst - AI keeper saves (goals conceded)
   * @param {number} matchData.totalShots - Total penalty kicks taken
   * @param {number} matchData.round - Current round number
   * @param {string} matchData.difficulty - easy|medium|hard|legend
   * @param {boolean} matchData.won
   * @param {number} [matchData.duration] - Seconds
   */
  async submitMatch(matchData) {
    try {
      await convex.submitSession(
        "goalbot",
        matchData.goalsFor,          // primary score = goals scored
        matchData.difficulty,
        matchData.won,
        {
          goalsFor: matchData.goalsFor,
          goalsAgainst: matchData.goalsAgainst,
          totalShots: matchData.totalShots,
          round: matchData.round,
        },
        matchData.duration
      );
      console.log("[GoalBot→Convex] Session submitted");
    } catch (e) {
      console.warn("[GoalBot→Convex] Submit failed:", e.message);
    }
  },

  /**
   * Sync career stats from GameStorage
   * @param {Object} storage - GoalBot's GameStorage data
   * @param {Object} stats - GoalBot's stats object
   */
  async syncCareerStats(storage, stats) {
    try {
      await convex.syncPlayerStats({
        totalGamesPlayed: stats.gamesPlayed,
        totalCoinsEarned: storage.coins || 0,
        level: storage.playerLevel || 1,
        xp: storage.playerXP || 0,
        bestScores: {
          crickbot: 0,
          goalbot: stats.bestScore || 0,
          basehit: 0,
        },
        crickbotStats: {
          totalRuns: 0, totalFours: 0, totalSixes: 0,
          totalBallsFaced: 0, totalWins: 0, legendWins: 0,
        },
        goalbotStats: {
          totalGoals: storage.totalGoals || 0,
          totalShots: stats.totalShots || 0,
          // totalSaves = shots that the AI keeper saved against us
          totalSaves: Math.max(0, (stats.totalShots || 0) - (stats.successfulShots || 0)),
          shotAccuracy: stats.totalShots > 0
            ? (stats.successfulShots || 0) / stats.totalShots
            : 0,
        },
        basehitStats: {
          totalHRs: 0, totalSwings: 0, totalGoodHits: 0,
          totalFouls: 0, totalStrikes: 0, bestStreak: 0,
        },
      });
      console.log("[GoalBot→Convex] Career stats synced");
    } catch (e) {
      console.warn("[GoalBot→Convex] Stats sync failed:", e.message);
    }
  },

  async unlockAchievement(achievementId) {
    try {
      await convex.unlockAchievement(achievementId, "goalbot");
    } catch (e) {
      console.warn("[GoalBot→Convex] Achievement sync failed:", e.message);
    }
  },
};

window.goalbotSync = goalbotSync;

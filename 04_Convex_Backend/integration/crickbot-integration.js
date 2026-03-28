/**
 * CrickBot → Convex Integration
 *
 * Drop this into CrickBot's index.html (after game code loads)
 * or import as a module.
 *
 * Hooks into:
 *   1. Game over → submitSession with cricket-specific stats
 *   2. Achievement unlock → sync to cloud
 *   3. Campaign phase completion → sync progress
 *   4. Periodic stats sync → lifetime career numbers
 */

// Initialize client (assumes convex-client.js is loaded)
const convex = new ConvexGameClient();

// ── Hook: After Game Over ──────────────────────────────────────────
// Call this from your game-over handler in CrickBot
//
// Example integration point in index.html:
//   Find the section where `gameState.matchHistory.push(...)` happens
//   and add: `crickbotSync.submitMatch(gameState);`

const crickbotSync = {
  /**
   * Submit completed innings to Convex
   * @param {GameState} gs - CrickBot's GameState instance
   */
  async submitMatch(gs) {
    try {
      const won = gs.score >= gs.target;
      await convex.submitSession(
        "crickbot",
        gs.score,                    // primary score = runs scored
        gs.difficulty,               // easy|medium|hard|legend
        won,
        {
          // CrickBot-specific stats
          runs: gs.score,
          target: gs.target,
          wickets: gs.wickets,
          overs: gs.oversCompleted + (gs.ballsInOver / 6),
          fours: gs.fours || 0,
          sixes: gs.sixes || 0,
          phase: gs.currentPhase || 0,
        },
        Math.floor((Date.now() - gs.gameStartTime) / 1000) // duration secs
      );
      console.log("[CrickBot→Convex] Session submitted");
    } catch (e) {
      console.warn("[CrickBot→Convex] Submit failed (offline?):", e.message);
    }
  },

  /**
   * Sync career stats to cloud
   * @param {GameState} gs
   */
  async syncCareerStats(gs) {
    try {
      await convex.syncPlayerStats({
        totalGamesPlayed: gs.gamesPlayed,
        totalCoinsEarned: gs.totalCoinsEarned,
        level: gs.level,
        xp: gs.xp,
        bestScores: {
          crickbot: gs.bestScore,
          goalbot: 0, // not this game's concern
          basehit: 0,
        },
        crickbotStats: {
          totalRuns: gs.totalRuns,
          totalFours: gs.totalFours,
          totalSixes: gs.totalSixes,
          totalBallsFaced: gs.totalBallsFaced,
          totalWins: gs.totalWins,
          legendWins: gs._legendWins || 0,
        },
        goalbotStats: {
          totalGoals: 0, totalShots: 0, totalSaves: 0, shotAccuracy: 0,
        },
        basehitStats: {
          totalHRs: 0, totalSwings: 0, totalGoodHits: 0,
          totalFouls: 0, totalStrikes: 0, bestStreak: 0,
        },
      });
      console.log("[CrickBot→Convex] Career stats synced");
    } catch (e) {
      console.warn("[CrickBot→Convex] Stats sync failed:", e.message);
    }
  },

  /**
   * Sync campaign phase progress
   * @param {GameState} gs
   */
  async syncCampaign(gs) {
    try {
      await convex.syncCampaign(
        "crickbot",
        gs.campaignLevel,
        gs.totalStars,
        gs.levelStars
      );
    } catch (e) {
      console.warn("[CrickBot→Convex] Campaign sync failed:", e.message);
    }
  },

  /**
   * Unlock a CrickBot achievement
   * @param {string} achievementId
   */
  async unlockAchievement(achievementId) {
    try {
      await convex.unlockAchievement(achievementId, "crickbot");
    } catch (e) {
      console.warn("[CrickBot→Convex] Achievement sync failed:", e.message);
    }
  },
};

window.crickbotSync = crickbotSync;

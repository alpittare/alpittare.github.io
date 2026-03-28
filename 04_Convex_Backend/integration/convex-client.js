/**
 * Convex HTTP Client — Shared module for all 3 games
 *
 * Usage in any game's index.html:
 *   <script type="module" src="../Convex_Backend/integration/convex-client.js"></script>
 *
 * Or inline the ConvexGameClient class directly in your game.
 *
 * This uses ConvexHttpClient (HTTP-based, no WebSocket, no React)
 * which is ideal for vanilla Canvas games.
 */

const CONVEX_URL = "https://gallant-kingfisher-867.convex.cloud";

class ConvexGameClient {
  constructor(deploymentUrl = CONVEX_URL) {
    this._url = deploymentUrl;
    this._playerId = null;

    // Load cached playerId from localStorage
    const cached = localStorage.getItem("convex_player_id");
    if (cached) this._playerId = cached;
  }

  get playerId() {
    return this._playerId;
  }

  get isRegistered() {
    return this._playerId !== null;
  }

  // ── Internal HTTP helpers ────────────────────────────────────────

  async _mutation(path, args) {
    const res = await fetch(`${this._url}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Convex mutation failed: ${err}`);
    }
    const data = await res.json();
    return data.value;
  }

  async _query(path, args) {
    const res = await fetch(`${this._url}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args: args || {} }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Convex query failed: ${err}`);
    }
    const data = await res.json();
    return data.value;
  }

  // ── Player Registration ──────────────────────────────────────────

  async registerPlayer(name) {
    const playerId = await this._mutation("players:registerPlayer", { name });
    this._playerId = playerId;
    localStorage.setItem("convex_player_id", playerId);
    return playerId;
  }

  async getOrRegisterPlayer(name) {
    if (this._playerId) return this._playerId;

    // Try to find existing
    const existing = await this._query("players:getPlayerByName", { name });
    if (existing) {
      this._playerId = existing._id;
      localStorage.setItem("convex_player_id", existing._id);
      return existing._id;
    }

    return this.registerPlayer(name);
  }

  // ── Submit Game Session ──────────────────────────────────────────

  /**
   * Call after each game ends.
   *
   * @param {"crickbot"|"goalbot"|"basehit"} game
   * @param {number} score - Primary score
   * @param {string} difficulty - easy|medium|hard|legend
   * @param {boolean} won
   * @param {Object} stats - Game-specific stats object
   * @param {number} [duration] - Seconds
   */
  async submitSession(game, score, difficulty, won, stats, duration) {
    if (!this._playerId) {
      console.warn("[Convex] No player registered — skipping submit");
      return null;
    }

    const args = { playerId: this._playerId, game, score, difficulty, won, stats };
    if (duration != null && Number.isFinite(duration)) args.duration = duration;
    return this._mutation("sessions:submitGameSession", args);
  }

  // ── Leaderboard ──────────────────────────────────────────────────

  /**
   * @param {"crickbot"|"goalbot"|"basehit"} game
   * @param {number} [limit=10]
   */
  async getLeaderboard(game, limit = 10) {
    return this._query("leaderboard:getLeaderboard", { game, limit });
  }

  async getGlobalRanking(limit = 10) {
    return this._query("leaderboard:getGlobalRanking", { limit });
  }

  async getPlayerRank(game) {
    if (!this._playerId) return null;
    return this._query("leaderboard:getPlayerRank", {
      playerId: this._playerId,
      game,
    });
  }

  // ── Match History ────────────────────────────────────────────────

  async getMatchHistory(game, limit = 20) {
    if (!this._playerId) return [];
    const args = { playerId: this._playerId, limit };
    if (game) args.game = game;
    return this._query("sessions:getMatchHistory", args);
  }

  // ── Campaign Sync ────────────────────────────────────────────────

  async syncCampaign(game, currentLevel, totalStars, levelStars) {
    if (!this._playerId) return null;
    return this._mutation("campaign:syncCampaign", {
      playerId: this._playerId,
      game,
      currentLevel,
      totalStars,
      levelStars,
    });
  }

  async getCampaignProgress(game) {
    if (!this._playerId) return null;
    return this._query("campaign:getCampaignProgress", {
      playerId: this._playerId,
      game,
    });
  }

  // ── Achievements ─────────────────────────────────────────────────

  async unlockAchievement(achievementId, game) {
    if (!this._playerId) return null;
    return this._mutation("achievements:unlockAchievement", {
      playerId: this._playerId,
      achievementId,
      game,
    });
  }

  async getAchievements(game) {
    if (!this._playerId) return [];
    const args = { playerId: this._playerId };
    if (game) args.game = game;
    return this._query("achievements:getPlayerAchievements", args);
  }

  // ── Sync Full Player Stats ───────────────────────────────────────

  async syncPlayerStats(statsPayload) {
    if (!this._playerId) return null;
    return this._mutation("players:updatePlayerStats", {
      playerId: this._playerId,
      ...statsPayload,
    });
  }
}

// Export as global for vanilla games
window.ConvexGameClient = ConvexGameClient;

export { ConvexGameClient };

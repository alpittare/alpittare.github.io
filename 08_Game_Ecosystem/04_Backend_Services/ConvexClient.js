/**
 * ConvexClient.js - HTTP client for Convex backend
 * Pure fetch implementation with retry, offline queue, and rate limiting
 */

class ConvexClient {
  constructor(options = {}) {
    this.deploymentUrl = options.deploymentUrl || "https://proud-gazelle-123.convex.cloud";
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // ms
    this.timeout = options.timeout || 30000; // ms
    this.enableOfflineQueue = options.enableOfflineQueue !== false;
    this.enableRateLimit = options.enableRateLimit !== false;
    this.rateLimit = options.rateLimit || 100; // requests per minute

    this.offlineQueue = [];
    this.isOnline = typeof navigator === "undefined" || navigator.onLine;
    this.requestCount = 0;
    this.lastResetTime = Date.now();

    // Setup online/offline listeners
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());
    }
  }

  /**
   * Execute a query
   */
  async query(name, args = {}) {
    return this.request("query", name, args);
  }

  /**
   * Execute a mutation
   */
  async mutation(name, args = {}) {
    return this.request("mutation", name, args);
  }

  /**
   * Core request handler with retry and offline support
   */
  async request(type, name, args = {}) {
    // Check rate limit
    if (this.enableRateLimit && !this.checkRateLimit()) {
      throw new Error("Rate limit exceeded");
    }

    // If offline and mutation, queue it
    if (!this.isOnline && type === "mutation" && this.enableOfflineQueue) {
      return this.queueOfflineRequest(type, name, args);
    }

    // If offline, throw error
    if (!this.isOnline) {
      throw new Error("Network unavailable");
    }

    return await this.executeWithRetry(type, name, args);
  }

  /**
   * Execute request with exponential backoff retry
   */
  async executeWithRetry(type, name, args, attempt = 0) {
    try {
      const result = await this.executeRequest(type, name, args);
      return result;
    } catch (error) {
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
        return this.executeWithRetry(type, name, args, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Execute single request
   */
  async executeRequest(type, name, args) {
    const endpoint = type === "query" ? "/api/query" : "/api/mutation";
    const url = `${this.deploymentUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: name,
          args,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        throw new ConvexError(
          error.message || "Request failed",
          response.status,
          error
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Queue offline mutation
   */
  queueOfflineRequest(type, name, args) {
    const request = {
      type,
      name,
      args,
      timestamp: Date.now(),
      id: Math.random().toString(36).substring(7),
    };

    this.offlineQueue.push(request);
    console.log(`Queued offline request: ${name} (${this.offlineQueue.length} pending)`);

    return {
      queued: true,
      requestId: request.id,
      message: "Request queued for sync when online",
    };
  }

  /**
   * Sync offline queue when coming online
   */
  async handleOnline() {
    this.isOnline = true;
    console.log("Connection restored, syncing offline requests...");

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const request of queue) {
      try {
        await this.executeWithRetry(request.type, request.name, request.args);
        console.log(`Synced offline request: ${request.name}`);
      } catch (error) {
        console.error(`Failed to sync offline request ${request.name}:`, error);
        // Re-queue if failed
        this.offlineQueue.push(request);
      }
    }

    if (this.offlineQueue.length > 0) {
      console.warn(
        `${this.offlineQueue.length} offline requests still pending`
      );
    }
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    this.isOnline = false;
    console.log("Connection lost");
  }

  /**
   * Check rate limit
   */
  checkRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastResetTime;

    // Reset counter every minute
    if (elapsed > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.rateLimit) {
      return false;
    }

    this.requestCount++;
    return true;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (error.status >= 500) return true; // Server errors
    if (error.status === 408) return true; // Request timeout
    if (error.status === 429) return true; // Rate limit
    if (error.name === "AbortError") return true; // Timeout
    return false;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      online: this.isOnline,
      offlineQueueLength: this.offlineQueue.length,
      requestsThisMinute: this.requestCount,
      rateLimit: this.rateLimit,
    };
  }

  /**
   * Get offline queue
   */
  getOfflineQueue() {
    return [...this.offlineQueue];
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue() {
    this.offlineQueue = [];
  }
}

/**
 * Custom error for Convex errors
 */
class ConvexError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ConvexError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Type-safe wrapper functions for backend operations
 */
const ConvexOperations = {
  // Player operations
  registerPlayer: (client, name, email) =>
    client.mutation("registerPlayer", { name, email }),

  getPlayer: (client, playerId) =>
    client.query("getPlayer", { playerId }),

  updatePlayerSettings: (client, playerId, settings) =>
    client.mutation("updatePlayerSettings", { playerId, ...settings }),

  updateLastSeen: (client, playerId) =>
    client.mutation("updateLastSeen", { playerId }),

  // Session operations
  submitGameSession: (client, playerId, game, score, difficulty, won, duration) =>
    client.mutation("submitGameSession", {
      playerId,
      game,
      score,
      difficulty,
      won,
      duration,
    }),

  getPlayerSessions: (client, playerId, limit, game) =>
    client.query("getPlayerSessions", { playerId, limit, game }),

  getSessionStats: (client, playerId, game) =>
    client.query("getSessionStats", { playerId, game }),

  // Leaderboard operations
  getLeaderboard: (client, game, difficulty, limit) =>
    client.query("getLeaderboard", { game, difficulty, limit }),

  getPlayerRank: (client, playerId, game, difficulty) =>
    client.query("getPlayerRank", { playerId, game, difficulty }),

  updateLeaderboard: (client, playerId, game, score, difficulty) =>
    client.mutation("updateLeaderboard", {
      playerId,
      game,
      score,
      difficulty,
    }),

  // Multiplayer operations
  createRoom: (client, hostId, game) =>
    client.mutation("createRoom", { hostId, game }),

  joinRoom: (client, code, guestId) =>
    client.mutation("joinRoom", { code, guestId }),

  getRoom: (client, roomId) =>
    client.query("getRoom", { roomId }),

  updateInnings: (client, roomId, playerId, score) =>
    client.mutation("updateInnings", { roomId, playerId, score }),

  finishRoom: (client, roomId) =>
    client.mutation("finishRoom", { roomId }),

  joinQueue: (client, playerId, game, difficulty) =>
    client.mutation("joinQueue", { playerId, game, difficulty }),

  checkQueue: (client, playerId) =>
    client.query("checkQueue", { playerId }),

  leaveQueue: (client, playerId) =>
    client.mutation("leaveQueue", { playerId }),

  // Achievement operations
  unlockAchievement: (client, playerId, achievementId, game) =>
    client.mutation("unlockAchievement", { playerId, achievementId, game }),

  getPlayerAchievements: (client, playerId, game) =>
    client.query("getPlayerAchievements", { playerId, game }),

  getAchievementProgress: (client, playerId, achievementId, game) =>
    client.query("getAchievementProgress", {
      playerId,
      achievementId,
      game,
    }),

  // Campaign operations
  syncCampaign: (client, playerId, game, level, stars, bestScore) =>
    client.mutation("syncCampaign", {
      playerId,
      game,
      level,
      stars,
      bestScore,
    }),

  getCampaignProgress: (client, playerId, game) =>
    client.query("getCampaignProgress", { playerId, game }),

  getCampaignLeaderboard: (client, game, level, limit) =>
    client.query("getCampaignLeaderboard", { game, level, limit }),
};

// Export for use in browsers and Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ConvexClient, ConvexError, ConvexOperations };
}

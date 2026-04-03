/**
 * AnalyticsService.js - Client-side analytics for Game Ecosystem
 * Tracks events with privacy-first approach, no PII collection
 */

class AnalyticsService {
  constructor(options = {}) {
    this.convexClient = options.convexClient;
    this.playerId = options.playerId;
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 30000; // 30 seconds
    this.maxQueueSize = options.maxQueueSize || 100;

    this.eventQueue = [];
    this.sessionStartTime = Date.now();
    this.flushTimer = null;
    this.enabled = options.enabled !== false;

    // Session tracking
    this.sessionData = {
      startTime: this.sessionStartTime,
      events: [],
      currentScreen: null,
    };
  }

  /**
   * Track a generic event
   */
  trackEvent(event, metadata = {}) {
    if (!this.enabled) return;

    const eventPayload = {
      event,
      playerId: this.playerId,
      timestamp: Date.now(),
      metadata: this.sanitizeMetadata(metadata),
      sessionTime: Date.now() - this.sessionStartTime,
    };

    this.eventQueue.push(eventPayload);

    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.scheduleFlush();
    }
  }

  /**
   * Track game start
   */
  trackGameStart(game, difficulty = "medium") {
    this.trackEvent("game_start", {
      game,
      difficulty,
      timestamp: Date.now(),
    });

    this.sessionData.currentScreen = game;
  }

  /**
   * Track game end
   */
  trackGameEnd(game, result = {}) {
    const duration = result.duration || 0;
    const score = result.score || 0;
    const won = result.won || false;
    const difficulty = result.difficulty || "medium";

    this.trackEvent("game_end", {
      game,
      duration,
      score,
      won,
      difficulty,
      timestamp: Date.now(),
    });
  }

  /**
   * Track achievement unlock
   */
  trackAchievementUnlock(achievementId, game) {
    this.trackEvent("achievement_unlock", {
      achievementId,
      game,
      timestamp: Date.now(),
    });
  }

  /**
   * Track purchase (in-app)
   */
  trackPurchase(itemId, price, currency = "USD") {
    this.trackEvent("purchase", {
      itemId,
      price,
      currency,
      timestamp: Date.now(),
    });
  }

  /**
   * Track difficulty preference
   */
  trackDifficultySelection(game, difficulty) {
    this.trackEvent("difficulty_selected", {
      game,
      difficulty,
      timestamp: Date.now(),
    });
  }

  /**
   * Track funnel events for user journey analysis
   */
  trackFunnelEvent(stage, metadata = {}) {
    const stages = {
      menu_opened: "menu",
      game_selected: "game_selection",
      difficulty_selected: "difficulty",
      game_started: "game_start",
      game_completed: "game_end",
      result_viewed: "result",
      leaderboard_viewed: "leaderboard",
    };

    this.trackEvent("funnel_event", {
      stage: stages[stage] || stage,
      ...metadata,
      timestamp: Date.now(),
    });
  }

  /**
   * Track screen/page views
   */
  trackScreenView(screenName, metadata = {}) {
    this.trackEvent("screen_view", {
      screen: screenName,
      ...metadata,
      timestamp: Date.now(),
    });

    this.sessionData.currentScreen = screenName;
  }

  /**
   * Track session duration
   */
  trackSessionDuration() {
    const duration = Date.now() - this.sessionStartTime;
    this.trackEvent("session_end", {
      duration,
      eventCount: this.sessionData.events.length,
      timestamp: Date.now(),
    });
  }

  /**
   * Track multiplayer matchmaking
   */
  trackMultiplayerMatchmaking(game, difficulty, matched = false) {
    this.trackEvent("matchmaking", {
      game,
      difficulty,
      matched,
      timestamp: Date.now(),
    });
  }

  /**
   * Track error events (privacy-safe)
   */
  trackError(errorType, context = "") {
    this.trackEvent("error", {
      errorType,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Sanitize metadata to prevent PII leakage
   */
  sanitizeMetadata(metadata) {
    const sanitized = {};
    const allowedKeys = [
      "game",
      "difficulty",
      "score",
      "duration",
      "won",
      "achievementId",
      "itemId",
      "price",
      "currency",
      "stage",
      "screen",
      "matched",
      "errorType",
      "context",
    ];

    for (const key of allowedKeys) {
      if (metadata.hasOwnProperty(key)) {
        sanitized[key] = metadata[key];
      }
    }

    return sanitized;
  }

  /**
   * Schedule flush timer
   */
  scheduleFlush() {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Flush events to backend
   */
  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventQueue.length === 0 || !this.convexClient) {
      return;
    }

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send in batches to avoid payload size issues
      const batchSize = 20;
      for (let i = 0; i < eventsToSend.length; i += batchSize) {
        const batch = eventsToSend.slice(i, i + batchSize);
        await this.sendBatch(batch);
      }
    } catch (error) {
      console.error("Failed to flush analytics:", error);
      // Re-queue events if they fail (up to max queue size)
      if (this.eventQueue.length + eventsToSend.length <= this.maxQueueSize) {
        this.eventQueue = eventsToSend.concat(this.eventQueue);
      }
    }
  }

  /**
   * Send batch of events to backend
   */
  async sendBatch(events) {
    for (const event of events) {
      try {
        await this.convexClient.mutation("trackAnalyticsEvent", {
          event: event.event,
          game: event.metadata.game,
          difficulty: event.metadata.difficulty,
          metadata: event.metadata,
        });
      } catch (error) {
        console.error("Failed to send event:", error);
      }
    }
  }

  /**
   * Get session analytics summary
   */
  getSessionSummary() {
    return {
      sessionDuration: Date.now() - this.sessionStartTime,
      eventsTracked: this.sessionData.events.length,
      currentScreen: this.sessionData.currentScreen,
      pendingEvents: this.eventQueue.length,
    };
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Force flush before page unload
   */
  setupUnloadHandler() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.trackSessionDuration();
        this.flush();
      });
    }
  }

  /**
   * Get analytics configuration
   */
  getConfig() {
    return {
      enabled: this.enabled,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
      maxQueueSize: this.maxQueueSize,
      pendingEvents: this.eventQueue.length,
    };
  }
}

// Export for use in browsers and Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = AnalyticsService;
}

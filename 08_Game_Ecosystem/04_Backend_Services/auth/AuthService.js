/**
 * AuthService.js - Client-side authentication service for Game Ecosystem
 * Handles anonymous player registration, ID persistence, and session tokens
 */

class AuthService {
  constructor(options = {}) {
    this.storageKey = options.storageKey || "game_ecosystem_auth";
    this.tokenKey = "game_ecosystem_token";
    this.useLocalStorage = typeof window !== "undefined" && window.localStorage;
    this.useCapacitor = options.useCapacitor || false;
    this.convexClient = options.convexClient;

    if (this.useCapacitor) {
      try {
        const { Preferences } = window.Capacitor.Plugins;
        this.preferences = Preferences;
      } catch (e) {
        console.warn("Capacitor not available, falling back to localStorage");
        this.useCapacitor = false;
      }
    }
  }

  /**
   * Initialize authentication - checks for existing session or creates new one
   */
  async initialize() {
    try {
      const existing = await this.getStoredAuth();

      if (existing && existing.playerId) {
        this.playerId = existing.playerId;
        this.token = existing.token;
        this.createdAt = existing.createdAt;

        // Validate session is still valid (optional: check with backend)
        return {
          success: true,
          playerId: this.playerId,
          isNew: false,
        };
      }

      // No existing session, register new player
      return await this.registerAnonymousPlayer();
    } catch (error) {
      console.error("Auth initialization failed:", error);
      return await this.registerAnonymousPlayer();
    }
  }

  /**
   * Register anonymous player with auto-generated ID
   */
  async registerAnonymousPlayer(name = null) {
    try {
      const playerName =
        name || `Player_${this.generateAnonymousId()}`;

      // Call backend to register
      if (!this.convexClient) {
        throw new Error("ConvexClient not initialized");
      }

      const result = await this.convexClient.mutation("registerPlayer", {
        name: playerName,
      });

      const playerId = result.playerId;
      const token = this.generateSessionToken();
      const now = Date.now();

      // Store auth data
      const authData = {
        playerId,
        token,
        createdAt: now,
        playerName,
      };

      await this.storeAuth(authData);

      this.playerId = playerId;
      this.token = token;
      this.createdAt = now;

      return {
        success: true,
        playerId,
        playerName,
        isNew: true,
      };
    } catch (error) {
      console.error("Failed to register anonymous player:", error);
      throw error;
    }
  }

  /**
   * Generate random anonymous player ID
   */
  generateAnonymousId() {
    return Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();
  }

  /**
   * Generate session token
   */
  generateSessionToken() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const hash = btoa(`${timestamp}-${random}`);
    return hash;
  }

  /**
   * Store auth data (localStorage + Capacitor)
   */
  async storeAuth(authData) {
    try {
      const serialized = JSON.stringify(authData);

      // Try localStorage first
      if (this.useLocalStorage) {
        localStorage.setItem(this.storageKey, serialized);
      }

      // Also store in Capacitor if available
      if (this.useCapacitor && this.preferences) {
        await this.preferences.set({
          key: this.storageKey,
          value: serialized,
        });
      }

      return true;
    } catch (error) {
      console.error("Failed to store auth:", error);
      return false;
    }
  }

  /**
   * Retrieve stored auth data
   */
  async getStoredAuth() {
    try {
      let authData = null;

      // Try localStorage first
      if (this.useLocalStorage && localStorage.getItem(this.storageKey)) {
        authData = JSON.parse(localStorage.getItem(this.storageKey));
      }

      // Fall back to Capacitor
      if (!authData && this.useCapacitor && this.preferences) {
        const result = await this.preferences.get({
          key: this.storageKey,
        });
        if (result.value) {
          authData = JSON.parse(result.value);
        }
      }

      return authData;
    } catch (error) {
      console.error("Failed to retrieve stored auth:", error);
      return null;
    }
  }

  /**
   * Get current player ID
   */
  getPlayerId() {
    return this.playerId;
  }

  /**
   * Get current session token
   */
  getToken() {
    return this.token;
  }

  /**
   * Check if player is authenticated
   */
  isAuthenticated() {
    return !!this.playerId && !!this.token;
  }

  /**
   * Logout and clear stored data
   */
  async logout() {
    try {
      // Clear localStorage
      if (this.useLocalStorage) {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.tokenKey);
      }

      // Clear Capacitor storage
      if (this.useCapacitor && this.preferences) {
        await this.preferences.remove({
          key: this.storageKey,
        });
        await this.preferences.remove({
          key: this.tokenKey,
        });
      }

      this.playerId = null;
      this.token = null;
      this.createdAt = null;

      return { success: true };
    } catch (error) {
      console.error("Failed to logout:", error);
      return { success: false, error };
    }
  }

  /**
   * Re-register if cache is invalid
   */
  async reregister() {
    await this.logout();
    return await this.registerAnonymousPlayer();
  }

  /**
   * Validate session with backend
   */
  async validateSession() {
    try {
      if (!this.convexClient || !this.playerId) {
        return { valid: false };
      }

      const player = await this.convexClient.query("getPlayer", {
        playerId: this.playerId,
      });

      if (!player) {
        return { valid: false };
      }

      return {
        valid: true,
        player,
      };
    } catch (error) {
      console.error("Session validation failed:", error);
      return { valid: false, error };
    }
  }

  /**
   * Update last seen timestamp
   */
  async updateLastSeen() {
    try {
      if (!this.convexClient || !this.playerId) {
        return false;
      }

      await this.convexClient.mutation("updateLastSeen", {
        playerId: this.playerId,
      });

      return true;
    } catch (error) {
      console.error("Failed to update last seen:", error);
      return false;
    }
  }

  /**
   * Get auth data for API headers
   */
  getAuthHeaders() {
    return {
      "X-Player-ID": this.playerId,
      "X-Session-Token": this.token,
    };
  }
}

// Export for use in browsers and Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = AuthService;
}

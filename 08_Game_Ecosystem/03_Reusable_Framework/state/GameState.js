/**
 * GameState.js
 * Persistent game state management with localStorage and native storage support.
 * Handles save/load, versioning, schema migration, and state change events.
 *
 * Features:
 * - 50+ game state properties
 * - localStorage save/load with versioned schema
 * - Capacitor Preferences wrapper (native mobile storage)
 * - Save throttling (500ms minimum between writes)
 * - State change events
 * - Default state factory
 * - Schema migration support
 *
 * @module state/GameState
 */

'use strict';

/**
 * GameState manages all persistent player data.
 * Provides save/load with localStorage and optional native storage.
 *
 * @class GameState
 */
class GameState {
    constructor() {
        // --- Game Progress ---
        this.currentLevel = 1;
        this.maxLevelUnlocked = 1;
        this.campaignProgress = 0; // 0-100
        this.currentSport = 'cricket'; // cricket, football, baseball

        // --- Currency & Economy ---
        this.coins = 0;
        this.gems = 0; // Premium currency
        this.gems_spent = 0;
        this.coins_spent = 0;

        // --- Player Stats ---
        this.totalGamesPlayed = 0;
        this.totalGamesWon = 0;
        this.totalGamesLost = 0;
        this.totalPlayTime = 0; // seconds
        this.highScore = 0;
        this.averageScore = 0;
        this.winRate = 0;

        // --- Achievements ---
        this.achievements = {}; // { achievement_id: { unlocked: bool, unlockedAt: timestamp } }
        this.totalAchievements = 0;

        // --- Settings ---
        this.audioEnabled = true;
        this.musicEnabled = true;
        this.effectsEnabled = true;
        this.masterVolume = 0.7;
        this.difficultyLevel = 'medium'; // easy, medium, hard, legend
        this.language = 'en';
        this.hapticFeedback = true;

        // --- Shop & Cosmetics ---
        this.ownedSkins = ['default']; // Unlocked skins
        this.currentSkin = 'default';
        this.ownedThemes = ['default'];
        this.currentTheme = 'default';
        this.powerUpInventory = {}; // { powerup_id: count }

        // --- Daily/Streaks ---
        this.dailyRewardStreak = 0; // 0-7
        this.lastDailyRewardDate = null;
        this.lastPlayDate = null;
        this.consecutiveWins = 0;
        this.bestWinStreak = 0;

        // --- Multiplayer ---
        this.playerId = null;
        this.playerName = 'Player';
        this.playerRank = 0;
        this.multiplayerGamesPlayed = 0;
        this.multiplayerWins = 0;

        // --- Analytics ---
        this.firstPlayDate = new Date().toISOString();
        this.lastPlaySessionDate = new Date().toISOString();
        this.totalSessions = 0;
        this.lastLevelTime = 0; // seconds to complete last level

        // --- VIP / Premium ---
        this.vipActive = false;
        this.vipExpiryDate = null;

        // --- Meta ---
        this._version = 2; // Schema version for migrations
        this._lastSave = 0;
        this._unsavedChanges = false;

        // Event listeners
        this._listeners = {};

        // Save throttle
        this._saveThrottle = 500; // 500ms minimum between saves
    }

    /**
     * Initialize state (load from storage if available).
     *
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            const saved = await this.load();
            if (saved) {
                this._migrate(saved);
            }
        } catch (e) {
            console.warn('Failed to load saved state:', e);
            // Continue with default state
        }
    }

    /**
     * Load state from storage.
     *
     * @returns {Promise<object|null>}
     */
    async load() {
        try {
            // Try Capacitor Preferences first (native)
            if (typeof Capacitor !== 'undefined' && Capacitor.Plugins?.Preferences) {
                const result = await Capacitor.Plugins.Preferences.get({ key: 'gameState' });
                if (result?.value) {
                    return JSON.parse(result.value);
                }
            }

            // Fall back to localStorage
            const stored = localStorage.getItem('gameState');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Load error:', e);
        }
        return null;
    }

    /**
     * Save state to storage (throttled).
     *
     * @returns {Promise<boolean>} Success
     */
    async save() {
        const now = Date.now();
        if (now - this._lastSave < this._saveThrottle) {
            return false; // Throttled
        }

        try {
            const data = this.toJSON();
            this._lastSave = now;

            // Try Capacitor first
            if (typeof Capacitor !== 'undefined' && Capacitor.Plugins?.Preferences) {
                await Capacitor.Plugins.Preferences.set({
                    key: 'gameState',
                    value: JSON.stringify(data)
                });
            } else {
                // localStorage fallback
                localStorage.setItem('gameState', JSON.stringify(data));
            }

            this._unsavedChanges = false;
            this.emit('save', { timestamp: now });
            return true;
        } catch (e) {
            console.error('Save error:', e);
            return false;
        }
    }

    /**
     * Mark state as changed (triggers auto-save).
     */
    markDirty() {
        this._unsavedChanges = true;
        // Could trigger auto-save here
        this.save();
    }

    /**
     * Migrate state from older schema versions.
     * @private
     */
    _migrate(data) {
        if (!data._version || data._version < 2) {
            // v1 → v2: Add new properties with defaults
            data.gems = data.gems || 0;
            data.vipActive = data.vipActive || false;
        }
        // Apply all data
        Object.assign(this, data);
    }

    /**
     * Export state as JSON.
     *
     * @returns {object}
     */
    toJSON() {
        return {
            currentLevel: this.currentLevel,
            maxLevelUnlocked: this.maxLevelUnlocked,
            campaignProgress: this.campaignProgress,
            currentSport: this.currentSport,
            coins: this.coins,
            gems: this.gems,
            gems_spent: this.gems_spent,
            coins_spent: this.coins_spent,
            totalGamesPlayed: this.totalGamesPlayed,
            totalGamesWon: this.totalGamesWon,
            totalGamesLost: this.totalGamesLost,
            totalPlayTime: this.totalPlayTime,
            highScore: this.highScore,
            averageScore: this.averageScore,
            winRate: this.winRate,
            achievements: this.achievements,
            totalAchievements: this.totalAchievements,
            audioEnabled: this.audioEnabled,
            musicEnabled: this.musicEnabled,
            effectsEnabled: this.effectsEnabled,
            masterVolume: this.masterVolume,
            difficultyLevel: this.difficultyLevel,
            language: this.language,
            hapticFeedback: this.hapticFeedback,
            ownedSkins: this.ownedSkins,
            currentSkin: this.currentSkin,
            ownedThemes: this.ownedThemes,
            currentTheme: this.currentTheme,
            powerUpInventory: this.powerUpInventory,
            dailyRewardStreak: this.dailyRewardStreak,
            lastDailyRewardDate: this.lastDailyRewardDate,
            lastPlayDate: this.lastPlayDate,
            consecutiveWins: this.consecutiveWins,
            bestWinStreak: this.bestWinStreak,
            playerId: this.playerId,
            playerName: this.playerName,
            playerRank: this.playerRank,
            multiplayerGamesPlayed: this.multiplayerGamesPlayed,
            multiplayerWins: this.multiplayerWins,
            firstPlayDate: this.firstPlayDate,
            lastPlaySessionDate: this.lastPlaySessionDate,
            totalSessions: this.totalSessions,
            lastLevelTime: this.lastLevelTime,
            vipActive: this.vipActive,
            vipExpiryDate: this.vipExpiryDate,
            _version: this._version
        };
    }

    /**
     * Reset state to defaults.
     */
    reset() {
        Object.assign(this, new GameState());
    }

    /**
     * Get player's win rate (0-1).
     *
     * @returns {number}
     */
    getWinRate() {
        if (this.totalGamesPlayed === 0) return 0;
        return this.totalGamesWon / this.totalGamesPlayed;
    }

    /**
     * Check if achievement is unlocked.
     *
     * @param {string} id
     * @returns {boolean}
     */
    isAchievementUnlocked(id) {
        return this.achievements[id]?.unlocked || false;
    }

    /**
     * Unlock an achievement.
     *
     * @param {string} id
     */
    unlockAchievement(id) {
        if (!this.achievements[id]) {
            this.achievements[id] = {};
        }
        if (!this.achievements[id].unlocked) {
            this.achievements[id].unlocked = true;
            this.achievements[id].unlockedAt = Date.now();
            this.totalAchievements++;
            this.emit('achievement_unlocked', { id });
            this.markDirty();
        }
    }

    /**
     * Register event listener.
     *
     * @param {string} event
     * @param {Function} fn
     */
    on(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    }

    /**
     * Emit event.
     *
     * @param {string} event
     * @param {*} data
     * @private
     */
    emit(event, data) {
        if (!this._listeners[event]) return;
        for (const fn of this._listeners[event]) {
            try {
                fn(data);
            } catch (e) {
                console.error(`Error in ${event} listener:`, e);
            }
        }
    }

    /**
     * Get summary for stats display.
     *
     * @returns {object}
     */
    getSummary() {
        return {
            level: this.currentLevel,
            coins: this.coins,
            gems: this.gems,
            wins: this.totalGamesWon,
            winRate: (this.getWinRate() * 100).toFixed(1) + '%',
            playTime: Math.floor(this.totalPlayTime / 60) + 'm',
            dailyStreak: this.dailyRewardStreak,
            achievements: this.totalAchievements
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState };
}

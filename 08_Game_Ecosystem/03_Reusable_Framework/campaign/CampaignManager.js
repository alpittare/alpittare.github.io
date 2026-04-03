/**
 * CampaignManager.js
 * 100-level progressive campaign system.
 * Handles level generation, difficulty scaling, star ratings, and unlocking.
 *
 * Features:
 * - 100 levels with progressive difficulty
 * - Boss levels every 25 levels
 * - Star rating system (1-3 stars based on performance)
 * - Difficulty mapping per level range
 * - Reward scaling (coins, XP per level)
 * - 10-theme rotation
 * - Progressive unlock system
 *
 * @module campaign/CampaignManager
 */

'use strict';

/**
 * CampaignManager orchestrates the 100-level campaign.
 *
 * @class CampaignManager
 */
class CampaignManager {
    /**
     * @param {GameState} gameState - Reference to persistent game state
     * @param {object} [config]
     * @param {number} [config.maxLevels=100] - Total levels
     * @param {boolean} [config.enableBossLevels=true] - Boss every N levels
     */
    constructor(gameState, config = {}) {
        this.gameState = gameState;
        this.maxLevels = config.maxLevels || 100;
        this.enableBossLevels = config.enableBossLevels !== false;
        this.bossInterval = 25; // Boss level every 25

        // Theme rotation (10 themes)
        this.themes = [
            'default', 'neon', 'sunset', 'ocean', 'forest',
            'cosmic', 'retro', 'minimal', 'dark', 'vibrant'
        ];

        // Level configs (lazy-loaded)
        this._levelConfigs = {};

        // Star thresholds
        this._starThresholds = {
            1: 0.4,     // 40% = 1 star
            2: 0.7,     // 70% = 2 stars
            3: 0.95     // 95% = 3 stars
        };

        // Difficulty tiers
        this._difficultyTiers = [
            { min: 1, max: 10, difficulty: 'easy', aiMultiplier: 0.7 },
            { min: 11, max: 25, difficulty: 'medium', aiMultiplier: 0.9 },
            { min: 26, max: 50, difficulty: 'hard', aiMultiplier: 1.1 },
            { min: 51, max: 75, difficulty: 'hard', aiMultiplier: 1.3 },
            { min: 76, max: 100, difficulty: 'legend', aiMultiplier: 1.5 }
        ];

        // Level stats
        this.levelStats = {}; // level -> { stars, bestScore, timesPlayed, completed }
    }

    /**
     * Get level configuration.
     *
     * @param {number} levelNum - Level 1-100
     * @returns {object} Level config
     */
    getLevel(levelNum) {
        if (levelNum < 1 || levelNum > this.maxLevels) {
            return null;
        }

        // Cache level configs
        if (!this._levelConfigs[levelNum]) {
            this._levelConfigs[levelNum] = this._generateLevelConfig(levelNum);
        }

        return this._levelConfigs[levelNum];
    }

    /**
     * Generate level configuration.
     * @private
     */
    _generateLevelConfig(levelNum) {
        const tier = this._getDifficultyTier(levelNum);
        const isBoss = this.enableBossLevels && levelNum % this.bossInterval === 0;
        const themeIndex = (levelNum - 1) % this.themes.length;

        return {
            number: levelNum,
            difficulty: tier.difficulty,
            aiMultiplier: tier.aiMultiplier,
            theme: this.themes[themeIndex],
            isBoss: isBoss,
            baseReward: this._calculateReward(levelNum),
            timeLimit: this._calculateTimeLimit(levelNum),
            targetScore: this._calculateTargetScore(levelNum),
            modifiers: this._getModifiers(levelNum)
        };
    }

    /**
     * Get difficulty tier for a level.
     * @private
     */
    _getDifficultyTier(levelNum) {
        for (const tier of this._difficultyTiers) {
            if (levelNum >= tier.min && levelNum <= tier.max) {
                return tier;
            }
        }
        return this._difficultyTiers[this._difficultyTiers.length - 1];
    }

    /**
     * Calculate coin reward for level.
     * @private
     */
    _calculateReward(levelNum) {
        const baseReward = 50;
        const scaling = Math.floor(levelNum / 10) * 25;
        const bossBonus = (levelNum % this.bossInterval === 0) ? 200 : 0;
        return baseReward + scaling + bossBonus;
    }

    /**
     * Calculate time limit (seconds).
     * @private
     */
    _calculateTimeLimit(levelNum) {
        const baseTime = 60;
        const reduction = Math.floor(levelNum / 25) * 5;
        return Math.max(30, baseTime - reduction);
    }

    /**
     * Calculate target score for perfect play.
     * @private
     */
    _calculateTargetScore(levelNum) {
        return 1000 + (levelNum - 1) * 50;
    }

    /**
     * Get level modifiers (gameplay tweaks).
     * @private
     */
    _getModifiers(levelNum) {
        const mods = [];

        if (levelNum > 25) mods.push('faster_ai');
        if (levelNum > 50) mods.push('aggressive_ai');
        if (levelNum > 75) mods.push('predictive_ai');
        if (levelNum % 20 === 0) mods.push('bonus_multiplier');

        return mods;
    }

    /**
     * Complete a level with a score.
     *
     * @param {number} levelNum
     * @param {number} score - Player's score
     * @param {number} timeTaken - Time taken in seconds
     * @returns {{stars: number, coinReward: number}}
     */
    completeLevel(levelNum, score, timeTaken) {
        const level = this.getLevel(levelNum);
        if (!level) return { stars: 0, coinReward: 0 };

        // Calculate stars based on score percentage
        const scorePercent = score / level.targetScore;
        let stars = 0;
        if (scorePercent >= this._starThresholds[3]) stars = 3;
        else if (scorePercent >= this._starThresholds[2]) stars = 2;
        else if (scorePercent >= this._starThresholds[1]) stars = 1;

        // Calculate rewards
        let coinReward = level.baseReward;
        coinReward += stars * 50; // Star bonus
        if (timeTaken < level.timeLimit * 0.5) coinReward += 100; // Speed bonus

        // Update stats
        if (!this.levelStats[levelNum]) {
            this.levelStats[levelNum] = { stars: 0, bestScore: 0, timesPlayed: 0, completed: false };
        }

        const stats = this.levelStats[levelNum];
        stats.timesPlayed++;
        stats.completed = true;
        if (stars > stats.stars) stats.stars = stars;
        if (score > stats.bestScore) stats.bestScore = score;

        // Unlock next level
        if (levelNum < this.maxLevels) {
            this.gameState.maxLevelUnlocked = Math.max(this.gameState.maxLevelUnlocked, levelNum + 1);
        }

        // Update campaign progress
        const unlockedPercentage = (this.gameState.maxLevelUnlocked - 1) / this.maxLevels * 100;
        this.gameState.campaignProgress = Math.floor(unlockedPercentage);

        // Mark dirty for persistence
        this.gameState.markDirty();

        return { stars, coinReward };
    }

    /**
     * Get all level summaries.
     *
     * @returns {Array<{number, difficulty, isBoss, stars, completed}>}
     */
    getAllLevelsSummary() {
        const summary = [];
        for (let i = 1; i <= this.maxLevels; i++) {
            const level = this.getLevel(i);
            const stats = this.levelStats[i] || {};
            summary.push({
                number: i,
                difficulty: level.difficulty,
                isBoss: level.isBoss,
                stars: stats.stars || 0,
                completed: stats.completed || false,
                unlocked: i <= this.gameState.maxLevelUnlocked
            });
        }
        return summary;
    }

    /**
     * Get next recommended level to play.
     *
     * @returns {number}
     */
    getNextLevel() {
        return Math.min(this.gameState.maxLevelUnlocked, this.maxLevels);
    }

    /**
     * Check if a level is unlocked.
     *
     * @param {number} levelNum
     * @returns {boolean}
     */
    isLevelUnlocked(levelNum) {
        return levelNum <= this.gameState.maxLevelUnlocked;
    }

    /**
     * Get campaign progress percentage.
     *
     * @returns {number} 0-100
     */
    getProgress() {
        return this.gameState.campaignProgress;
    }

    /**
     * Get total stars earned.
     *
     * @returns {number}
     */
    getTotalStars() {
        return Object.values(this.levelStats).reduce((sum, stats) => sum + (stats.stars || 0), 0);
    }

    /**
     * Get completion percentage (levels completed with 1+ star).
     *
     * @returns {number} 0-100
     */
    getCompletionPercentage() {
        const completed = Object.values(this.levelStats).filter(s => s.completed).length;
        return Math.floor((completed / this.maxLevels) * 100);
    }

    /**
     * Get campaign stats for display.
     *
     * @returns {object}
     */
    getStats() {
        return {
            currentLevel: this.gameState.currentLevel,
            maxLevelUnlocked: this.gameState.maxLevelUnlocked,
            progress: this.getProgress(),
            completion: this.getCompletionPercentage(),
            totalStars: this.getTotalStars(),
            maxStars: this.maxLevels * 3
        };
    }

    /**
     * Reset campaign (admin function).
     */
    reset() {
        this.levelStats = {};
        this.gameState.currentLevel = 1;
        this.gameState.maxLevelUnlocked = 1;
        this.gameState.campaignProgress = 0;
        this.gameState.markDirty();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CampaignManager };
}

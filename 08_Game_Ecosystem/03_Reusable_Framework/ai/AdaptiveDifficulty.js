/**
 * AdaptiveDifficulty.js
 * Real-time difficulty adjustment system.
 * Keeps games in the "flow zone" by dynamically tuning AI parameters based on player performance.
 *
 * Algorithm:
 * - Track player win rate with exponential moving average (EMA)
 * - Compare to target win rate (default 45%)
 * - Smooth parameter adjustments to prevent sudden difficulty swings
 * - Adjustable parameters: reaction time, speed, aggression, prediction accuracy
 *
 * @module ai/AdaptiveDifficulty
 */

'use strict';

/**
 * AdaptiveDifficulty manages dynamic difficulty scaling.
 * Ensures consistent challenge level regardless of player skill.
 *
 * @class AdaptiveDifficulty
 */
class AdaptiveDifficulty {
    /**
     * @param {object} [config]
     * @param {number} [config.targetWinRate=0.45] - Ideal player success rate
     * @param {number} [config.emaAlpha=0.1] - EMA smoothing factor
     * @param {number} [config.adjustRate=0.02] - Speed of difficulty change
     * @param {number} [config.minDifficulty=0.3] - Floor multiplier
     * @param {number} [config.maxDifficulty=1.5] - Ceiling multiplier
     * @param {number} [config.minSamples=5] - Min events before adjusting
     */
    constructor(config = {}) {
        this.targetWinRate = config.targetWinRate || 0.45;
        this.emaAlpha = config.emaAlpha || 0.1;
        this.adjustRate = config.adjustRate || 0.02;
        this.minDifficulty = config.minDifficulty || 0.3;
        this.maxDifficulty = config.maxDifficulty || 1.5;
        this.minSamples = config.minSamples || 5;

        // State
        this.currentDifficulty = 1.0; // 1.0 = baseline
        this.winRateEMA = 0.5;        // Running win rate
        this._totalEvents = 0;
        this._wins = 0;

        // Per-event adjustments
        this._recentWindow = 20;      // Sliding window for recent performance
        this._recentEvents = [];      // [true/false, ...] — recent win/loss
    }

    /**
     * Record an event outcome.
     *
     * @param {boolean} isWin - Whether the player won/succeeded
     */
    recordEvent(isWin) {
        this._totalEvents++;
        if (isWin) this._wins++;

        this._recentEvents.push(isWin);
        if (this._recentEvents.length > this._recentWindow) {
            this._recentEvents.shift();
        }

        // Update EMA
        const recentWinRate = this._recentEvents.filter(w => w).length / Math.max(1, this._recentEvents.length);
        this.winRateEMA = this.winRateEMA * (1 - this.emaAlpha) + recentWinRate * this.emaAlpha;

        // Adjust difficulty if enough samples
        if (this._totalEvents >= this.minSamples) {
            this._adjustDifficulty();
        }
    }

    /**
     * Adjust difficulty multiplier based on win rate.
     * If player winning too much -> increase difficulty
     * If player losing too much -> decrease difficulty
     * @private
     */
    _adjustDifficulty() {
        const error = this.winRateEMA - this.targetWinRate; // +ve if player winning too much
        const adjustment = error * this.adjustRate;

        this.currentDifficulty -= adjustment; // Increase difficulty if error > 0

        // Clamp
        this.currentDifficulty = Math.max(
            this.minDifficulty,
            Math.min(this.maxDifficulty, this.currentDifficulty)
        );
    }

    /**
     * Get AI parameter scaled by current difficulty.
     * Multiplies parameter by difficulty multiplier.
     *
     * @param {number} baseValue - Base parameter value
     * @returns {number} Scaled value
     */
    scale(baseValue) {
        return baseValue * this.currentDifficulty;
    }

    /**
     * Get difficulty level as human-readable string.
     *
     * @returns {string} 'very_easy'|'easy'|'medium'|'hard'|'very_hard'|'legend'
     */
    getDifficultyLevel() {
        if (this.currentDifficulty < 0.4) return 'very_easy';
        if (this.currentDifficulty < 0.7) return 'easy';
        if (this.currentDifficulty < 1.1) return 'medium';
        if (this.currentDifficulty < 1.3) return 'hard';
        if (this.currentDifficulty < 1.45) return 'very_hard';
        return 'legend';
    }

    /**
     * Get recommended AI parameters based on current difficulty.
     * Returns a config object for AI settings.
     *
     * @returns {object} { reactionTime, speed, aggression, predictionAccuracy }
     */
    getAIConfig() {
        return {
            // Reaction time in milliseconds (lower = faster)
            reactionTime: this.scale(150),
            // Action speed multiplier
            speed: this.scale(1.0),
            // Aggression (0-1)
            aggression: Math.min(1, this.scale(0.5)),
            // Prediction accuracy (0-1)
            predictionAccuracy: Math.min(1, this.scale(0.5))
        };
    }

    /**
     * Get debug stats for HUD display.
     * @returns {object}
     */
    getStats() {
        return {
            difficulty: this.currentDifficulty.toFixed(2),
            level: this.getDifficultyLevel(),
            winRate: (this.winRateEMA * 100).toFixed(1) + '%',
            totalEvents: this._totalEvents,
            recentWins: this._recentEvents.filter(w => w).length,
            recentLosses: this._recentEvents.filter(w => !w).length
        };
    }

    /**
     * Reset to initial state.
     */
    reset() {
        this.currentDifficulty = 1.0;
        this.winRateEMA = 0.5;
        this._totalEvents = 0;
        this._wins = 0;
        this._recentEvents = [];
    }

    /**
     * Manually set difficulty (useful for difficulty selection menu).
     *
     * @param {string|number} level - 'easy', 'medium', 'hard' or 0.3-1.5
     */
    setDifficulty(level) {
        if (typeof level === 'string') {
            const map = {
                'very_easy': 0.3,
                'easy': 0.6,
                'medium': 1.0,
                'hard': 1.2,
                'very_hard': 1.4,
                'legend': 1.5
            };
            this.currentDifficulty = map[level] || 1.0;
        } else {
            this.currentDifficulty = Math.max(this.minDifficulty, Math.min(this.maxDifficulty, level));
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdaptiveDifficulty };
}

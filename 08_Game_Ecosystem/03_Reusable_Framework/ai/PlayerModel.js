/**
 * PlayerModel.js
 * Lightweight behavioral modeling of player actions.
 * Tracks player patterns, preferences, and tendencies without heavy ML.
 *
 * Memory footprint: 2-4 KB per player (mobile-safe)
 * No external dependencies
 *
 * Features:
 * - Frequency tables per action/context
 * - Recency bias (recent actions weighted more)
 * - Aggression scoring (EMA smoothed)
 * - Timing distribution tracking
 * - Serializable for persistence
 * - Sport-agnostic design (cricket, football, etc.)
 *
 * @module ai/PlayerModel
 */

'use strict';

/**
 * PlayerModel learns and remembers player behavior patterns.
 * Used to inform AI decisions and adapt difficulty.
 *
 * @class PlayerModel
 */
class PlayerModel {
    /**
     * @param {object} [config]
     * @param {number} [config.maxSamples=200] - Cap events before decay
     * @param {number} [config.decayRate=0.98] - Recency bias multiplier
     * @param {number} [config.minSamples=5] - Min observations for insights
     */
    constructor(config = {}) {
        this.maxSamples = config.maxSamples || 200;
        this.decayRate = config.decayRate || 0.98;
        this.minSamples = config.minSamples || 5;

        // Cricket batting tracking
        this.batByType = {};          // ball type -> { shot: count }
        this.batByDelivery = {};      // ball type|length -> { shot: count }
        this.shotOutcomes = {};       // shot name -> { runs, count, caught }
        this.timingDist = {           // Perfect, Good, Edge, Miss distribution
            perfect: 0,
            good: 0,
            edge: 0,
            miss: 0
        };
        this.aggressionScore = 0.5;   // 0 = defensive, 1 = aggressive

        // Cricket bowling tracking
        this.bowlResults = {};        // ball type -> { runs, wickets, dots, balls }

        // Football (soccer/field goal) tracking
        this.fbDirection = { left: 0, center: 0, right: 0 };
        this.fbPowerBuckets = [0, 0, 0, 0]; // low, medium, high, max
        this.fbPhaseDir = {           // Early/mid/late game direction prefs
            early:  { left: 0, center: 0, right: 0 },
            mid:    { left: 0, center: 0, right: 0 },
            late:   { left: 0, center: 0, right: 0 }
        };
        this.fbStreakDir = null;
        this.fbStreakLen = 0;
        this.fbSwitchAfterSave = 0;
        this.fbStayAfterSave = 0;

        // Global stats
        this._totalEvents = 0;
        this._sessionStart = Date.now();
    }

    /**
     * Record a cricket batting event.
     *
     * @param {object} delivery - { ball_type, length, line }
     * @param {object} result - { action, quality, runs, wasCaught }
     */
    recordBatting(delivery, result) {
        this._totalEvents++;
        const type = delivery.ball_type;
        const key = `${type}|${delivery.length}`;
        const shot = result.action || 'DEFEND';
        const quality = result.quality || 'miss';

        // By ball type
        if (!this.batByType[type]) this.batByType[type] = {};
        this.batByType[type][shot] = (this.batByType[type][shot] || 0) + 1;
        if (quality === 'miss') {
            this.batByType[type].miss = (this.batByType[type].miss || 0) + 1;
        }

        // By full delivery key
        if (!this.batByDelivery[key]) this.batByDelivery[key] = {};
        this.batByDelivery[key][shot] = (this.batByDelivery[key][shot] || 0) + 1;

        // Shot outcomes
        if (!this.shotOutcomes[shot]) {
            this.shotOutcomes[shot] = { runs: 0, count: 0, caught: 0 };
        }
        this.shotOutcomes[shot].runs += (result.runs || 0);
        this.shotOutcomes[shot].count++;
        if (result.wasCaught) this.shotOutcomes[shot].caught++;

        // Timing distribution
        if (this.timingDist[quality] !== undefined) {
            this.timingDist[quality]++;
        }

        // Aggression EMA
        const isAggressive = (shot === 'LOFT' || shot === 'PULL' || shot === 'CUT') ? 1 : 0;
        this.aggressionScore = this.aggressionScore * 0.92 + isAggressive * 0.08;

        this._maybePrune();
    }

    /**
     * Record a cricket bowling result.
     *
     * @param {object} delivery - { type, length, line }
     * @param {object} result - { runs, wasCaught }
     */
    recordBowling(delivery, result) {
        this._totalEvents++;
        const type = delivery.type;

        if (!this.bowlResults[type]) {
            this.bowlResults[type] = { runs: 0, wickets: 0, dots: 0, balls: 0 };
        }
        const rec = this.bowlResults[type];
        rec.balls++;
        rec.runs += (result.runs || 0);
        if (result.wasCaught) rec.wickets++;
        if ((result.runs || 0) === 0) rec.dots++;
    }

    /**
     * Record a football/soccer shot.
     *
     * @param {object} shot - { direction, power, round, maxRounds, afterSave, prevDirection }
     */
    recordFootball(shot) {
        this._totalEvents++;
        const dir = shot.direction || 'center';
        const power = shot.power || 0.5;

        // Direction frequency
        this.fbDirection[dir] = (this.fbDirection[dir] || 0) + 1;

        // Power buckets: [0-0.4], [0.4-0.65], [0.65-0.85], [0.85-1.0]
        const bucket = power < 0.4 ? 0 : (power < 0.65 ? 1 : (power < 0.85 ? 2 : 3));
        this.fbPowerBuckets[bucket]++;

        // Phase-based direction
        const round = shot.round || 1;
        const maxR = shot.maxRounds || 10;
        const phase = round <= maxR * 0.33 ? 'early' : (round <= maxR * 0.66 ? 'mid' : 'late');
        if (this.fbPhaseDir[phase]) {
            this.fbPhaseDir[phase][dir] = (this.fbPhaseDir[phase][dir] || 0) + 1;
        }

        // Streak tracking
        if (dir === this.fbStreakDir) {
            this.fbStreakLen++;
        } else {
            this.fbStreakDir = dir;
            this.fbStreakLen = 1;
        }

        // Post-save behavior
        if (shot.afterSave) {
            if (shot.prevDirection && shot.prevDirection !== dir) {
                this.fbSwitchAfterSave++;
            } else if (shot.prevDirection) {
                this.fbStayAfterSave++;
            }
        }
    }

    /**
     * Get player's preferred shot against a ball type.
     * @returns {{ shot: string, frequency: number } | null}
     */
    preferredShot(ballType) {
        const data = this.batByType[ballType];
        if (!data) return null;

        let best = null, bestCount = 0, total = 0;
        for (const shot in data) {
            if (shot === 'miss') continue;
            total += data[shot];
            if (data[shot] > bestCount) { bestCount = data[shot]; best = shot; }
        }
        if (total < this.minSamples) return null;
        return { shot: best, frequency: bestCount / total };
    }

    /**
     * Get miss rate against a specific delivery.
     * @returns {number} 0-1, or -1 if insufficient data
     */
    missRate(ballType) {
        const data = this.batByType[ballType];
        if (!data) return -1;

        let total = 0;
        for (const k in data) total += data[k];
        if (total < this.minSamples) return -1;

        return (data.miss || 0) / total;
    }

    /**
     * Get weakest delivery type (highest miss rate).
     * @returns {{ type: string, missRate: number } | null}
     */
    weakness() {
        let worst = null, worstRate = 0;
        for (const type in this.batByType) {
            const rate = this.missRate(type);
            if (rate > worstRate) { worstRate = rate; worst = type; }
        }
        return worst ? { type: worst, missRate: worstRate } : null;
    }

    /**
     * Get most effective bowling type.
     * @returns {{ type: string, economy: number, wicketRate: number } | null}
     */
    bestBowlType() {
        let best = null, bestScore = -Infinity;
        for (const type in this.bowlResults) {
            const r = this.bowlResults[type];
            if (r.balls < this.minSamples) continue;
            const economy = r.balls > 0 ? (r.runs / r.balls) * 6 : 99;
            const wicketRate = r.balls > 0 ? r.wickets / r.balls : 0;
            const dotRate = r.balls > 0 ? r.dots / r.balls : 0;
            const score = wicketRate * 3 + dotRate * 2 - economy;
            if (score > bestScore) { bestScore = score; best = type; }
        }
        if (!best) return null;
        const r = this.bowlResults[best];
        return {
            type: best,
            economy: r.balls > 0 ? (r.runs / r.balls) * 6 : 0,
            wicketRate: r.balls > 0 ? r.wickets / r.balls : 0
        };
    }

    /**
     * Football: Get predicted direction with confidence.
     * @returns {{ direction: string, confidence: number, streakActive: boolean }}
     */
    predictDirection(phase) {
        // Streak first (strongest signal)
        if (this.fbStreakLen >= 3) {
            return {
                direction: this.fbStreakDir,
                confidence: Math.min(0.5 + this.fbStreakLen * 0.08, 0.9),
                streakActive: true
            };
        }

        // Phase-specific or general
        const src = phase && this.fbPhaseDir[phase]
            ? this.fbPhaseDir[phase]
            : this.fbDirection;

        let total = 0, best = 'center', bestCount = 0;
        for (const d in src) {
            total += src[d];
            if (src[d] > bestCount) { bestCount = src[d]; best = d; }
        }

        if (total < this.minSamples) {
            return { direction: 'center', confidence: 0.33, streakActive: false };
        }

        return {
            direction: best,
            confidence: Math.min(bestCount / total, 0.85),
            streakActive: false
        };
    }

    /**
     * Football: Switch after save probability.
     * @returns {number} 0-1, or 0.5 if unknown
     */
    switchAfterSaveProbability() {
        const total = this.fbSwitchAfterSave + this.fbStayAfterSave;
        if (total < 3) return 0.5;
        return this.fbSwitchAfterSave / total;
    }

    /**
     * Football: Preferred power level.
     * @returns {string} 'low'|'medium'|'high'|'max'
     */
    preferredPower() {
        const labels = ['low', 'medium', 'high', 'max'];
        let maxIdx = 0;
        for (let i = 1; i < 4; i++) {
            if (this.fbPowerBuckets[i] > this.fbPowerBuckets[maxIdx]) maxIdx = i;
        }
        return labels[maxIdx];
    }

    /**
     * Export to JSON for persistence.
     * @returns {object}
     */
    toJSON() {
        return {
            v: 2,
            batByType: this.batByType,
            batByDelivery: this.batByDelivery,
            shotOutcomes: this.shotOutcomes,
            timingDist: this.timingDist,
            aggressionScore: this.aggressionScore,
            bowlResults: this.bowlResults,
            fbDirection: this.fbDirection,
            fbPowerBuckets: this.fbPowerBuckets,
            fbPhaseDir: this.fbPhaseDir,
            fbSwitchAfterSave: this.fbSwitchAfterSave,
            fbStayAfterSave: this.fbStayAfterSave,
            totalEvents: this._totalEvents
        };
    }

    /**
     * Import from JSON.
     * @param {object} data
     */
    fromJSON(data) {
        if (!data || data.v !== 2) return;
        this.batByType = data.batByType || {};
        this.batByDelivery = data.batByDelivery || {};
        this.shotOutcomes = data.shotOutcomes || {};
        this.timingDist = data.timingDist || { perfect: 0, good: 0, edge: 0, miss: 0 };
        this.aggressionScore = data.aggressionScore || 0.5;
        this.bowlResults = data.bowlResults || {};
        this.fbDirection = data.fbDirection || { left: 0, center: 0, right: 0 };
        this.fbPowerBuckets = data.fbPowerBuckets || [0, 0, 0, 0];
        this.fbPhaseDir = data.fbPhaseDir || { early: {}, mid: {}, late: {} };
        this.fbSwitchAfterSave = data.fbSwitchAfterSave || 0;
        this.fbStayAfterSave = data.fbStayAfterSave || 0;
        this._totalEvents = data.totalEvents || 0;
    }

    /**
     * Get summary for debug display.
     */
    get summary() {
        const totalBat = Object.values(this.timingDist).reduce((s, v) => s + v, 0);
        const totalFB = Object.values(this.fbDirection).reduce((s, v) => s + v, 0);
        return {
            events: this._totalEvents,
            batSamples: totalBat,
            fbSamples: totalFB,
            aggression: this.aggressionScore.toFixed(2),
            weakness: this.weakness(),
            fbPrediction: this.predictDirection()
        };
    }

    /**
     * Clear all data.
     */
    reset() {
        this.batByType = {};
        this.batByDelivery = {};
        this.shotOutcomes = {};
        this.timingDist = { perfect: 0, good: 0, edge: 0, miss: 0 };
        this.aggressionScore = 0.5;
        this.bowlResults = {};
        this.fbDirection = { left: 0, center: 0, right: 0 };
        this.fbPowerBuckets = [0, 0, 0, 0];
        this.fbPhaseDir = { early: {}, mid: {}, late: {} };
        this.fbStreakDir = null;
        this.fbStreakLen = 0;
        this.fbSwitchAfterSave = 0;
        this.fbStayAfterSave = 0;
        this._totalEvents = 0;
    }

    /**
     * Internal: Decay old data for recency bias.
     * @private
     */
    _maybePrune() {
        if (this._totalEvents > this.maxSamples) {
            this._decayAll(this.decayRate);
            this._totalEvents = Math.floor(this._totalEvents * this.decayRate);
        }
    }

    /**
     * Internal: Apply decay to all counters.
     * @private
     */
    _decayAll(factor) {
        for (const type in this.batByType) {
            for (const k in this.batByType[type]) {
                this.batByType[type][k] = Math.floor(this.batByType[type][k] * factor);
            }
        }
        for (const key in this.batByDelivery) {
            for (const k in this.batByDelivery[key]) {
                this.batByDelivery[key][k] = Math.floor(this.batByDelivery[key][k] * factor);
            }
        }
        for (const k in this.timingDist) {
            this.timingDist[k] = Math.floor(this.timingDist[k] * factor);
        }
        for (const d in this.fbDirection) {
            this.fbDirection[d] = Math.floor(this.fbDirection[d] * factor);
        }
        for (let i = 0; i < this.fbPowerBuckets.length; i++) {
            this.fbPowerBuckets[i] = Math.floor(this.fbPowerBuckets[i] * factor);
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlayerModel };
}

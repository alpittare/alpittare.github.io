// ============================================================================
// AI ENGINE — Phase 1+2+3+4: Rules + Learning + Prediction + Claude API
// Mobile-optimized | Zero external deps (core) | Runs every frame
// ============================================================================
// Phase 1: Static lookup tables + weighted random decisions
// Phase 2: PlayerModel tracks behavior → feeds back into decisions
// Phase 3: BayesPredictor + SequencePredictor + AdaptiveDifficulty
// Phase 4: Optional Claude API integration (async, fail-safe, cached)
// ============================================================================
// Integration points:
//   cricket-physics.js → CricketConfig, ShotTypes, DeliverySystem
//   football-physics.js → FootballConfig, Goalkeeper, KeeperAI
//   core.js → GameEngine (event hooks)
// ============================================================================

'use strict';

// ============================================================================
// SECTION 0 — AI UTILITIES (zero-alloc math helpers)
// ============================================================================

const AIUtil = {
    // Weighted random pick from { key: weight } map — O(n) single pass
    weightedPick(weights) {
        let total = 0;
        for (const k in weights) total += weights[k];
        let r = Math.random() * total;
        for (const k in weights) {
            r -= weights[k];
            if (r <= 0) return k;
        }
        // Fallback: return first key
        for (const k in weights) return k;
    },

    // Clamp
    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },

    // Fast hash for string key (for lookup tables)
    hash2(a, b) { return a + '|' + b; },
    hash3(a, b, c) { return a + '|' + b + '|' + c; },
};


// ============================================================================
// SECTION 0.5 — PLAYER MODEL (Phase 2: Lightweight Learning)
// ============================================================================
// Tracks player behavior using simple maps + counters.
// Memory budget: ~2-4 KB total (safe for mobile).
// No heavy ML — just frequency tables, decay windows, and derived insights.
//
// Data structure per delivery type:
//   { "bouncer": { "PULL": 10, "DEFEND": 3, "miss": 2 } }
//
// This is the "brain" that observes the player and learns their tendencies.
// ============================================================================

class PlayerModel {
    /**
     * @param {object} [config]
     * @param {number} [config.maxSamples=200] — max events before oldest are pruned
     * @param {number} [config.decayRate=0.98] — per-tick weight decay (recency bias)
     * @param {number} [config.minSamples=5] — min observations before insights activate
     */
    constructor(config = {}) {
        this.maxSamples = config.maxSamples || 200;
        this.decayRate = config.decayRate || 0.98;
        this.minSamples = config.minSamples || 5;

        // ---- CRICKET BATTING TRACKING ----
        // Key: ballType → { shotName: count, miss: count }
        this.batByType = {};
        // Key: ballType|length → { shotName: count }
        this.batByDelivery = {};
        // Key: shotName → { runs: totalRuns, count: N, caught: N }
        this.shotOutcomes = {};
        // Timing quality distribution
        this.timingDist = { perfect: 0, good: 0, edge: 0, miss: 0 };
        // Overall batting aggression (0=defensive, 1=aggressive)
        this.aggressionScore = 0.5;

        // ---- CRICKET BOWLING TRACKING ----
        // Key: ballType → { runs: total, wickets: N, dots: N, balls: N }
        this.bowlResults = {};

        // ---- FOOTBALL TRACKING ----
        // Direction frequency: { left: N, center: N, right: N }
        this.fbDirection = { left: 0, center: 0, right: 0 };
        // Power histogram: [low, medium, high, max] buckets
        this.fbPowerBuckets = [0, 0, 0, 0];
        // Direction by round position (early/mid/late in match)
        this.fbPhaseDir = {
            early:  { left: 0, center: 0, right: 0 },
            mid:    { left: 0, center: 0, right: 0 },
            late:   { left: 0, center: 0, right: 0 },
        };
        // Streak tracking
        this.fbStreakDir = null;
        this.fbStreakLen = 0;
        // Post-save behavior (does player switch after being saved?)
        this.fbSwitchAfterSave = 0;
        this.fbStayAfterSave = 0;

        // ---- GLOBAL ----
        this._totalEvents = 0;
        this._sessionStart = Date.now();
    }

    // =====================================================================
    // CRICKET: Record a batting event
    // =====================================================================

    /**
     * @param {object} delivery — { ball_type, length, line }
     * @param {object} result — { action (shot), quality (timing), runs, wasCaught }
     */
    recordBatting(delivery, result) {
        this._totalEvents++;
        const type = delivery.ball_type;
        const key = AIUtil.hash2(type, delivery.length);
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

        // Aggression score update (EMA)
        const isAggressive = (shot === 'LOFT' || shot === 'PULL' || shot === 'CUT') ? 1 : 0;
        this.aggressionScore = this.aggressionScore * 0.92 + isAggressive * 0.08;

        this._maybePrune();
    }

    // =====================================================================
    // CRICKET: Record a bowling result
    // =====================================================================

    /**
     * @param {object} delivery — { type, length, line }
     * @param {object} result — { runs, wasCaught }
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

    // =====================================================================
    // FOOTBALL: Record a shot
    // =====================================================================

    /**
     * @param {object} shot — { direction, power, round, maxRounds, afterSave }
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

    // =====================================================================
    // INSIGHTS — Derived knowledge from tracked data
    // =====================================================================

    /**
     * Get player's preferred shot against a ball type
     * @param {string} ballType
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
     * Get miss rate against a specific delivery
     * @param {string} ballType
     * @returns {number} 0-1 miss rate, or -1 if insufficient data
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
     * Get weakest delivery type for the player (highest miss rate)
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
     * Get most effective bowling type (best economy + wickets)
     * @returns {{ type: string, economy: number, wicketRate: number } | null}
     */
    bestBowlType() {
        let best = null, bestScore = -Infinity;
        for (const type in this.bowlResults) {
            const r = this.bowlResults[type];
            if (r.balls < this.minSamples) continue;
            // Score = wicketRate * 3 + dotRate * 2 - economy
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
            wicketRate: r.balls > 0 ? r.wickets / r.balls : 0,
        };
    }

    /**
     * Football: Get predicted direction with confidence
     * @param {string} [phase] — 'early'|'mid'|'late' (optional phase filter)
     * @returns {{ direction: string, confidence: number, streakActive: boolean }}
     */
    predictDirection(phase) {
        // Check streak first (strongest signal)
        if (this.fbStreakLen >= 3) {
            return {
                direction: this.fbStreakDir,
                confidence: AIUtil.clamp(0.5 + this.fbStreakLen * 0.08, 0.5, 0.9),
                streakActive: true,
            };
        }

        // Phase-specific if available
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
            confidence: AIUtil.clamp(bestCount / total, 0.33, 0.85),
            streakActive: false,
        };
    }

    /**
     * Football: Does player tend to switch direction after a save?
     * @returns {number} 0-1 switch probability, or 0.5 if unknown
     */
    switchAfterSaveProbability() {
        const total = this.fbSwitchAfterSave + this.fbStayAfterSave;
        if (total < 3) return 0.5; // not enough data
        return this.fbSwitchAfterSave / total;
    }

    /**
     * Football: Preferred power level
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

    // =====================================================================
    // SERIALIZATION — Export/import for persistence (localStorage ready)
    // =====================================================================

    /**
     * Export model to plain object (JSON-safe)
     */
    toJSON() {
        return {
            v: 2, // schema version
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
            totalEvents: this._totalEvents,
        };
    }

    /**
     * Restore model from exported data
     * @param {object} data — from toJSON()
     */
    fromJSON(data) {
        if (!data || data.v !== 2) return; // version mismatch guard
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
     * Get compact stats summary for debug HUD
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
            fbPrediction: this.predictDirection(),
        };
    }

    // --- Internal --------------------------------------------------------

    _maybePrune() {
        // Simple cap: if too many events, apply decay to all counters
        if (this._totalEvents > this.maxSamples) {
            this._decayAll(this.decayRate);
            this._totalEvents = Math.floor(this._totalEvents * this.decayRate);
        }
    }

    _decayAll(factor) {
        // Decay all counter maps
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

    reset() {
        this.batByType = {};
        this.batByDelivery = {};
        this.shotOutcomes = {};
        this.timingDist = { perfect: 0, good: 0, edge: 0, miss: 0 };
        this.aggressionScore = 0.5;
        this.bowlResults = {};
        this.fbDirection = { left: 0, center: 0, right: 0 };
        this.fbPowerBuckets = [0, 0, 0, 0];
        this.fbPhaseDir = { early: { left: 0, center: 0, right: 0 }, mid: { left: 0, center: 0, right: 0 }, late: { left: 0, center: 0, right: 0 } };
        this.fbStreakDir = null;
        this.fbStreakLen = 0;
        this.fbSwitchAfterSave = 0;
        this.fbStayAfterSave = 0;
        this._totalEvents = 0;
    }
}


// ============================================================================
// SECTION 0.7 — BAYES PREDICTOR (Phase 3: Probability-Based Prediction)
// ============================================================================
// Lightweight Bayesian posterior estimation.
// Given observed evidence (delivery type, line, game state), compute
// posterior probability of each player action.
//
// P(action | evidence) ∝ P(evidence | action) × P(action)
//
// Priors come from Phase 1 lookup tables.
// Likelihoods are learned from Phase 2 PlayerModel observations.
// No matrix ops, no tensors — just counter-based Bayes.
// ============================================================================

class BayesPredictor {
    /**
     * @param {number} [smoothing=1] — Laplace smoothing to avoid zero probabilities
     */
    constructor(smoothing = 1) {
        this.smoothing = smoothing;

        // Conditional count tables
        // Key: evidenceKey → { action: count }
        this._conditionals = {};
        // Marginal action counts (prior)
        this._actionCounts = {};
        this._totalObs = 0;
    }

    /**
     * Record an observation: given evidence, player chose action
     * @param {string} evidenceKey — e.g. "bouncer|short|right"
     * @param {string} action — e.g. "PULL"
     */
    observe(evidenceKey, action) {
        if (!this._conditionals[evidenceKey]) this._conditionals[evidenceKey] = {};
        this._conditionals[evidenceKey][action] = (this._conditionals[evidenceKey][action] || 0) + 1;
        this._actionCounts[action] = (this._actionCounts[action] || 0) + 1;
        this._totalObs++;
    }

    /**
     * Predict posterior distribution over actions given evidence
     * @param {string} evidenceKey
     * @param {object} [priors] — optional prior weights { action: weight }
     * @returns {{ predictions: Array<{action: string, probability: number}>, topAction: string, topProb: number, confidence: number }}
     */
    predict(evidenceKey, priors = null) {
        const cond = this._conditionals[evidenceKey];
        const allActions = Object.keys(this._actionCounts);

        if (allActions.length === 0) {
            return { predictions: [], topAction: null, topProb: 0, confidence: 0 };
        }

        // Compute unnormalized posteriors
        const posteriors = {};
        let totalPosterior = 0;
        const k = this.smoothing;
        const nActions = allActions.length;

        for (const action of allActions) {
            // Prior: P(action) = (count + k) / (total + k*n)
            const prior = priors && priors[action] !== undefined
                ? priors[action]
                : (this._actionCounts[action] + k) / (this._totalObs + k * nActions);

            // Likelihood: P(evidence | action) approximated from conditional counts
            const condCount = cond ? (cond[action] || 0) : 0;
            const condTotal = cond ? Object.values(cond).reduce((s, v) => s + v, 0) : 0;
            const likelihood = (condCount + k) / (condTotal + k * nActions);

            posteriors[action] = prior * likelihood;
            totalPosterior += posteriors[action];
        }

        // Normalize
        const predictions = [];
        let topAction = null, topProb = 0;

        for (const action of allActions) {
            const prob = totalPosterior > 0 ? posteriors[action] / totalPosterior : 1 / nActions;
            predictions.push({ action, probability: prob });
            if (prob > topProb) { topProb = prob; topAction = action; }
        }

        // Sort descending
        predictions.sort((a, b) => b.probability - a.probability);

        // Confidence: how much the top prediction stands out
        // entropy-based: low entropy = high confidence
        let entropy = 0;
        for (const p of predictions) {
            if (p.probability > 0) entropy -= p.probability * Math.log2(p.probability);
        }
        const maxEntropy = Math.log2(nActions);
        // Edge case: single action → 100% confident; otherwise entropy-normalized
        const confidence = nActions <= 1 ? 1.0 : (maxEntropy > 0 ? AIUtil.clamp(1 - entropy / maxEntropy, 0, 1) : 0);

        return { predictions, topAction, topProb, confidence };
    }

    /**
     * Get number of observations for a given evidence key
     */
    observationCount(evidenceKey) {
        const cond = this._conditionals[evidenceKey];
        if (!cond) return 0;
        let total = 0;
        for (const k in cond) total += cond[k];
        return total;
    }

    get totalObservations() { return this._totalObs; }

    /**
     * Apply decay to all counters (recency bias)
     * @param {number} factor — 0..1 (e.g. 0.95)
     */
    decay(factor) {
        for (const key in this._conditionals) {
            for (const action in this._conditionals[key]) {
                this._conditionals[key][action] = Math.floor(this._conditionals[key][action] * factor);
                if (this._conditionals[key][action] === 0) delete this._conditionals[key][action];
            }
            if (Object.keys(this._conditionals[key]).length === 0) delete this._conditionals[key];
        }
        for (const action in this._actionCounts) {
            this._actionCounts[action] = Math.floor(this._actionCounts[action] * factor);
            if (this._actionCounts[action] === 0) delete this._actionCounts[action];
        }
        this._totalObs = Math.floor(this._totalObs * factor);
    }

    toJSON() {
        return { conditionals: this._conditionals, actions: this._actionCounts, total: this._totalObs };
    }

    fromJSON(data) {
        if (!data) return;
        this._conditionals = data.conditionals || {};
        this._actionCounts = data.actions || {};
        this._totalObs = data.total || 0;
    }
}


// ============================================================================
// SECTION 0.8 — SEQUENCE PREDICTOR (Phase 3: Markov Chain)
// ============================================================================
// First-order Markov chain: P(next | current).
// Tracks transition probabilities between consecutive player actions.
// Works for both cricket (shot sequences) and football (direction sequences).
//
// Example: If player did LEFT → LEFT → RIGHT, the transitions are:
//   LEFT → LEFT (count++)
//   LEFT → RIGHT (count++)
//
// Memory: O(states²) — for 6 shots × 6 shots = 36 cells max.
// ============================================================================

class SequencePredictor {
    /**
     * @param {number} [order=1] — Markov order (1 = first-order, 2 = bigram context)
     */
    constructor(order = 1) {
        this.order = order;
        // Transition table: { prevState: { nextState: count } }
        this._transitions = {};
        // State history buffer
        this._history = [];
        this._maxHistory = 50;
        this._totalTransitions = 0;
    }

    /**
     * Record a state observation (call sequentially)
     * @param {string} state — e.g. "PULL", "left", "dive_right"
     */
    observe(state) {
        // Record transition from previous state(s)
        if (this._history.length >= this.order) {
            const context = this.order === 1
                ? this._history[this._history.length - 1]
                : this._history.slice(-this.order).join('→');

            if (!this._transitions[context]) this._transitions[context] = {};
            this._transitions[context][state] = (this._transitions[context][state] || 0) + 1;
            this._totalTransitions++;
        }

        this._history.push(state);
        if (this._history.length > this._maxHistory) this._history.shift();
    }

    /**
     * Predict next state from current context
     * @param {string} [currentState] — override current context (default: last observed)
     * @returns {{ predictions: Array<{state: string, probability: number}>, topState: string, topProb: number }}
     */
    predict(currentState) {
        const context = currentState || (this._history.length > 0 ? this._history[this._history.length - 1] : null);
        if (!context || !this._transitions[context]) {
            return { predictions: [], topState: null, topProb: 0 };
        }

        const transitions = this._transitions[context];
        let total = 0;
        for (const s in transitions) total += transitions[s];

        const predictions = [];
        let topState = null, topProb = 0;

        for (const s in transitions) {
            const prob = total > 0 ? transitions[s] / total : 0;
            predictions.push({ state: s, probability: prob });
            if (prob > topProb) { topProb = prob; topState = s; }
        }

        predictions.sort((a, b) => b.probability - a.probability);
        return { predictions, topState, topProb };
    }

    /**
     * Get transition matrix as flat object (for debug/visualization)
     * @returns {object} { "from→to": probability }
     */
    getMatrix() {
        const matrix = {};
        for (const from in this._transitions) {
            let total = 0;
            for (const to in this._transitions[from]) total += this._transitions[from][to];
            for (const to in this._transitions[from]) {
                matrix[`${from}→${to}`] = total > 0 ? this._transitions[from][to] / total : 0;
            }
        }
        return matrix;
    }

    /**
     * Detect if player is in a repeating pattern
     * @param {number} [minLen=2] — minimum pattern length
     * @param {number} [minReps=2] — minimum repetitions
     * @returns {{ pattern: string[] | null, length: number, repetitions: number }}
     */
    detectPattern(minLen = 2, minReps = 2) {
        const h = this._history;
        if (h.length < minLen * minReps) return { pattern: null, length: 0, repetitions: 0 };

        // Check patterns of length 2, 3, 4
        for (let len = minLen; len <= Math.min(4, Math.floor(h.length / minReps)); len++) {
            const candidate = h.slice(-len);
            let reps = 0;
            let match = true;

            // Check backwards for repetitions
            for (let r = 1; r <= Math.floor(h.length / len); r++) {
                const offset = h.length - len * (r + 1);
                if (offset < 0) break;
                const segment = h.slice(offset, offset + len);
                if (segment.every((v, i) => v === candidate[i])) {
                    reps++;
                } else {
                    break;
                }
            }

            if (reps >= minReps - 1) {
                return { pattern: candidate, length: len, repetitions: reps + 1 };
            }
        }

        return { pattern: null, length: 0, repetitions: 0 };
    }

    get historyLength() { return this._history.length; }
    get lastState() { return this._history.length > 0 ? this._history[this._history.length - 1] : null; }

    toJSON() {
        return { transitions: this._transitions, history: this._history.slice(-20), total: this._totalTransitions };
    }

    fromJSON(data) {
        if (!data) return;
        this._transitions = data.transitions || {};
        this._history = data.history || [];
        this._totalTransitions = data.total || 0;
    }
}


// ============================================================================
// SECTION 0.9 — ADAPTIVE DIFFICULTY (Phase 3)
// ============================================================================
// Real-time difficulty adjustment based on player performance.
// Uses exponential moving average (EMA) of success rate to compute
// a difficulty multiplier that scales AI behavior.
//
// Flow:
//   Player performance → success EMA → difficulty curve → AI parameter scaling
//
// Ensures the game stays in the "flow zone" — not too easy, not too hard.
// ============================================================================

class AdaptiveDifficulty {
    /**
     * @param {object} [config]
     * @param {number} [config.targetWinRate=0.45] — ideal player success rate
     * @param {number} [config.emaAlpha=0.1] — EMA smoothing (0=slow, 1=instant)
     * @param {number} [config.adjustRate=0.02] — how fast difficulty changes per tick
     * @param {number} [config.minDifficulty=0.3] — floor
     * @param {number} [config.maxDifficulty=1.5] — ceiling
     * @param {number} [config.minSamples=5] — min events before adjustments begin
     */
    constructor(config = {}) {
        this.targetWinRate = config.targetWinRate || 0.45;
        this.emaAlpha = config.emaAlpha || 0.1;
        this.adjustRate = config.adjustRate || 0.02;
        this.minDifficulty = config.minDifficulty || 0.3;
        this.maxDifficulty = config.maxDifficulty || 1.5;
        this.minSamples = config.minSamples || 5;

        // State
        this.currentDifficulty = 1.0;  // 1.0 = baseline
        this.winRateEMA = 0.5;         // running success rate
        this._totalEvents = 0;
        this._wins = 0;
        this._losses = 0;
        this._recentResults = [];      // last N results for windowed analysis
        this._maxRecent = 30;

        // Streak tracking
        this.currentStreak = 0;        // positive = wins, negative = losses
        this.longestWinStreak = 0;
        this.longestLossStreak = 0;
    }

    /**
     * Record a game event outcome
     * @param {boolean} playerWon — true if player succeeded
     */
    recordResult(playerWon) {
        this._totalEvents++;
        if (playerWon) {
            this._wins++;
            this.currentStreak = this.currentStreak > 0 ? this.currentStreak + 1 : 1;
            if (this.currentStreak > this.longestWinStreak) this.longestWinStreak = this.currentStreak;
        } else {
            this._losses++;
            this.currentStreak = this.currentStreak < 0 ? this.currentStreak - 1 : -1;
            if (-this.currentStreak > this.longestLossStreak) this.longestLossStreak = -this.currentStreak;
        }

        this._recentResults.push(playerWon ? 1 : 0);
        if (this._recentResults.length > this._maxRecent) this._recentResults.shift();

        // Update EMA
        this.winRateEMA = this.winRateEMA * (1 - this.emaAlpha) + (playerWon ? 1 : 0) * this.emaAlpha;

        // Adjust difficulty
        if (this._totalEvents >= this.minSamples) {
            this._adjustDifficulty();
        }
    }

    /**
     * Core difficulty adjustment algorithm
     * Moves difficulty toward a value that would produce targetWinRate
     */
    _adjustDifficulty() {
        const error = this.winRateEMA - this.targetWinRate;
        // Positive error = player winning too much → increase difficulty
        // Negative error = player losing too much → decrease difficulty

        let adjustment = error * this.adjustRate;

        // Streak amplification: bigger adjustments during streaks
        const streakAbs = Math.abs(this.currentStreak);
        if (streakAbs >= 3) {
            adjustment *= (1 + (streakAbs - 2) * 0.15); // 15% extra per streak beyond 2
        }

        // Frustration guard: rapid decrease if on big losing streak
        if (this.currentStreak <= -4) {
            adjustment = Math.min(adjustment, -this.adjustRate * 2);
        }

        // Boredom guard: rapid increase if on big winning streak
        if (this.currentStreak >= 5) {
            adjustment = Math.max(adjustment, this.adjustRate * 2);
        }

        this.currentDifficulty = AIUtil.clamp(
            this.currentDifficulty + adjustment,
            this.minDifficulty,
            this.maxDifficulty
        );
    }

    /**
     * Get scaling parameters for AI behavior
     * @returns {object} { speedMul, accuracyMul, reactionMul, aggressionMul }
     */
    getScaling() {
        const d = this.currentDifficulty;
        return {
            // Ball speed / dive speed multiplier
            speedMul: 0.7 + d * 0.3,        // 0.7 → 1.15 across range
            // AI prediction accuracy
            accuracyMul: 0.5 + d * 0.4,     // 0.5 → 1.1
            // Reaction time multiplier (lower = faster)
            reactionMul: 1.5 - d * 0.5,     // 1.5 → 0.75 (inverted)
            // Bowling/keeper aggression
            aggressionMul: 0.6 + d * 0.4,   // 0.6 → 1.2
        };
    }

    /**
     * Get windowed win rate (last N results)
     * @returns {number} 0-1
     */
    get recentWinRate() {
        if (this._recentResults.length === 0) return 0.5;
        return this._recentResults.reduce((s, v) => s + v, 0) / this._recentResults.length;
    }

    /**
     * Human-readable difficulty label
     */
    get label() {
        const d = this.currentDifficulty;
        if (d < 0.5) return 'Very Easy';
        if (d < 0.8) return 'Easy';
        if (d < 1.1) return 'Medium';
        if (d < 1.3) return 'Hard';
        return 'Legend';
    }

    get summary() {
        return {
            difficulty: this.currentDifficulty.toFixed(2),
            label: this.label,
            winRate: this.winRateEMA.toFixed(2),
            recentWinRate: this.recentWinRate.toFixed(2),
            streak: this.currentStreak,
            events: this._totalEvents,
        };
    }

    toJSON() {
        return {
            difficulty: this.currentDifficulty,
            winRate: this.winRateEMA,
            events: this._totalEvents,
            wins: this._wins,
            losses: this._losses,
            streak: this.currentStreak,
        };
    }

    fromJSON(data) {
        if (!data) return;
        this.currentDifficulty = data.difficulty || 1.0;
        this.winRateEMA = data.winRate || 0.5;
        this._totalEvents = data.events || 0;
        this._wins = data.wins || 0;
        this._losses = data.losses || 0;
        this.currentStreak = data.streak || 0;
    }
}


// ============================================================================
// SECTION 1 — AI ENGINE CORE
// ============================================================================

class AIEngine {
    /**
     * @param {object} [config]
     * @param {string} [config.difficulty='medium'] — easy|medium|hard|legend
     * @param {number} [config.tickBudgetMs=2] — max ms per AI tick (perf guard)
     */
    constructor(config = {}) {
        this.difficulty = config.difficulty || 'medium';
        this.tickBudgetMs = config.tickBudgetMs || 2;
        this._frameCount = 0;

        // Sub-systems (lazy init — only allocate what's used)
        this._cricketAI = null;
        this._footballAI = null;

        // Phase 2: Player behavior model (shared across sub-systems)
        this.playerModel = new PlayerModel({
            maxSamples: config.maxSamples || 200,
            decayRate: config.decayRate || 0.98,
        });

        // Phase 3: Probability-based predictors (shared across sub-systems)
        this.cricketBayes = new BayesPredictor(config.bayesSmoothing || 1);
        this.fbBayes = new BayesPredictor(config.bayesSmoothing || 1);
        this.cricketSeq = new SequencePredictor(1);
        this.fbSeq = new SequencePredictor(1);
        this.difficulty_adaptive = new AdaptiveDifficulty({
            targetWinRate: config.targetWinRate || 0.45,
            emaAlpha: config.difficultyEmaAlpha || 0.1,
            adjustRate: config.difficultyAdjustRate || 0.02,
        });

        // Perf telemetry (debug only)
        this._lastTickMs = 0;
        this._avgTickMs = 0;
        this._peakTickMs = 0;
    }

    // --- Lazy getters --------------------------------------------------------

    get cricket() {
        if (!this._cricketAI) {
            this._cricketAI = new CricketAI(this.difficulty, this.playerModel,
                this.cricketBayes, this.cricketSeq, this.difficulty_adaptive);
        }
        return this._cricketAI;
    }

    get football() {
        if (!this._footballAI) {
            this._footballAI = new FootballAI(this.difficulty, this.playerModel,
                this.fbBayes, this.fbSeq, this.difficulty_adaptive);
        }
        return this._footballAI;
    }

    // --- Difficulty -----------------------------------------------------------

    setDifficulty(d) {
        this.difficulty = d;
        if (this._cricketAI) this._cricketAI.setDifficulty(d);
        if (this._footballAI) this._footballAI.setDifficulty(d);
    }

    // --- Per-frame tick (call from game loop's update/fixedUpdate) -----------

    /**
     * Main AI tick — budget-guarded, call once per frame
     * @param {number} dt — delta time in seconds
     */
    tick(dt) {
        const t0 = performance.now();
        this._frameCount++;

        if (this._cricketAI) this._cricketAI.tick(dt, this._frameCount);
        if (this._footballAI) this._footballAI.tick(dt, this._frameCount);

        // Perf telemetry
        const elapsed = performance.now() - t0;
        this._lastTickMs = elapsed;
        this._avgTickMs = this._avgTickMs * 0.95 + elapsed * 0.05; // EMA
        if (elapsed > this._peakTickMs) this._peakTickMs = elapsed;
    }

    // --- Debug stats ---------------------------------------------------------

    get stats() {
        return {
            lastMs: this._lastTickMs.toFixed(2),
            avgMs: this._avgTickMs.toFixed(2),
            peakMs: this._peakTickMs.toFixed(2),
            frame: this._frameCount,
        };
    }

    /** Get Phase 3 predictor summaries for debug HUD */
    get phase3Stats() {
        return {
            cricketBayes: this.cricketBayes.totalObservations,
            fbBayes: this.fbBayes.totalObservations,
            cricketSeq: this.cricketSeq.historyLength,
            fbSeq: this.fbSeq.historyLength,
            difficulty: this.difficulty_adaptive.summary,
        };
    }

    /** Serialize all Phase 3 state for persistence */
    savePhase3() {
        return {
            cricketBayes: this.cricketBayes.toJSON(),
            fbBayes: this.fbBayes.toJSON(),
            cricketSeq: this.cricketSeq.toJSON(),
            fbSeq: this.fbSeq.toJSON(),
            difficulty: this.difficulty_adaptive.toJSON(),
            playerModel: this.playerModel.toJSON(),
        };
    }

    /** Restore all Phase 3 state */
    loadPhase3(data) {
        if (!data) return;
        if (data.cricketBayes) this.cricketBayes.fromJSON(data.cricketBayes);
        if (data.fbBayes) this.fbBayes.fromJSON(data.fbBayes);
        if (data.cricketSeq) this.cricketSeq.fromJSON(data.cricketSeq);
        if (data.fbSeq) this.fbSeq.fromJSON(data.fbSeq);
        if (data.difficulty) this.difficulty_adaptive.fromJSON(data.difficulty);
        if (data.playerModel) this.playerModel.fromJSON(data.playerModel);
    }

    resetPeakMs() { this._peakTickMs = 0; }
}


// ============================================================================
// SECTION 2 — CRICKET AI
// ============================================================================
//
// Two decision modes:
// A) BATTING AI — Given a delivery, select optimal shot + timing
// B) BOWLING AI — Given game state, select delivery (type/length/line)
//
// All decisions are lookup-table based with weighted randomness.
// No allocations in the hot path — tables are static const.
// ============================================================================


// --- BATTING: Shot effectiveness lookup table --------------------------------
// Key: ballType|length → { shotName: effectiveness 0-100 }
// Higher = better chance of runs, lower = risky/miss

const BAT_EFFECTIVENESS = {
    // Fast deliveries
    'fast|short':   { PULL: 85, CUT: 60, DEFEND: 70, LOFT: 30, DRIVE: 20, SWEEP: 10 },
    'fast|good':    { DRIVE: 80, DEFEND: 75, CUT: 45, PULL: 25, LOFT: 40, SWEEP: 15 },
    'fast|yorker':  { DEFEND: 80, DRIVE: 30, SWEEP: 20, LOFT: 10, PULL: 10, CUT: 15 },

    // Medium pace
    'medium|short': { PULL: 80, CUT: 70, LOFT: 50, DEFEND: 60, DRIVE: 30, SWEEP: 25 },
    'medium|good':  { DRIVE: 85, CUT: 60, DEFEND: 70, LOFT: 55, PULL: 35, SWEEP: 30 },
    'medium|yorker':{ DEFEND: 75, DRIVE: 40, LOFT: 15, SWEEP: 25, PULL: 10, CUT: 20 },

    // Spin
    'spin|short':   { CUT: 85, PULL: 70, LOFT: 60, SWEEP: 50, DEFEND: 55, DRIVE: 30 },
    'spin|good':    { SWEEP: 80, DRIVE: 70, LOFT: 65, DEFEND: 60, CUT: 50, PULL: 30 },
    'spin|yorker':  { SWEEP: 60, DEFEND: 70, DRIVE: 35, LOFT: 20, CUT: 25, PULL: 15 },

    // Yorker (delivery type)
    'yorker|short': { PULL: 75, CUT: 65, LOFT: 45, DEFEND: 60, DRIVE: 30, SWEEP: 20 },
    'yorker|good':  { DEFEND: 80, DRIVE: 50, SWEEP: 30, LOFT: 20, CUT: 25, PULL: 15 },
    'yorker|yorker':{ DEFEND: 85, DRIVE: 20, LOFT: 5, SWEEP: 15, PULL: 5, CUT: 10 },

    // Bouncer
    'bouncer|short': { PULL: 90, CUT: 55, DEFEND: 65, LOFT: 40, DRIVE: 15, SWEEP: 10 },
    'bouncer|good':  { PULL: 70, CUT: 60, DEFEND: 70, LOFT: 35, DRIVE: 40, SWEEP: 20 },
    'bouncer|yorker':{ DEFEND: 75, DRIVE: 30, PULL: 20, CUT: 25, LOFT: 10, SWEEP: 15 },

    // Slower ball
    'slower|short': { CUT: 80, PULL: 75, LOFT: 70, SWEEP: 55, DEFEND: 50, DRIVE: 40 },
    'slower|good':  { DRIVE: 80, LOFT: 75, SWEEP: 65, CUT: 55, DEFEND: 55, PULL: 35 },
    'slower|yorker':{ DEFEND: 70, SWEEP: 50, DRIVE: 40, LOFT: 25, CUT: 30, PULL: 15 },
};

// --- BATTING: Line modifier --------------------------------------------------
// Adjusts effectiveness based on ball line
const LINE_MODIFIERS = {
    // shot → { line: multiplier }
    DRIVE:  { left: 1.1, center: 1.0, right: 0.7 },
    CUT:    { left: 0.6, center: 0.8, right: 1.3 },
    PULL:   { left: 0.7, center: 0.9, right: 1.2 },
    SWEEP:  { left: 0.8, center: 1.0, right: 1.1 },
    LOFT:   { left: 0.9, center: 1.1, right: 0.8 },
    DEFEND: { left: 1.0, center: 1.0, right: 1.0 },
};

// --- BATTING: Difficulty → aggression mapping --------------------------------
const BAT_AGGRESSION = {
    easy:   { riskTolerance: 0.7, defendBias: 0.8, perfectBonus: 1.0 },
    medium: { riskTolerance: 0.5, defendBias: 1.0, perfectBonus: 1.2 },
    hard:   { riskTolerance: 0.3, defendBias: 1.3, perfectBonus: 1.5 },
    legend: { riskTolerance: 0.15, defendBias: 1.5, perfectBonus: 2.0 },
};

// --- BOWLING: Situation-aware delivery weights -------------------------------
// Returns weight map for { type: weight } based on game situation

const BOWL_STRATEGIES = {
    // Wicket needed urgently
    wicket_hunting: {
        fast: 25, yorker: 30, bouncer: 20, medium: 10, spin: 10, slower: 5,
        lengths: { short: 20, good: 50, yorker: 30 },
        lines:   { left: 30, center: 50, right: 20 },
    },
    // Economy — restrict runs
    defensive: {
        fast: 15, medium: 25, spin: 20, yorker: 20, slower: 15, bouncer: 5,
        lengths: { short: 10, good: 60, yorker: 30 },
        lines:   { left: 40, center: 40, right: 20 },
    },
    // Standard — balanced
    balanced: {
        fast: 20, medium: 20, spin: 15, yorker: 15, bouncer: 15, slower: 15,
        lengths: { short: 25, good: 50, yorker: 25 },
        lines:   { left: 30, center: 40, right: 30 },
    },
    // Aggressive — test the batsman
    aggressive: {
        fast: 30, bouncer: 25, yorker: 20, medium: 10, spin: 10, slower: 5,
        lengths: { short: 35, good: 35, yorker: 30 },
        lines:   { left: 25, center: 35, right: 40 },
    },
};

// --- BOWLING: Variation memory (avoid repetition) ----------------------------
// Anti-repeat: reduce weight of recently used deliveries

const VARIATION_DECAY = 0.4; // How much to penalize repeat (0 = full block, 1 = no penalty)


class CricketAI {
    constructor(difficulty = 'medium', playerModel = null, bayes = null, sequence = null, adaptiveDiff = null) {
        this.difficulty = difficulty;
        this.model = playerModel;       // Phase 2: shared PlayerModel reference
        this.bayes = bayes;             // Phase 3: BayesPredictor for shot prediction
        this.sequence = sequence;       // Phase 3: SequencePredictor for shot sequences
        this.adaptiveDiff = adaptiveDiff; // Phase 3: AdaptiveDifficulty

        // Bowling state — last N deliveries for variation tracking
        this._recentBowl = [];     // [ { type, length, line }, ... ] max 6
        this._maxRecent = 6;

        // Batting state — context
        this._lastShotResult = null;
    }

    setDifficulty(d) { this.difficulty = d; }

    tick(dt, frame) {
        // No per-frame work needed for rule-based — decisions are on-demand
    }

    // =====================================================================
    // Phase 3: Record observations for Bayes + Sequence predictors
    // Call after each batting event to feed probability models.
    // =====================================================================

    /**
     * Feed batting result into Phase 3 predictors
     * @param {object} delivery — { ball_type, length, line }
     * @param {object} result — { action (shot), quality, runs, wasCaught }
     */
    recordBattingEvent(delivery, result) {
        const action = result.action || 'DEFEND';
        const evidenceKey = AIUtil.hash3(delivery.ball_type, delivery.length, delivery.line);

        // Bayes: P(shot | delivery context)
        if (this.bayes) {
            this.bayes.observe(evidenceKey, action);
        }

        // Sequence: track shot sequence patterns
        if (this.sequence) {
            this.sequence.observe(action);
        }

        // Adaptive difficulty: player scored runs = player won this event
        if (this.adaptiveDiff) {
            const playerWon = (result.runs || 0) > 0;
            this.adaptiveDiff.recordResult(playerWon);
        }

        // Also feed Phase 2 model
        if (this.model) {
            this.model.recordBatting(delivery, result);
        }
    }

    // =====================================================================
    // BATTING AI — "What shot should I play?"
    // =====================================================================

    /**
     * Select optimal shot for given delivery
     * @param {object} input
     * @param {string} input.ball_type — fast|medium|spin|yorker|bouncer|slower
     * @param {string} input.line — left|center|right
     * @param {string} input.length — short|good|yorker
     * @param {string} [input.timing] — early|perfect|late|miss (if known)
     * @param {object} [context] — { runs, wickets, overs, target }
     * @returns {{ action: string, confidence: number, swipeAngle: number }}
     */
    selectShot(input, context = {}) {
        const key = AIUtil.hash2(input.ball_type, input.length);
        const baseTable = BAT_EFFECTIVENESS[key];

        if (!baseTable) {
            // Unknown delivery — safe defend
            return { action: 'DEFEND', confidence: 0.5, swipeAngle: -Math.PI / 2 };
        }

        // Step 1: Copy and apply line modifiers
        const weights = {};
        for (const shot in baseTable) {
            const lineMod = LINE_MODIFIERS[shot]?.[input.line] || 1.0;
            weights[shot] = baseTable[shot] * lineMod;
        }

        // Step 2: Apply timing modifier
        if (input.timing === 'early') {
            // Early timing favors pull/cut, penalizes drive/loft
            weights.PULL = (weights.PULL || 0) * 1.3;
            weights.CUT = (weights.CUT || 0) * 1.2;
            weights.DRIVE = (weights.DRIVE || 0) * 0.6;
            weights.LOFT = (weights.LOFT || 0) * 0.5;
        } else if (input.timing === 'late') {
            // Late timing favors drive/sweep, penalizes pull
            weights.DRIVE = (weights.DRIVE || 0) * 1.2;
            weights.SWEEP = (weights.SWEEP || 0) * 1.3;
            weights.PULL = (weights.PULL || 0) * 0.5;
            weights.CUT = (weights.CUT || 0) * 0.7;
        } else if (input.timing === 'miss') {
            return { action: 'DEFEND', confidence: 0.2, swipeAngle: -Math.PI / 2 };
        }

        // Step 3: Apply difficulty aggression
        const agg = BAT_AGGRESSION[this.difficulty] || BAT_AGGRESSION.medium;
        weights.DEFEND = (weights.DEFEND || 0) * agg.defendBias;

        // Suppress risky shots at low risk tolerance
        if (Math.random() > agg.riskTolerance) {
            weights.LOFT = (weights.LOFT || 0) * 0.3;
        }

        // Step 4: Context-aware adjustments
        if (context.wickets >= 2) {
            // Protect wicket — boost defend
            weights.DEFEND = (weights.DEFEND || 0) * 1.5;
            weights.LOFT = (weights.LOFT || 0) * 0.4;
        }
        if (context.target && context.runs !== undefined) {
            const runRate = (context.target - context.runs);
            if (runRate > 30) {
                // Need acceleration — boost attacking shots
                weights.LOFT = (weights.LOFT || 0) * 1.8;
                weights.DRIVE = (weights.DRIVE || 0) * 1.3;
            }
        }

        // Step 5: Phase 2 — Learning feedback (adjust weights from player history)
        if (this.model) {
            // If player has a preferred shot against this ball type, boost it
            const pref = this.model.preferredShot(input.ball_type);
            if (pref && pref.frequency > 0.3 && weights[pref.shot]) {
                weights[pref.shot] *= (1 + pref.frequency * 0.5);
            }

            // If player's aggression is high, boost attacking shots
            if (this.model.aggressionScore > 0.65) {
                weights.LOFT = (weights.LOFT || 0) * 1.3;
                weights.PULL = (weights.PULL || 0) * 1.2;
            } else if (this.model.aggressionScore < 0.35) {
                weights.DEFEND = (weights.DEFEND || 0) * 1.3;
                weights.SWEEP = (weights.SWEEP || 0) * 1.1;
            }

            // If a shot has a high caught rate, suppress it
            for (const shot in weights) {
                const outcome = this.model.shotOutcomes[shot];
                if (outcome && outcome.count >= 5) {
                    const caughtRate = outcome.caught / outcome.count;
                    if (caughtRate > 0.2) {
                        weights[shot] *= (1 - caughtRate);
                    }
                }
            }
        }

        // Step 5.5: Phase 3 — Bayes posterior + Sequence pattern adjustment
        if (this.bayes && this.bayes.totalObservations >= 8) {
            const evidenceKey = AIUtil.hash3(input.ball_type, input.length, input.line);
            const bayesPred = this.bayes.predict(evidenceKey);

            // If Bayes has confident prediction, boost top predicted shots
            if (bayesPred.confidence > 0.2 && bayesPred.predictions.length > 0) {
                for (const p of bayesPred.predictions) {
                    if (weights[p.action]) {
                        // Scale boost by confidence: max +40% at full confidence
                        weights[p.action] *= (1 + p.probability * bayesPred.confidence * 0.4);
                    }
                }
            }
        }

        if (this.sequence && this.sequence.historyLength >= 5) {
            // Detect if player is in a repeating pattern → counter it
            const pattern = this.sequence.detectPattern(2, 2);
            if (pattern.pattern) {
                // Player is repeating — suppress the predicted next shot slightly
                // (AI acknowledges the pattern and diversifies)
                const seqPred = this.sequence.predict();
                if (seqPred.topState && seqPred.topProb > 0.5 && weights[seqPred.topState]) {
                    // Reduce over-reliance on one shot when pattern detected
                    weights[seqPred.topState] *= 0.8;
                }
            }
        }

        // Step 5.7: Phase 3 — AdaptiveDifficulty scaling
        if (this.adaptiveDiff && this.adaptiveDiff._totalEvents >= 5) {
            const scaling = this.adaptiveDiff.getScaling();
            // Higher difficulty = AI plays more aggressive (boost LOFT/PULL)
            if (scaling.aggressionMul > 1.0) {
                weights.LOFT = (weights.LOFT || 0) * scaling.aggressionMul;
                weights.PULL = (weights.PULL || 0) * (scaling.aggressionMul * 0.8);
            }
            // Lower difficulty = safer play (boost DEFEND)
            if (scaling.aggressionMul < 0.8) {
                weights.DEFEND = (weights.DEFEND || 0) * (2 - scaling.aggressionMul);
            }
        }

        // Step 6: Pick
        const action = AIUtil.weightedPick(weights);

        // Confidence = selected weight / total
        let total = 0;
        for (const k in weights) total += weights[k];
        const confidence = AIUtil.clamp((weights[action] || 0) / Math.max(total, 1), 0, 1);

        // Map shot to swipe angle (radians)
        const swipeAngle = SHOT_SWIPE_MAP[action] || -Math.PI / 2;

        return { action, confidence, swipeAngle };
    }

    // =====================================================================
    // BOWLING AI — "What delivery should I bowl?"
    // =====================================================================

    /**
     * Select delivery based on game situation
     * @param {object} state
     * @param {number} state.runs — current score
     * @param {number} state.wickets — wickets fallen
     * @param {number} state.overs — overs completed (float: 3.2 = 3 overs 2 balls)
     * @param {number} [state.target] — chase target (if set)
     * @param {number} [state.maxOvers=10]
     * @returns {{ type: string, length: string, line: string, strategy: string }}
     */
    selectDelivery(state) {
        // Step 1: Determine strategy
        const strategy = this._pickStrategy(state);
        const strat = BOWL_STRATEGIES[strategy];

        // Step 2: Select type with variation penalty + learning
        const typeWeights = {};
        for (const t in strat) {
            if (t === 'lengths' || t === 'lines') continue;
            typeWeights[t] = strat[t];
        }

        // Phase 2: Exploit player weaknesses
        if (this.model) {
            const weakness = this.model.weakness();
            if (weakness && weakness.missRate > 0.25 && typeWeights[weakness.type] !== undefined) {
                // Boost the delivery type player struggles against
                typeWeights[weakness.type] *= (1 + weakness.missRate * 2);
            }

            // Also boost types with best bowling economy
            const bestBowl = this.model.bestBowlType();
            if (bestBowl && typeWeights[bestBowl.type] !== undefined) {
                typeWeights[bestBowl.type] *= 1.3;
            }
        }

        // Phase 3: Use Bayes to predict player's likely shot for each delivery combo
        // and boost deliveries where predicted shot has low effectiveness
        if (this.bayes && this.bayes.totalObservations >= 10) {
            for (const t in typeWeights) {
                // For each candidate type, check what shot player would likely play
                // against it at 'good' length (most common)
                const testKey = AIUtil.hash3(t, 'good', 'center');
                const pred = this.bayes.predict(testKey);
                if (pred.topAction && pred.confidence > 0.25) {
                    // Check effectiveness of predicted shot against this delivery
                    const effKey = AIUtil.hash2(t, 'good');
                    const effTable = BAT_EFFECTIVENESS[effKey];
                    if (effTable && effTable[pred.topAction] !== undefined) {
                        // Low effectiveness = good for bowler → boost this delivery type
                        const eff = effTable[pred.topAction] / 100;
                        typeWeights[t] *= (1 + (1 - eff) * pred.confidence * 0.5);
                    }
                }
            }
        }

        this._applyVariationPenalty(typeWeights, 'type');
        const type = AIUtil.weightedPick(typeWeights);

        // Step 3: Select length
        const lengthWeights = { ...strat.lengths };
        this._applyVariationPenalty(lengthWeights, 'length');
        const length = AIUtil.weightedPick(lengthWeights);

        // Step 4: Select line
        const lineWeights = { ...strat.lines };
        this._applyVariationPenalty(lineWeights, 'line');
        const line = AIUtil.weightedPick(lineWeights);

        // Record for variation tracking
        this._recentBowl.push({ type, length, line });
        if (this._recentBowl.length > this._maxRecent) this._recentBowl.shift();

        return { type, length, line, strategy };
    }

    /**
     * Pick bowling strategy from game situation
     */
    _pickStrategy(state) {
        const overs = state.overs || 0;
        const maxOvers = state.maxOvers || 10;
        const wickets = state.wickets || 0;
        const runs = state.runs || 0;
        const oversLeft = maxOvers - overs;

        // Chase mode: need wickets
        if (state.target && runs > state.target * 0.6 && oversLeft > 2) {
            return 'wicket_hunting';
        }

        // Late overs with batsman scoring freely
        const runRate = overs > 0 ? runs / overs : 0;
        if (runRate > 8 && oversLeft < 4) {
            return 'defensive';
        }

        // Wickets in hand — can be aggressive
        if (wickets < 1 && overs > 2) {
            return 'aggressive';
        }

        // Death overs
        if (oversLeft <= 2) {
            return 'wicket_hunting';
        }

        return 'balanced';
    }

    /**
     * Penalize recently used options to force variation
     * @param {object} weights — { key: weight } — MUTATED
     * @param {string} field — 'type' | 'length' | 'line'
     */
    _applyVariationPenalty(weights, field) {
        if (this._recentBowl.length === 0) return;

        // Count recent usage
        const counts = {};
        for (const d of this._recentBowl) {
            const v = d[field];
            counts[v] = (counts[v] || 0) + 1;
        }

        // Penalize repeats (more repeats = bigger penalty)
        for (const k in counts) {
            if (weights[k] !== undefined) {
                const penalty = Math.pow(VARIATION_DECAY, counts[k]);
                weights[k] *= penalty;
            }
        }
    }
}

// --- Shot → Swipe angle mapping (radians, per ShotTypes in cricket-physics) --
const SHOT_SWIPE_MAP = {
    LOFT:   -Math.PI / 2,        // straight up: -90°
    DRIVE:  -Math.PI / 4,        // forward-up: -45°
    CUT:     Math.PI / 8,        // lateral: ~22°
    PULL:    Math.PI * 0.85,     // behind: ~153°
    SWEEP:   Math.PI / 3,        // across: 60°
    DEFEND: -Math.PI / 2,        // tap/block
};


// ============================================================================
// SECTION 3 — FOOTBALL AI
// ============================================================================
//
// Decision modes:
// A) GOALKEEPER AI — Where to dive, when, how fast
// B) KICKER AI — Aim selection (for AI vs AI or practice mode)
//
// Uses FootballConfig.difficulties for difficulty-scaled behavior.
// Pattern tracking via simple frequency counters (Phase 2 hooks in place).
// ============================================================================


// --- Keeper: Zone-based save probability lookup ------------------------------
// goal split into 5 zones: far_left | left | center | right | far_right
// Each zone has base save probability scaled by difficulty

const KEEPER_ZONE_SAVE_PROB = {
    easy:   { far_left: 0.15, left: 0.35, center: 0.55, right: 0.35, far_right: 0.15 },
    medium: { far_left: 0.30, left: 0.50, center: 0.70, right: 0.50, far_right: 0.30 },
    hard:   { far_left: 0.50, left: 0.70, center: 0.85, right: 0.70, far_right: 0.50 },
    legend: { far_left: 0.65, left: 0.82, center: 0.92, right: 0.82, far_right: 0.65 },
};

// --- Keeper: Anticipation rules (which zone to pre-position toward) ----------
const KEEPER_ANTICIPATION = {
    // If player shot left twice in a row, lean left
    streak_threshold: 2,
    lean_amount: 0.35,        // 0-1, how much to shift toward predicted side
};

// --- Kicker: Shot zone weights (for AI kicker mode) --------------------------
const KICKER_ZONE_WEIGHTS = {
    easy:   { far_left: 20, left: 30, center: 30, right: 30, far_left2: 20 },
    medium: { far_left: 25, left: 25, center: 15, right: 25, far_right: 25 },
    hard:   { far_left: 30, left: 20, center: 10, right: 20, far_right: 30 },
    legend: { far_left: 35, left: 20, center: 5,  right: 20, far_right: 35 },
};


class FootballAI {
    constructor(difficulty = 'medium', playerModel = null, bayes = null, sequence = null, adaptiveDiff = null) {
        this.difficulty = difficulty;
        this.model = playerModel;       // Phase 2: shared PlayerModel reference
        this.bayes = bayes;             // Phase 3: BayesPredictor for direction
        this.sequence = sequence;       // Phase 3: SequencePredictor for direction sequences
        this.adaptiveDiff = adaptiveDiff; // Phase 3: AdaptiveDifficulty

        // Shot history tracking (simple frequency counter)
        this._shotHistory = [];       // last N directions
        this._maxHistory = 20;
        this._zoneCounts = { far_left: 0, left: 0, center: 0, right: 0, far_right: 0 };

        // Keeper state
        this._anticipatedZone = 'center';
        this._lastDiveDecision = null;
        this._lastShotDir = null;     // Phase 2: for post-save tracking
        this._lastResult = null;      // Phase 2: 'save'|'goal'|etc
    }

    setDifficulty(d) { this.difficulty = d; }

    tick(dt, frame) {
        // No per-frame work for rule-based — decisions are on-demand
    }

    // =====================================================================
    // GOALKEEPER AI — "Where should I dive?"
    // =====================================================================

    /**
     * Decide goalkeeper dive action
     * @param {object} input
     * @param {string} input.direction — 'left'|'center'|'right' (shot direction)
     * @param {number} input.power — 0..1
     * @param {string[]} [input.history] — recent shot directions
     * @returns {{ action: string, confidence: number, reactionMs: number, diveSpeed: number }}
     */
    decideKeeper(input) {
        // Sync history if provided
        if (input.history && input.history.length > 0) {
            this._shotHistory = input.history.slice(-this._maxHistory);
            this._rebuildZoneCounts();
        }

        // Step 1: Classify shot into 5-zone
        const shotZone = this._classifyZone(input.direction, input.power);

        // Step 2: Anticipation (pre-read based on history)
        const anticipated = this._anticipate();

        // Step 3: Difficulty-scaled reaction
        const diffCfg = FootballConfig.difficulties[this.difficulty] || FootballConfig.difficulties.medium;

        // Step 4: Decide dive direction
        let diveAction;
        const anticipatedCorrectly = anticipated === shotZone ||
            (anticipated === 'left' && shotZone === 'far_left') ||
            (anticipated === 'right' && shotZone === 'far_right');

        if (anticipatedCorrectly) {
            // Correct read — dive to correct side
            diveAction = this._zoneToDive(shotZone);
        } else {
            // Wrong read — apply prediction error chance
            if (Math.random() < diffCfg.predictionError) {
                // Guessed wrong direction
                diveAction = this._zoneToDive(anticipated);
            } else {
                // React to actual direction
                diveAction = this._zoneToDive(shotZone);
            }
        }

        // Step 5: Miss chance (AI intentionally misses for fairness)
        if (Math.random() < diffCfg.missChance) {
            const wrongDirs = ['dive_left', 'dive_right', 'dive_center'].filter(d => d !== diveAction);
            diveAction = wrongDirs[Math.floor(Math.random() * wrongDirs.length)];
        }

        // Step 6: Save probability
        const saveProbs = KEEPER_ZONE_SAVE_PROB[this.difficulty] || KEEPER_ZONE_SAVE_PROB.medium;
        const saveChance = saveProbs[shotZone] || 0.5;

        // Power penalty — high power is harder to save
        const powerPenalty = input.power > 0.8 ? 0.85 : (input.power > 0.6 ? 0.95 : 1.0);
        const confidence = AIUtil.clamp(saveChance * powerPenalty, 0, 1);

        // Step 7: Phase 3 — AdaptiveDifficulty scaling
        let reactionMs = diffCfg.reactionDelayMs;
        let diveSpeed = diffCfg.diveSpeed;

        if (this.adaptiveDiff && this.adaptiveDiff._totalEvents >= 5) {
            const scaling = this.adaptiveDiff.getScaling();
            // Faster reaction at higher difficulty (reactionMul < 1 = faster)
            reactionMs = Math.round(reactionMs * scaling.reactionMul);
            // Faster dive at higher difficulty
            diveSpeed = diveSpeed * scaling.speedMul;
        }

        this._lastDiveDecision = {
            action: diveAction,
            confidence,
            reactionMs,
            diveSpeed,
            anticipated,
            shotZone,
        };

        return this._lastDiveDecision;
    }

    /**
     * Record a player shot for pattern tracking
     * @param {string} direction — 'left'|'center'|'right'
     * @param {number} power
     * @param {object} [extra] — { round, maxRounds, result }
     */
    recordShot(direction, power, extra = {}) {
        const zone = this._classifyZone(direction, power);
        this._shotHistory.push(direction);
        if (this._shotHistory.length > this._maxHistory) this._shotHistory.shift();
        this._zoneCounts[zone] = (this._zoneCounts[zone] || 0) + 1;

        // Phase 2: Feed into PlayerModel
        if (this.model) {
            this.model.recordFootball({
                direction,
                power,
                round: extra.round,
                maxRounds: extra.maxRounds,
                afterSave: this._lastResult === 'save',
                prevDirection: this._lastShotDir,
            });
        }

        // Phase 3: Feed Bayes + Sequence predictors
        if (this.bayes) {
            // Evidence = round phase + power bucket + last result
            const phase = extra.round && extra.maxRounds
                ? (extra.round <= extra.maxRounds * 0.33 ? 'early' : (extra.round <= extra.maxRounds * 0.66 ? 'mid' : 'late'))
                : 'mid';
            const pwrBucket = power < 0.5 ? 'low' : (power < 0.8 ? 'med' : 'high');
            const evidenceKey = AIUtil.hash2(phase, pwrBucket);
            this.bayes.observe(evidenceKey, direction);
        }
        if (this.sequence) {
            this.sequence.observe(direction);
        }

        this._lastShotDir = direction;
    }

    /**
     * Record the result of the last shot (for post-save tracking + adaptive difficulty)
     * @param {string} result — 'goal'|'save'|'miss'|'post'|'over'
     */
    recordResult(result) {
        this._lastResult = result;

        // Phase 3: Feed AdaptiveDifficulty (goal = player won, save = player lost)
        if (this.adaptiveDiff) {
            const playerWon = result === 'goal';
            this.adaptiveDiff.recordResult(playerWon);
        }
    }

    // =====================================================================
    // KICKER AI — "Where should I aim?" (for AI-vs-AI / auto mode)
    // =====================================================================

    /**
     * Select shot target for AI kicker
     * @param {object} [context] — { keeperPosition, round, streak }
     * @returns {{ action: string, zone: string, aimX: number, power: number }}
     */
    selectShot(context = {}) {
        // Weight zones based on difficulty (harder AI = more corners)
        const zoneWeights = KICKER_ZONE_WEIGHTS[this.difficulty] || KICKER_ZONE_WEIGHTS.medium;
        const zone = AIUtil.weightedPick(zoneWeights);

        // Convert zone to aim X position
        const goalCX = FootballConfig.field.goalCenterX;
        const goalW = FootballConfig.field.goalWidth;
        const goalLeft = goalCX - goalW / 2;

        const zoneXMap = {
            far_left:  goalLeft + goalW * 0.08,
            left:      goalLeft + goalW * 0.25,
            center:    goalCX,
            right:     goalLeft + goalW * 0.75,
            far_right: goalLeft + goalW * 0.92,
        };

        const aimX = zoneXMap[zone] || goalCX;

        // Power: harder difficulties use more precise power
        const powerMap = { easy: 0.5, medium: 0.65, hard: 0.78, legend: 0.85 };
        const basePower = powerMap[this.difficulty] || 0.65;
        const powerJitter = (Math.random() - 0.5) * 0.2;
        const power = AIUtil.clamp(basePower + powerJitter, 0.3, 0.95);

        return {
            action: `shoot_${zone}`,
            zone,
            aimX,
            power,
        };
    }

    // --- Internal helpers ----------------------------------------------------

    /**
     * Classify direction+power into 5-zone
     */
    _classifyZone(direction, power) {
        const isStrong = power > 0.7;
        switch (direction) {
            case 'left':  return isStrong ? 'far_left' : 'left';
            case 'right': return isStrong ? 'far_right' : 'right';
            default:      return 'center';
        }
    }

    /**
     * Anticipate next shot direction from history + PlayerModel + Phase 3 predictors
     * Priority: Sequence pattern > Bayes posterior > PlayerModel > Phase 1 frequency
     * @returns {string} zone to lean toward
     */
    _anticipate() {
        // Phase 3: Sequence pattern detection (strongest signal — exploits repeating behavior)
        if (this.sequence && this.sequence.historyLength >= 4) {
            const pattern = this.sequence.detectPattern(2, 2);
            if (pattern.pattern) {
                // Player is in a repeating pattern → predict next in sequence
                const seqPred = this.sequence.predict();
                if (seqPred.topState && seqPred.topProb > 0.55) {
                    return seqPred.topState;
                }
            }

            // Even without a full pattern, Markov prediction can be useful
            const seqPred = this.sequence.predict();
            if (seqPred.topState && seqPred.topProb > 0.6) {
                return seqPred.topState;
            }
        }

        // Phase 3: Bayes posterior (context-aware prediction)
        if (this.bayes && this.bayes.totalObservations >= 6) {
            // Use generic evidence key for general prediction
            const evidenceKey = 'mid|med'; // default context
            const bayesPred = this.bayes.predict(evidenceKey);
            if (bayesPred.topAction && bayesPred.confidence > 0.3) {
                return bayesPred.topAction;
            }
        }

        // Phase 2: Use PlayerModel if available (richer data)
        if (this.model) {
            // Post-save prediction: if player tends to switch after being saved
            if (this._lastResult === 'save' && this._lastShotDir) {
                const switchProb = this.model.switchAfterSaveProbability();
                if (switchProb > 0.6) {
                    const opposite = this._lastShotDir === 'left' ? 'right'
                        : (this._lastShotDir === 'right' ? 'left' : 'center');
                    return opposite;
                } else if (switchProb < 0.35) {
                    return this._lastShotDir;
                }
            }

            // Use PlayerModel's richer prediction
            const pred = this.model.predictDirection();
            if (pred.confidence > 0.45) {
                return pred.direction;
            }
        }

        // Fallback: Phase 1 simple history analysis
        if (this._shotHistory.length < 2) return 'center';

        // Check for streak
        const last = this._shotHistory.slice(-KEEPER_ANTICIPATION.streak_threshold);
        const allSame = last.every(d => d === last[0]);
        if (allSame && last.length >= KEEPER_ANTICIPATION.streak_threshold) {
            return last[0] === 'left' ? 'left' : (last[0] === 'right' ? 'right' : 'center');
        }

        // Frequency bias — lean toward most common
        const counts = { left: 0, center: 0, right: 0 };
        for (const d of this._shotHistory) counts[d] = (counts[d] || 0) + 1;

        let maxDir = 'center', maxCount = 0;
        for (const d in counts) {
            if (counts[d] > maxCount) { maxCount = counts[d]; maxDir = d; }
        }

        const total = this._shotHistory.length;
        if (maxCount / total > 0.4) return maxDir;

        return 'center';
    }

    /**
     * Convert zone to dive action string
     */
    _zoneToDive(zone) {
        switch (zone) {
            case 'far_left':
            case 'left':     return 'dive_left';
            case 'far_right':
            case 'right':    return 'dive_right';
            default:         return 'dive_center';
        }
    }

    /**
     * Rebuild zone counts from shot history
     */
    _rebuildZoneCounts() {
        this._zoneCounts = { far_left: 0, left: 0, center: 0, right: 0, far_right: 0 };
        for (const d of this._shotHistory) {
            // Simplified — no power info in history strings
            const zone = d === 'left' ? 'left' : (d === 'right' ? 'right' : 'center');
            this._zoneCounts[zone]++;
        }
    }
}


// ============================================================================
// SECTION 5 — CLAUDE API INTEGRATION (Phase 4: Optional, Async, Fail-Safe)
// ============================================================================
// Provides optional server-side AI enhancement via Claude API.
// CRITICAL DESIGN CONSTRAINTS:
//   1. 100% OPTIONAL — game works perfectly without it (Phases 1-3 are the core)
//   2. ASYNC ONLY — never blocks the game loop; results arrive later
//   3. FAIL-SAFE — any error silently falls back to local AI
//   4. RATE-LIMITED — max 1 request per N seconds, with request queue
//   5. CACHE-FIRST — caches responses to minimize API calls
//   6. ZERO IMPACT on mobile perf — no sync waits, no heavy JSON parsing in hot path
//
// Architecture:
//   ClaudeAPI → RequestQueue (rate-limited) → fetch() → ResponseCache → callbacks
//   Game loop never waits. It asks "do you have advice?" and gets cached response or null.
//
// Usage:
//   const claude = new ClaudeAIAdvisor({ apiKey, endpoint, ... });
//   claude.requestAdvice('cricket_strategy', { runs: 45, wickets: 2, ... });
//   // Later, in game loop:
//   const advice = claude.getAdvice('cricket_strategy');
//   if (advice) { /* apply advice to weights */ }
// ============================================================================

class ClaudeAIAdvisor {
    /**
     * @param {object} config
     * @param {string} [config.apiKey] — Claude API key (if empty, advisor is disabled)
     * @param {string} [config.endpoint] — API endpoint URL
     * @param {string} [config.model='claude-haiku-4-5-20251001'] — model to use (haiku for speed/cost)
     * @param {number} [config.minIntervalMs=5000] — minimum ms between API calls
     * @param {number} [config.timeoutMs=3000] — max wait per request before abort
     * @param {number} [config.maxCacheSize=50] — max cached responses
     * @param {number} [config.maxQueueSize=5] — max pending requests
     * @param {boolean} [config.enabled=true] — master enable/disable switch
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
        this.model = config.model || 'claude-haiku-4-5-20251001';
        this.minIntervalMs = config.minIntervalMs || 5000;
        this.timeoutMs = config.timeoutMs || 3000;
        this.maxCacheSize = config.maxCacheSize || 50;
        this.maxQueueSize = config.maxQueueSize || 5;
        this.enabled = config.enabled !== false && !!this.apiKey;

        // Internal state
        this._cache = {};          // { topic: { response, timestamp, ttl } }
        this._cacheKeys = [];      // LRU order
        this._queue = [];          // pending requests
        this._inflight = false;    // is a request currently in-flight?
        this._lastRequestMs = 0;
        this._totalRequests = 0;
        this._totalErrors = 0;
        this._totalCacheHits = 0;
        this._consecutiveErrors = 0;
        this._circuitOpen = false; // circuit breaker: true = all requests blocked
        this._circuitOpenUntil = 0;

        // Prompt templates per topic
        this._prompts = {
            cricket_strategy: this._buildCricketStrategyPrompt,
            football_strategy: this._buildFootballStrategyPrompt,
            difficulty_advice: this._buildDifficultyAdvicePrompt,
            commentary: this._buildCommentaryPrompt,
        };
    }

    // =====================================================================
    // PUBLIC API — Non-blocking, cache-first
    // =====================================================================

    /**
     * Request advice from Claude API (async, non-blocking).
     * Queues a request; results will be available via getAdvice() later.
     *
     * @param {string} topic — 'cricket_strategy'|'football_strategy'|'difficulty_advice'|'commentary'
     * @param {object} context — game state data passed to prompt builder
     * @param {object} [options]
     * @param {number} [options.ttlMs=30000] — cache TTL for this response
     * @returns {boolean} — true if request was queued, false if skipped (cached/disabled/rate-limited)
     */
    requestAdvice(topic, context, options = {}) {
        // Gate checks (all non-blocking, order matters for perf)
        if (!this.enabled) return false;
        if (this._circuitOpen && Date.now() < this._circuitOpenUntil) return false;
        if (this._circuitOpen && Date.now() >= this._circuitOpenUntil) {
            // Half-open: allow one request to test recovery
            this._circuitOpen = false;
        }

        // Check cache freshness
        const cached = this._cache[topic];
        if (cached && Date.now() - cached.timestamp < (cached.ttl || 30000)) {
            this._totalCacheHits++;
            return false; // still fresh
        }

        // Rate limit
        if (Date.now() - this._lastRequestMs < this.minIntervalMs) return false;

        // Queue limit
        if (this._queue.length >= this.maxQueueSize) return false;

        // Don't duplicate same topic in queue
        if (this._queue.some(q => q.topic === topic)) return false;

        // Build prompt
        const promptBuilder = this._prompts[topic];
        if (!promptBuilder) return false;

        const prompt = promptBuilder.call(this, context);
        const ttl = options.ttlMs || 30000;

        this._queue.push({ topic, prompt, context, ttl, queuedAt: Date.now() });
        this._processQueue(); // kick off processing (async, non-blocking)

        return true;
    }

    /**
     * Get cached advice for a topic (instant, zero-cost).
     * Returns null if no advice available or cache expired.
     *
     * @param {string} topic
     * @returns {object|null} — parsed advice object, or null
     */
    getAdvice(topic) {
        const cached = this._cache[topic];
        if (!cached) return null;
        if (Date.now() - cached.timestamp > (cached.ttl || 30000)) {
            // Expired — clean up
            delete this._cache[topic];
            return null;
        }
        return cached.response;
    }

    /**
     * Check if advisor is operational (enabled + has API key + circuit closed)
     * @returns {boolean}
     */
    get isAvailable() {
        return this.enabled && !!this.apiKey && !this._circuitOpen;
    }

    /**
     * Get telemetry stats
     */
    get stats() {
        return {
            enabled: this.enabled,
            available: this.isAvailable,
            totalRequests: this._totalRequests,
            totalErrors: this._totalErrors,
            totalCacheHits: this._totalCacheHits,
            queueDepth: this._queue.length,
            inflight: this._inflight,
            circuitOpen: this._circuitOpen,
            cacheSize: this._cacheKeys.length,
            consecutiveErrors: this._consecutiveErrors,
        };
    }

    /**
     * Enable/disable the advisor at runtime
     * @param {boolean} on
     */
    setEnabled(on) {
        this.enabled = on && !!this.apiKey;
    }

    /**
     * Clear all cached responses
     */
    clearCache() {
        this._cache = {};
        this._cacheKeys = [];
    }

    // =====================================================================
    // INTERNAL — Async request processing
    // =====================================================================

    /** Process next item in queue (non-blocking) */
    async _processQueue() {
        if (this._inflight) return;       // one at a time
        if (this._queue.length === 0) return;

        const item = this._queue.shift();
        this._inflight = true;
        this._lastRequestMs = Date.now();
        this._totalRequests++;

        try {
            const response = await this._callAPI(item.prompt);
            const parsed = this._parseResponse(response, item.topic);

            if (parsed) {
                this._storeCache(item.topic, parsed, item.ttl);
                this._consecutiveErrors = 0; // reset on success
            }
        } catch (err) {
            this._totalErrors++;
            this._consecutiveErrors++;

            // Circuit breaker: after 3 consecutive errors, open circuit for 60s
            if (this._consecutiveErrors >= 3) {
                this._circuitOpen = true;
                this._circuitOpenUntil = Date.now() + 60000;
            }

            // Silent fail — log for debug only
            if (typeof console !== 'undefined') {
                console.warn('[ClaudeAI] Request failed:', err.message || err);
            }
        } finally {
            this._inflight = false;
            // Process next in queue (if any)
            if (this._queue.length > 0) {
                setTimeout(() => this._processQueue(), 100);
            }
        }
    }

    /**
     * Make actual API call with timeout
     * @param {string} prompt
     * @returns {Promise<object>} — raw API response
     */
    async _callAPI(prompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 256,
                    messages: [{
                        role: 'user',
                        content: prompt,
                    }],
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                throw new Error(`API ${res.status}: ${res.statusText}`);
            }

            return await res.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Parse API response into structured advice
     * @param {object} raw — API response
     * @param {string} topic
     * @returns {object|null}
     */
    _parseResponse(raw, topic) {
        try {
            // Extract text from Claude response
            const text = raw?.content?.[0]?.text;
            if (!text) return null;

            // Try to parse as JSON (prompts request JSON output)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                parsed._topic = topic;
                parsed._timestamp = Date.now();
                return parsed;
            }

            // Fallback: return raw text as advice
            return {
                _topic: topic,
                _timestamp: Date.now(),
                text: text.trim(),
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Store response in LRU cache
     */
    _storeCache(topic, response, ttl) {
        // Remove if already cached (for LRU reorder)
        const idx = this._cacheKeys.indexOf(topic);
        if (idx !== -1) this._cacheKeys.splice(idx, 1);

        // Evict oldest if at capacity
        while (this._cacheKeys.length >= this.maxCacheSize) {
            const oldest = this._cacheKeys.shift();
            delete this._cache[oldest];
        }

        this._cache[topic] = {
            response,
            timestamp: Date.now(),
            ttl,
        };
        this._cacheKeys.push(topic);
    }

    // =====================================================================
    // PROMPT BUILDERS — Game-specific, structured output
    // =====================================================================

    _buildCricketStrategyPrompt(ctx) {
        return `You are a cricket AI advisor for a mobile game. Respond ONLY with a JSON object.

Game state:
- Score: ${ctx.runs || 0}/${ctx.wickets || 0} in ${ctx.overs || 0} overs
- Target: ${ctx.target || 'N/A'}
- Overs remaining: ${ctx.oversLeft || '?'}
- Player tendency: ${ctx.playerTendency || 'unknown'}
- Player weakness: ${ctx.playerWeakness || 'none detected'}
- Current difficulty: ${ctx.difficulty || 'medium'}

Respond with this exact JSON format:
{
  "bowling_priority": "wicket_hunting|defensive|balanced|aggressive",
  "recommended_type": "fast|medium|spin|yorker|bouncer|slower",
  "recommended_length": "short|good|yorker",
  "aggression_mod": 0.8 to 1.3,
  "reasoning": "brief 10 word max explanation"
}`;
    }

    _buildFootballStrategyPrompt(ctx) {
        return `You are a football/soccer penalty AI advisor for a mobile game. Respond ONLY with a JSON object.

Game state:
- Score: Player ${ctx.playerScore || 0} - ${ctx.aiScore || 0} AI
- Round: ${ctx.round || 1}/${ctx.maxRounds || 10}
- Player shot pattern: ${ctx.recentDirs || 'unknown'}
- Player tends to switch after save: ${ctx.switchProb || '50%'}
- Detected pattern: ${ctx.pattern || 'none'}

Respond with this exact JSON format:
{
  "dive_bias": "left|center|right",
  "confidence": 0.0 to 1.0,
  "expect_switch": true/false,
  "keeper_aggression": 0.5 to 1.5,
  "reasoning": "brief 10 word max explanation"
}`;
    }

    _buildDifficultyAdvicePrompt(ctx) {
        return `You are a game balance advisor. Respond ONLY with a JSON object.

Player performance:
- Win rate (EMA): ${ctx.winRate || 0.5}
- Recent win rate: ${ctx.recentWinRate || 0.5}
- Current streak: ${ctx.streak || 0}
- Total events: ${ctx.events || 0}
- Current difficulty: ${ctx.difficulty || 1.0}
- Player frustration signals: ${ctx.frustrated || false}

Respond with this exact JSON format:
{
  "suggested_difficulty": 0.3 to 1.5,
  "speed_mod": 0.7 to 1.2,
  "accuracy_mod": 0.5 to 1.1,
  "should_ease": true/false,
  "reasoning": "brief 10 word max explanation"
}`;
    }

    _buildCommentaryPrompt(ctx) {
        return `You are a witty sports commentator for a mobile cricket/football game. Generate one short, fun line of commentary (max 60 characters) for this moment.

Event: ${ctx.event || 'unknown'}
Sport: ${ctx.sport || 'cricket'}
Details: ${ctx.details || ''}
Score: ${ctx.score || ''}

Respond with this exact JSON format:
{
  "line": "Your commentary line here",
  "emotion": "excited|tense|funny|dramatic|casual"
}`;
    }

    // =====================================================================
    // SERIALIZATION
    // =====================================================================

    toJSON() {
        return {
            totalRequests: this._totalRequests,
            totalErrors: this._totalErrors,
            totalCacheHits: this._totalCacheHits,
        };
    }

    fromJSON(data) {
        if (!data) return;
        this._totalRequests = data.totalRequests || 0;
        this._totalErrors = data.totalErrors || 0;
        this._totalCacheHits = data.totalCacheHits || 0;
    }
}


// ============================================================================
// SECTION 5.1 — CLAUDE ADVISOR INTEGRATION INTO AI ENGINE
// ============================================================================
// Hooks ClaudeAIAdvisor into CricketAI and FootballAI decision pipelines.
// Advice is ALWAYS optional — if getAdvice() returns null, decisions use
// Phases 1-3 only (zero degradation).
// ============================================================================

/**
 * Attach a ClaudeAIAdvisor to an AIEngine instance.
 * Monkey-patches CricketAI and FootballAI to check for API advice
 * and apply it as a weight modifier (not a replacement).
 *
 * @param {AIEngine} aiEngine
 * @param {ClaudeAIAdvisor} advisor
 */
function attachClaudeAdvisor(aiEngine, advisor) {
    aiEngine.claudeAdvisor = advisor;

    // --- Cricket: Request strategy advice after each over ---
    const origCricketRecord = aiEngine.cricket.recordBattingEvent;
    if (origCricketRecord) {
        aiEngine.cricket.recordBattingEvent = function(delivery, result) {
            origCricketRecord.call(this, delivery, result);

            // Request updated strategy every ~6 balls (1 over)
            if (aiEngine.cricketBayes.totalObservations % 6 === 0) {
                const weakness = aiEngine.playerModel.weakness();
                const diffSummary = aiEngine.difficulty_adaptive.summary;
                advisor.requestAdvice('cricket_strategy', {
                    runs: result._simRuns,
                    wickets: result._simWickets,
                    overs: result._simOvers,
                    target: result._target,
                    oversLeft: result._oversLeft,
                    playerTendency: aiEngine.playerModel.aggressionScore > 0.6 ? 'aggressive' : 'defensive',
                    playerWeakness: weakness ? weakness.type : 'none',
                    difficulty: diffSummary.label,
                });
            }
        };
    }

    // --- Cricket: Apply bowling advice in selectDelivery ---
    const origSelectDelivery = aiEngine.cricket.selectDelivery;
    aiEngine.cricket.selectDelivery = function(state) {
        const result = origSelectDelivery.call(this, state);

        // Check for Claude advice
        const advice = advisor.getAdvice('cricket_strategy');
        if (advice && advice.recommended_type && advice.aggression_mod) {
            // Soft influence: if Claude recommends a different type,
            // give it a small boost (not a hard override)
            if (advice.recommended_type !== result.type) {
                // Log the override suggestion (game can display this)
                result._claudeAdvice = advice;
            }
            // Apply aggression modifier to the strategy tag
            result._aggressionMod = advice.aggression_mod;
        }

        return result;
    };

    // --- Football: Request strategy advice every 3 rounds ---
    const origFBRecord = aiEngine.football.recordResult;
    aiEngine.football.recordResult = function(resultStr) {
        origFBRecord.call(this, resultStr);

        const fbLog = this._shotHistory;
        if (fbLog.length > 0 && fbLog.length % 3 === 0) {
            const pattern = aiEngine.fbSeq.detectPattern(2, 2);
            const switchP = aiEngine.playerModel.switchAfterSaveProbability();
            advisor.requestAdvice('football_strategy', {
                playerScore: 0, // caller should provide
                aiScore: 0,
                round: fbLog.length,
                maxRounds: 10,
                recentDirs: fbLog.slice(-5).join(','),
                switchProb: (switchP * 100).toFixed(0) + '%',
                pattern: pattern.pattern ? pattern.pattern.join('→') : 'none',
            });
        }
    };

    // --- Football: Apply keeper advice in decideKeeper ---
    const origDecideKeeper = aiEngine.football.decideKeeper;
    aiEngine.football.decideKeeper = function(input) {
        const result = origDecideKeeper.call(this, input);

        // Check for Claude advice
        const advice = advisor.getAdvice('football_strategy');
        if (advice) {
            result._claudeAdvice = advice;
            // If Claude has a dive bias with high confidence, note it
            // (game can use this to influence keeper lean animation)
            if (advice.dive_bias && advice.confidence > 0.6) {
                result._claudeSuggestedDive = advice.dive_bias;
            }
        }

        return result;
    };

    // --- Difficulty: Request advice when streak is notable ---
    const origDiffRecord = aiEngine.difficulty_adaptive.recordResult;
    aiEngine.difficulty_adaptive.recordResult = function(playerWon) {
        origDiffRecord.call(this, playerWon);

        if (Math.abs(this.currentStreak) >= 3 && this._totalEvents % 5 === 0) {
            advisor.requestAdvice('difficulty_advice', {
                winRate: this.winRateEMA.toFixed(2),
                recentWinRate: this.recentWinRate.toFixed(2),
                streak: this.currentStreak,
                events: this._totalEvents,
                difficulty: this.currentDifficulty.toFixed(2),
                frustrated: this.currentStreak <= -4,
            });
        }
    };

    // --- Commentary: Expose a requestCommentary helper ---
    aiEngine.requestCommentary = function(event, sport, details, score) {
        advisor.requestAdvice('commentary', { event, sport, details, score }, { ttlMs: 10000 });
    };

    aiEngine.getCommentary = function() {
        return advisor.getAdvice('commentary');
    };
}


// ============================================================================
// SECTION 6 — GAME LOOP INTEGRATION HOOK
// ============================================================================

/**
 * Attach AIEngine to a GameEngine instance.
 * Hooks into the game loop's update cycle with budget-guarded ticks.
 *
 * @param {GameEngine} engine
 * @param {AIEngine} ai
 */
function attachAI(engine, ai) {
    // Store reference on engine
    engine.ai = ai;

    // Hook into update (variable-rate, after physics)
    const _origUpdate = engine._update ? engine._update.bind(engine) : null;
    engine._update = function(dt) {
        if (_origUpdate) _origUpdate(dt);
        ai.tick(dt);
    };
}


// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AIUtil,
        PlayerModel,
        BayesPredictor,
        SequencePredictor,
        AdaptiveDifficulty,
        ClaudeAIAdvisor,
        AIEngine,
        CricketAI,
        FootballAI,
        attachAI,
        attachClaudeAdvisor,
        // Expose tables for testing/tuning
        BAT_EFFECTIVENESS,
        LINE_MODIFIERS,
        BOWL_STRATEGIES,
        KEEPER_ZONE_SAVE_PROB,
    };
}

/**
 * BayesPredictor.js
 * Bayesian probability engine for action prediction.
 * Computes P(action | evidence) given observed behavior patterns.
 *
 * Uses:
 * - Prior: P(action) from frequency tables
 * - Likelihood: P(evidence | action) from conditional observations
 * - Posterior: P(action | evidence) ∝ P(evidence | action) × P(action)
 *
 * Lightweight (no matrix ops), mobile-safe, and interpretable.
 *
 * @module ai/BayesPredictor
 */

'use strict';

/**
 * BayesPredictor calculates posterior probabilities for actions given evidence.
 * Useful for: next shot prediction, defense positioning, AI decision-making.
 *
 * @class BayesPredictor
 */
class BayesPredictor {
    /**
     * @param {number} [smoothing=1] - Laplace smoothing to avoid zero probabilities
     */
    constructor(smoothing = 1) {
        this.smoothing = smoothing;

        // Conditional count tables
        // Key: evidenceKey -> { action: count }
        this._conditionals = {};
        // Marginal action counts (prior)
        this._actionCounts = {};
        this._totalObs = 0;
    }

    /**
     * Record an observation: given evidence, player chose action.
     *
     * @param {string} evidenceKey - Context (e.g. "bouncer|short|right")
     * @param {string} action - Action taken (e.g. "PULL")
     */
    observe(evidenceKey, action) {
        if (!this._conditionals[evidenceKey]) this._conditionals[evidenceKey] = {};
        this._conditionals[evidenceKey][action] = (this._conditionals[evidenceKey][action] || 0) + 1;
        this._actionCounts[action] = (this._actionCounts[action] || 0) + 1;
        this._totalObs++;
    }

    /**
     * Predict posterior probability distribution over actions given evidence.
     *
     * @param {string} evidenceKey - Evidence/context
     * @param {object} [priors] - Optional prior weights { action: weight }
     * @returns {{ predictions: Array<{action: string, probability: number}>, topAction: string, topProb: number, confidence: number }}
     */
    predict(evidenceKey, priors = null) {
        const cond = this._conditionals[evidenceKey];
        const allActions = Object.keys(this._actionCounts);

        if (allActions.length === 0) {
            return { predictions: [], topAction: null, topProb: 0, confidence: 0 };
        }

        // Compute unnormalized posteriors: P(action | evidence) ∝ P(evidence | action) × P(action)
        const posteriors = {};
        let totalPosterior = 0;
        const k = this.smoothing;
        const nActions = allActions.length;

        for (const action of allActions) {
            // Prior: P(action) = (count + k) / (total + k*n)
            const prior = priors && priors[action] !== undefined
                ? priors[action]
                : (this._actionCounts[action] + k) / (this._totalObs + k * nActions);

            // Likelihood: P(evidence | action) ≈ conditional count / total conditional
            const condCount = cond ? (cond[action] || 0) : 0;
            const condTotal = cond ? Object.values(cond).reduce((s, v) => s + v, 0) : 0;
            const likelihood = (condCount + k) / (condTotal + k * nActions);

            posteriors[action] = prior * likelihood;
            totalPosterior += posteriors[action];
        }

        // Normalize to get probabilities
        const predictions = [];
        let topAction = null, topProb = 0;

        for (const action of allActions) {
            const prob = totalPosterior > 0 ? posteriors[action] / totalPosterior : 1 / nActions;
            predictions.push({ action, probability: prob });
            if (prob > topProb) { topProb = prob; topAction = action; }
        }

        // Sort descending by probability
        predictions.sort((a, b) => b.probability - a.probability);

        // Confidence: entropy-based (low entropy = high confidence)
        let entropy = 0;
        for (const p of predictions) {
            if (p.probability > 0) entropy -= p.probability * Math.log2(p.probability);
        }
        const maxEntropy = Math.log2(nActions);
        const confidence = nActions <= 1 ? 1.0 : (maxEntropy > 0 ? Math.max(0, Math.min(1, 1 - entropy / maxEntropy)) : 0);

        return { predictions, topAction, topProb, confidence };
    }

    /**
     * Get number of observations for a given evidence key.
     *
     * @param {string} evidenceKey
     * @returns {number}
     */
    observationCount(evidenceKey) {
        const cond = this._conditionals[evidenceKey];
        if (!cond) return 0;
        let total = 0;
        for (const k in cond) total += cond[k];
        return total;
    }

    /**
     * Get total number of observations.
     * @returns {number}
     */
    get totalObservations() {
        return this._totalObs;
    }

    /**
     * Apply exponential decay to all counters (recency bias).
     *
     * @param {number} factor - 0-1 multiplier (e.g., 0.95)
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

    /**
     * Clear all data.
     */
    reset() {
        this._conditionals = {};
        this._actionCounts = {};
        this._totalObs = 0;
    }

    /**
     * Export to JSON.
     * @returns {object}
     */
    toJSON() {
        return {
            conditionals: this._conditionals,
            actions: this._actionCounts,
            total: this._totalObs
        };
    }

    /**
     * Import from JSON.
     * @param {object} data
     */
    fromJSON(data) {
        if (!data) return;
        this._conditionals = data.conditionals || {};
        this._actionCounts = data.actions || {};
        this._totalObs = data.total || 0;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BayesPredictor };
}

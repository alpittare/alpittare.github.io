/**
 * AIEngine.js
 * 4-Phase AI system orchestrator.
 * Combines rule-based decisions, player modeling, Bayesian prediction, and adaptive difficulty.
 *
 * Phase 1: Weighted decision tables (rule-based)
 * Phase 2: PlayerModel learning (frequency analysis)
 * Phase 3: BayesPredictor + AdaptiveDifficulty (probability-based)
 * Phase 4: Claude API integration (async, fail-safe, cached)
 *
 * Budget-aware: max 2ms per frame for AI ticks
 * Lazy initialization: sport-specific modules loaded on demand
 * Error resilience: circuit-breaker for Phase 4
 *
 * @module ai/AIEngine
 */

'use strict';

/**
 * AIEngine orchestrates 4-phase AI decision-making.
 * Manages multiple predictors and adapts to player behavior.
 *
 * @class AIEngine
 */
class AIEngine {
    /**
     * @param {object} [config]
     * @param {number} [config.budget=2] - Max milliseconds per frame
     * @param {string} [config.sport='cricket'] - Sport type for specialized AI
     * @param {boolean} [config.enablePhase4=false] - Enable Claude API phase
     */
    constructor(config = {}) {
        this.budget = config.budget || 2;
        this.sport = config.sport || 'cricket';
        this.enablePhase4 = config.enablePhase4 || false;

        // Phase 1: Rule-based lookup tables
        this.decisionTables = {};

        // Phase 2: Player modeling
        const PlayerModel = this._getModule('PlayerModel');
        this.playerModel = new PlayerModel();

        // Phase 3: Probabilistic prediction
        const BayesPredictor = this._getModule('BayesPredictor');
        const AdaptiveDifficulty = this._getModule('AdaptiveDifficulty');
        this.bayes = new BayesPredictor();
        this.difficulty = new AdaptiveDifficulty();

        // Phase 4: Claude API (optional, with circuit-breaker)
        this.claudeAdvisor = null;
        if (this.enablePhase4) {
            // Lazy load on first use
            this._claudeReady = false;
            this._claudeErrors = 0;
            this._claudeLastError = 0;
            this._claudeCircuitBreakerThreshold = 3;
            this._claudeCircuitBreakerRecovery = 60000; // 60s
            this._claudeCache = new Map();
            this._claudeCacheMaxSize = 50;
            this._claudeCacheTTL = 30000; // 30s
        }

        // Performance tracking
        this._budgetUsed = 0;
        this._tickCount = 0;
    }

    /**
     * Register a decision table for Phase 1.
     *
     * @param {string} contextKey - Context identifier (e.g., 'batting|bouncer')
     * @param {object} weights - { action: weight }
     */
    registerDecisionTable(contextKey, weights) {
        this.decisionTables[contextKey] = weights;
    }

    /**
     * Make an AI decision (4-phase pipeline).
     *
     * @param {object} context - Decision context
     * @param {string} [context.phase='normal'] - Game phase
     * @param {string} [context.sport] - Sport type override
     * @returns {Promise<{action: string, confidence: number, source: string}>}
     */
    async makeDecision(context = {}) {
        const startTime = performance.now();

        try {
            // Phase 1: Rule-based lookup
            const decision1 = this._phase1(context);
            if (decision1 && decision1.action) {
                return { ...decision1, source: 'rule_table' };
            }

            // Phase 2: Player model informed
            const decision2 = this._phase2(context);
            if (decision2 && decision2.action) {
                return { ...decision2, source: 'player_model' };
            }

            // Phase 3: Bayesian prediction + difficulty scaling
            const decision3 = this._phase3(context);
            if (decision3 && decision3.action) {
                return { ...decision3, source: 'bayes_predictor' };
            }

            // Phase 4: Claude API (optional, async)
            if (this.enablePhase4 && this._isClaudeAvailable()) {
                const decision4 = await this._phase4(context);
                if (decision4 && decision4.action) {
                    return { ...decision4, source: 'claude_api' };
                }
            }

            // Fallback to safe default
            return { action: 'defend', confidence: 0.3, source: 'fallback' };
        } catch (e) {
            console.error('AIEngine error:', e);
            return { action: 'defend', confidence: 0.2, source: 'error' };
        } finally {
            this._budgetUsed = performance.now() - startTime;
            this._tickCount++;
        }
    }

    /**
     * Phase 1: Weighted random decision from rule tables.
     * @private
     */
    _phase1(context) {
        const key = this._makeContextKey(context);
        const weights = this.decisionTables[key];
        if (!weights || Object.keys(weights).length === 0) return null;

        const action = this._weightedPick(weights);
        return { action, confidence: 0.6 };
    }

    /**
     * Phase 2: Use PlayerModel insights to inform decision.
     * @private
     */
    _phase2(context) {
        // Example: Check player weakness and exploit it
        const weakness = this.playerModel.weakness();
        if (weakness && weakness.missRate > 0.4) {
            return { action: 'exploit_weakness', confidence: weakness.missRate };
        }

        // Check aggression and counter it
        if (this.playerModel.aggressionScore > 0.7) {
            return { action: 'defensive', confidence: 0.5 };
        }

        return null;
    }

    /**
     * Phase 3: Bayesian prediction + Adaptive difficulty.
     * @private
     */
    _phase3(context) {
        const key = this._makeContextKey(context);
        const prediction = this.bayes.predict(key);

        if (prediction.topAction) {
            // Scale confidence by adaptive difficulty
            let confidence = prediction.confidence;
            if (this.difficulty.currentDifficulty > 1.1) {
                confidence *= 0.9; // Reduce accuracy at higher difficulty
            }
            return { action: prediction.topAction, confidence };
        }

        return null;
    }

    /**
     * Phase 4: Claude API consultation (optional, async, with caching and circuit-breaker).
     * @private
     */
    async _phase4(context) {
        if (!this.enablePhase4) return null;

        // Check circuit breaker
        if (this._claudeErrors >= this._claudeCircuitBreakerThreshold) {
            const timeSinceError = Date.now() - this._claudeLastError;
            if (timeSinceError < this._claudeCircuitBreakerRecovery) {
                return null; // Circuit breaker open
            } else {
                this._claudeErrors = 0; // Reset after recovery time
            }
        }

        // Check cache
        const cacheKey = JSON.stringify(context);
        if (this._claudeCache.has(cacheKey)) {
            const cached = this._claudeCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this._claudeCacheTTL) {
                return cached.decision;
            }
        }

        try {
            // Call Claude API (mock implementation)
            const decision = await this._callClaudeAPI(context);

            // Cache result
            if (this._claudeCache.size >= this._claudeCacheMaxSize) {
                // Evict oldest entry
                this._claudeCache.delete(this._claudeCache.keys().next().value);
            }
            this._claudeCache.set(cacheKey, {
                decision,
                timestamp: Date.now()
            });

            return decision;
        } catch (e) {
            this._claudeErrors++;
            this._claudeLastError = Date.now();
            console.error('Claude API error:', e);
            return null;
        }
    }

    /**
     * Mock Claude API call (replace with actual API in production).
     * @private
     */
    async _callClaudeAPI(context) {
        // In production: POST to your Claude API endpoint
        // Example response:
        return {
            action: 'strategic_decision',
            confidence: 0.75,
            reasoning: 'Based on game state analysis'
        };
    }

    /**
     * Check if Claude API is available.
     * @private
     */
    _isClaudeAvailable() {
        return this.enablePhase4 &&
            window.fetch &&
            this._budgetUsed < this.budget;
    }

    /**
     * Weighted random selection from object.
     * @private
     */
    _weightedPick(weights) {
        let total = 0;
        for (const k in weights) total += weights[k];

        let r = Math.random() * total;
        for (const k in weights) {
            r -= weights[k];
            if (r <= 0) return k;
        }
        return Object.keys(weights)[0];
    }

    /**
     * Create context key for lookups.
     * @private
     */
    _makeContextKey(context) {
        const parts = [];
        if (context.ballType) parts.push(context.ballType);
        if (context.line) parts.push(context.line);
        if (context.length) parts.push(context.length);
        if (context.phase) parts.push(context.phase);
        return parts.join('|') || 'default';
    }

    /**
     * Lazy-load module (stub for ES6 imports).
     * In production, use proper module loading.
     * @private
     */
    _getModule(name) {
        // In a real implementation, this would load from the framework
        // For now, return the global class if available
        if (typeof window !== 'undefined' && window[name]) {
            return window[name];
        }
        throw new Error(`Module ${name} not loaded`);
    }

    /**
     * Get AI debug stats.
     * @returns {object}
     */
    getStats() {
        return {
            budget: this.budget,
            budgetUsed: this._budgetUsed.toFixed(2) + 'ms',
            difficulty: this.difficulty.getStats(),
            playerModel: this.playerModel.summary,
            bayesObservations: this.bayes.totalObservations,
            tickCount: this._tickCount
        };
    }

    /**
     * Reset AI state.
     */
    reset() {
        this.playerModel.reset();
        this.bayes.reset();
        this.difficulty.reset();
        this._budgetUsed = 0;
        this._tickCount = 0;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIEngine };
}

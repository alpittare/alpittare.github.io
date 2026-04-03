/**
 * StateManager.js
 * Advanced state machine for game screens and states.
 * Provides screen state management with lifecycle hooks and transitions.
 *
 * Features:
 * - Named states: menu, game, levels, shop, gameover, campaign_result, achievements, stats, leaderboard, settings, multiplayer
 * - State transitions with optional animation
 * - State history for back navigation
 * - Input delegation per state
 * - Lifecycle hooks: enter, update, fixedUpdate, render, exit, handleInput
 *
 * @module core/StateManager
 */

'use strict';

/**
 * StateManager orchestrates screen-level state machines.
 * Each state represents a full screen or game phase.
 *
 * @class StateManager
 */
class StateManager {
    /**
     * @param {GameEngine} engine - Reference to the GameEngine instance
     */
    constructor(engine) {
        this.engine = engine;
        this._states = {};
        this._history = [];
        this._maxHistory = 20;
        this._transitions = {};
        this._currentState = null;
        this._enterCallback = null;
        this._exitCallback = null;
    }

    /**
     * Register a state with its lifecycle handlers.
     * A state object should implement any of: enter(), update(dt), fixedUpdate(dt), render(ctx, alpha), exit(), handleInput(event)
     *
     * @param {string} name - State name (e.g., 'menu', 'game', 'gameover')
     * @param {object} state - State handler object
     */
    register(name, state) {
        this._states[name] = {
            name,
            enter: state.enter || (() => {}),
            update: state.update || (() => {}),
            fixedUpdate: state.fixedUpdate || (() => {}),
            render: state.render || (() => {}),
            exit: state.exit || (() => {}),
            handleInput: state.handleInput || (() => {})
        };
    }

    /**
     * Define a transition animation between states.
     *
     * @param {string} fromState - Source state name
     * @param {string} toState - Destination state name
     * @param {object} config - Transition configuration
     * @param {number} [config.duration=0.3] - Fade duration in seconds
     * @param {string} [config.type='fade'] - Transition type: 'fade', 'slide', 'none'
     */
    defineTransition(fromState, toState, config = {}) {
        const key = `${fromState}->${toState}`;
        this._transitions[key] = {
            duration: config.duration || 0.3,
            type: config.type || 'fade'
        };
    }

    /**
     * Switch to a new state.
     * Calls exit() on current state, then enter() on new state.
     * Manages state history for back navigation.
     *
     * @param {string} name - Target state name
     * @param {object} [data] - Optional data to pass to enter()
     */
    switchTo(name, data = null) {
        const state = this._states[name];
        if (!state) {
            console.warn(`State '${name}' not registered`);
            return;
        }

        // Call exit on current state
        if (this._currentState) {
            try {
                this._states[this._currentState].exit();
            } catch (e) {
                console.error(`Error exiting state '${this._currentState}':`, e);
            }

            // Save to history
            this._history.push(this._currentState);
            if (this._history.length > this._maxHistory) {
                this._history.shift();
            }
        }

        // Switch
        this._currentState = name;

        // Call enter on new state
        try {
            state.enter(data);
        } catch (e) {
            console.error(`Error entering state '${name}':`, e);
        }

        if (this._enterCallback) this._enterCallback(name);
    }

    /**
     * Go back to the previous state (from history).
     */
    goBack() {
        if (this._history.length > 0) {
            const prev = this._history.pop();
            if (prev) this.switchTo(prev);
        }
    }

    /**
     * Get the current state name.
     *
     * @returns {string|null} Current state name or null
     */
    getCurrentState() {
        return this._currentState;
    }

    /**
     * Check if we're in a specific state.
     *
     * @param {string} name - State name to check
     * @returns {boolean}
     */
    isState(name) {
        return this._currentState === name;
    }

    /**
     * Forward input events to the current state.
     *
     * @param {Event} event - Input event
     */
    handleInput(event) {
        if (this._currentState) {
            try {
                this._states[this._currentState].handleInput(event);
            } catch (e) {
                console.error(`Error in handleInput for '${this._currentState}':`, e);
            }
        }
    }

    /**
     * Call fixed update on current state.
     * @param {number} dt - Delta time in seconds
     * @private
     */
    fixedUpdate(dt) {
        if (this._currentState) {
            try {
                this._states[this._currentState].fixedUpdate(dt);
            } catch (e) {
                console.error(`Error in fixedUpdate for '${this._currentState}':`, e);
            }
        }
    }

    /**
     * Call update on current state.
     * @param {number} dt - Delta time in seconds
     * @private
     */
    update(dt) {
        if (this._currentState) {
            try {
                this._states[this._currentState].update(dt);
            } catch (e) {
                console.error(`Error in update for '${this._currentState}':`, e);
            }
        }
    }

    /**
     * Call render on current state.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} alpha - Interpolation alpha
     * @private
     */
    render(ctx, alpha) {
        if (this._currentState) {
            try {
                this._states[this._currentState].render(ctx, alpha);
            } catch (e) {
                console.error(`Error in render for '${this._currentState}':`, e);
            }
        }
    }

    /**
     * Set callback when entering a state.
     * @param {Function} fn - Callback function(stateName)
     */
    onEnter(fn) {
        this._enterCallback = fn;
    }

    /**
     * Get list of all registered state names.
     * @returns {string[]}
     */
    listStates() {
        return Object.keys(this._states);
    }

    /**
     * Clear history (useful after major screen changes).
     */
    clearHistory() {
        this._history.length = 0;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StateManager };
}

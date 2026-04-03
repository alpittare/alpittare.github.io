/**
 * GameEngine.js
 * Core game loop engine with fixed-timestep physics and variable-rate rendering.
 * Manages entities, states, and events in a production-ready game framework.
 *
 * Features:
 * - 60Hz fixed-step physics with variable render rate
 * - DPI-aware canvas setup (414x896 default mobile format)
 * - Entity registry with tag-based lookups
 * - State machine with enter/update/exit lifecycle
 * - Event system for decoupled communication
 * - FPS monitoring and performance tracking
 * - Responsive scaling with coordinate transforms
 *
 * @module core/GameEngine
 */

'use strict';

/**
 * Main game engine class.
 * Orchestrates the game loop, entity management, state transitions, and rendering.
 *
 * @class GameEngine
 */
class GameEngine {
    /**
     * @param {string} canvasId - DOM element ID of the canvas
     * @param {number} [width=414] - Viewport width in pixels
     * @param {number} [height=896] - Viewport height in pixels
     */
    constructor(canvasId, width = 414, height = 896) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) throw new Error(`Canvas #${canvasId} not found`);

        this.ctx = this.canvas.getContext('2d');
        this.WIDTH = width;
        this.HEIGHT = height;

        // DPI scaling for sharp rendering on high-DPI displays
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);

        // Responsive viewport
        this._screenScale = 1;
        this._fitToScreen();
        window.addEventListener('resize', () => this._fitToScreen());

        // Timing: 60Hz fixed-step physics, variable render
        this._lastTime = 0;
        this._accumulator = 0;
        this._fixedStep = 1 / 60; // 60Hz physics tick
        this._running = false;
        this._rafId = null;

        // Performance monitoring
        this.fps = 0;
        this._frameCount = 0;
        this._fpsTimer = 0;

        // Entity management with pending queues for safety
        this.entities = [];
        this._pendingAdd = [];
        this._pendingRemove = new Set();

        // State machine
        this.state = null;
        this.states = {};
        this._stateHistory = [];

        // Event system (per-instance to avoid global pollution)
        this._listeners = {};

        // Debug mode
        this.debug = false;
    }

    /**
     * Fit canvas to screen while maintaining aspect ratio.
     * Scales the rendered canvas while keeping game coordinates fixed.
     * @private
     */
    _fitToScreen() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.min(vw / this.WIDTH, vh / this.HEIGHT);
        this.canvas.style.width = Math.floor(this.WIDTH * scale) + 'px';
        this.canvas.style.height = Math.floor(this.HEIGHT * scale) + 'px';
        this._screenScale = scale;
    }

    /**
     * Convert screen/client coordinates to game world coordinates.
     * Accounts for DPI scaling, viewport transformation, and canvas positioning.
     *
     * @param {number} clientX - Client X coordinate
     * @param {number} clientY - Client Y coordinate
     * @returns {{x: number, y: number}} Game world coordinates
     */
    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (this.WIDTH / rect.width),
            y: (clientY - rect.top) * (this.HEIGHT / rect.height)
        };
    }

    /**
     * Start the game loop.
     * Initializes timing and begins requestAnimationFrame cycle.
     */
    start() {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        this._tick(this._lastTime);
    }

    /**
     * Stop the game loop.
     * Cancels requestAnimationFrame and stops all updates/renders.
     */
    stop() {
        this._running = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }

    /**
     * Main game loop tick (called via requestAnimationFrame).
     * Handles timing, fixed-step updates, variable-rate rendering, and entity management.
     * @private
     */
    _tick(now) {
        if (!this._running) return;
        this._rafId = requestAnimationFrame((t) => this._tick(t));

        // Calculate delta time, clamped to prevent spiral of death
        const dt = Math.min((now - this._lastTime) / 1000, 0.1);
        this._lastTime = now;

        // FPS counter (updates once per second)
        this._frameCount++;
        this._fpsTimer += dt;
        if (this._fpsTimer >= 1) {
            this.fps = this._frameCount;
            this._frameCount = 0;
            this._fpsTimer -= 1;
        }

        // Fixed-step update (60 Hz physics) — can tick multiple times per frame
        this._accumulator += dt;
        while (this._accumulator >= this._fixedStep) {
            this._fixedUpdate(this._fixedStep);
            this._accumulator -= this._fixedStep;
        }

        // Variable-rate update (input, animations, effects)
        this._update(dt);

        // Render with interpolation alpha for smooth visuals
        const alpha = this._accumulator / this._fixedStep;
        this._render(alpha);

        // Process pending entity additions/removals (batched for safety)
        this._flushEntities();
    }

    /**
     * Fixed-step update phase (physics, collision).
     * Called at consistent 60Hz regardless of frame rate.
     * @private
     */
    _fixedUpdate(dt) {
        // State fixed update
        if (this.state && this.states[this.state]?.fixedUpdate) {
            this.states[this.state].fixedUpdate(dt);
        }

        // Entity fixed updates
        for (const entity of this.entities) {
            if (entity.active && entity.fixedUpdate) {
                entity.fixedUpdate(dt);
            }
        }
    }

    /**
     * Variable-rate update phase (animations, input, effects).
     * Called once per rendered frame.
     * @private
     */
    _update(dt) {
        // State update
        if (this.state && this.states[this.state]?.update) {
            this.states[this.state].update(dt);
        }

        // Entity updates
        for (const entity of this.entities) {
            if (entity.active && entity.update) {
                entity.update(dt);
            }
        }
    }

    /**
     * Render phase with interpolation.
     * Draws all visible entities sorted by z-index.
     * @private
     */
    _render(alpha) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

        // State-specific background
        if (this.state && this.states[this.state]?.render) {
            this.states[this.state].render(ctx, alpha);
        }

        // Sort entities by z-index and render
        const sorted = this.entities
            .filter(e => e.active && e.visible)
            .sort((a, b) => (a.z || 0) - (b.z || 0));

        for (const entity of sorted) {
            if (entity.render) {
                ctx.save();
                entity.render(ctx, alpha);
                ctx.restore();
            }
        }

        // Debug overlay
        if (this.debug) this._renderDebug(ctx);

        ctx.restore();
    }

    /**
     * Render debug info (FPS, entity count, current state).
     * @private
     */
    _renderDebug(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(4, 4, 140, 70);
        ctx.fillStyle = '#0f0';
        ctx.font = '11px monospace';
        ctx.fillText(`FPS: ${this.fps}`, 10, 18);
        ctx.fillText(`Entities: ${this.entities.length}`, 10, 32);
        ctx.fillText(`State: ${this.state || 'none'}`, 10, 46);
        ctx.fillText(`Scale: ${this._screenScale.toFixed(2)}x`, 10, 60);
    }

    /**
     * Add an entity to the world.
     * Entity is queued for addition at end of frame for safety.
     *
     * @param {Entity} entity - Entity to add
     * @returns {Entity} The entity (for chaining)
     */
    addEntity(entity) {
        entity.engine = this;
        this._pendingAdd.push(entity);
        return entity;
    }

    /**
     * Remove an entity from the world.
     * Entity is queued for removal at end of frame.
     *
     * @param {Entity} entity - Entity to remove
     */
    removeEntity(entity) {
        this._pendingRemove.add(entity);
    }

    /**
     * Process pending entity additions and removals.
     * Called at end of each frame.
     * @private
     */
    _flushEntities() {
        if (this._pendingAdd.length) {
            this.entities.push(...this._pendingAdd);
            this._pendingAdd.length = 0;
        }
        if (this._pendingRemove.size) {
            this.entities = this.entities.filter(e => !this._pendingRemove.has(e));
            this._pendingRemove.clear();
        }
    }

    /**
     * Find all entities with a specific tag.
     *
     * @param {string} tag - Tag to search for
     * @returns {Entity[]} Matching entities
     */
    findByTag(tag) {
        return this.entities.filter(e => e.tag === tag);
    }

    /**
     * Find the first entity with a specific tag.
     *
     * @param {string} tag - Tag to search for
     * @returns {Entity|null} First matching entity or null
     */
    findOne(tag) {
        return this.entities.find(e => e.tag === tag);
    }

    /**
     * Register a state handler object.
     * State object should have: enter(), update(dt), fixedUpdate(dt), render(ctx, alpha), exit()
     *
     * @param {string} name - State name identifier
     * @param {object} handlers - State handler object with lifecycle methods
     */
    registerState(name, handlers) {
        this.states[name] = handlers;
    }

    /**
     * Switch to a new state with lifecycle callbacks.
     * Calls exit() on old state, then enter() on new state.
     *
     * @param {string} name - State name to switch to
     */
    switchState(name) {
        if (this.state && this.states[this.state]?.exit) {
            this.states[this.state].exit();
        }

        // Store history for back navigation
        if (this.state !== name) {
            this._stateHistory.push(this.state);
            if (this._stateHistory.length > 20) this._stateHistory.shift();
        }

        this.state = name;
        if (this.states[name]?.enter) {
            this.states[name].enter();
        }
    }

    /**
     * Go back to previous state (if available).
     */
    goBack() {
        if (this._stateHistory.length > 0) {
            const prev = this._stateHistory.pop();
            if (prev) this.switchState(prev);
        }
    }

    /**
     * Register an event listener.
     *
     * @param {string} event - Event name
     * @param {Function} fn - Callback function
     */
    on(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    }

    /**
     * Remove an event listener.
     *
     * @param {string} event - Event name
     * @param {Function} fn - Callback to remove
     */
    off(event, fn) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }

    /**
     * Emit an event to all registered listeners.
     *
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (!this._listeners[event]) return;
        for (const fn of this._listeners[event]) {
            try {
                fn(data);
            } catch (e) {
                console.error(`Error in event listener for '${event}':`, e);
            }
        }
    }
}

/**
 * Base entity class.
 * All game objects inherit from this and get positioned, velocity, rendering support.
 *
 * @class Entity
 */
class Entity {
    /**
     * @param {number} [x=0] - Initial X position
     * @param {number} [y=0] - Initial Y position
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.vx = 0; // velocity X
        this.vy = 0; // velocity Y
        this.width = 0;
        this.height = 0;
        this.z = 0; // render order (higher = on top)
        this.active = true; // update when true
        this.visible = true; // render when true
        this.tag = null; // for finding entities
        this.engine = null; // set by addEntity()
    }

    /**
     * Fixed-step update (called at 60Hz).
     * Override for physics-based movement.
     * @param {number} dt - Delta time in seconds (1/60)
     */
    fixedUpdate(dt) {
        this.prevX = this.x;
        this.prevY = this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    /**
     * Variable-rate update (called once per frame).
     * Override for animations, input handling, etc.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {}

    /**
     * Render this entity.
     * Override to draw custom geometry.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} alpha - Interpolation alpha (0-1) for smooth movement
     */
    render(ctx, alpha) {}

    /**
     * Get interpolated X position for smooth rendering.
     * @param {number} alpha - Interpolation factor from physics step
     * @returns {number} Interpolated X coordinate
     */
    lerpX(alpha) {
        return this.prevX + (this.x - this.prevX) * alpha;
    }

    /**
     * Get interpolated Y position for smooth rendering.
     * @param {number} alpha - Interpolation factor from physics step
     * @returns {number} Interpolated Y coordinate
     */
    lerpY(alpha) {
        return this.prevY + (this.y - this.prevY) * alpha;
    }

    /**
     * Get AABB bounds.
     * @returns {{x: number, y: number, w: number, h: number}} Bounding box
     */
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            w: this.width,
            h: this.height
        };
    }

    /**
     * Remove this entity from the world.
     */
    destroy() {
        if (this.engine) this.engine.removeEntity(this);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameEngine, Entity };
}

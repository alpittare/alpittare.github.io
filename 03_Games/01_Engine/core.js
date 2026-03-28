// ============================================================================
// GAME ENGINE CORE — Phase 1
// Game Loop + Update/Render Separation + Entity System
// ============================================================================

class GameEngine {
    constructor(canvasId, width = 414, height = 896) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.WIDTH = width;
        this.HEIGHT = height;

        // DPI scaling
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);

        // Viewport fit
        this._fitToScreen();
        window.addEventListener('resize', () => this._fitToScreen());

        // Timing
        this._lastTime = 0;
        this._accumulator = 0;
        this._fixedStep = 1 / 60; // 60Hz physics tick
        this._running = false;
        this._rafId = null;

        // Performance tracking
        this.fps = 0;
        this._frameCount = 0;
        this._fpsTimer = 0;

        // Entity registry
        this.entities = [];
        this._pendingAdd = [];
        this._pendingRemove = new Set();

        // State machine
        this.state = null;
        this.states = {};

        // Event system (per-instance, not shared via prototype)
        this._listeners = {};

        // Debug
        this.debug = false;
    }

    // --- Viewport -----------------------------------------------------------

    _fitToScreen() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.min(vw / this.WIDTH, vh / this.HEIGHT);
        this.canvas.style.width = Math.floor(this.WIDTH * scale) + 'px';
        this.canvas.style.height = Math.floor(this.HEIGHT * scale) + 'px';
        this._screenScale = scale;
    }

    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (this.WIDTH / rect.width),
            y: (clientY - rect.top) * (this.HEIGHT / rect.height)
        };
    }

    // --- Game Loop -----------------------------------------------------------

    start() {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        this._tick(this._lastTime);
    }

    stop() {
        this._running = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }

    _tick(now) {
        if (!this._running) return;
        this._rafId = requestAnimationFrame((t) => this._tick(t));

        // Delta time in seconds, clamped to prevent spiral of death
        const dt = Math.min((now - this._lastTime) / 1000, 0.1);
        this._lastTime = now;

        // FPS counter
        this._frameCount++;
        this._fpsTimer += dt;
        if (this._fpsTimer >= 1) {
            this.fps = this._frameCount;
            this._frameCount = 0;
            this._fpsTimer -= 1;
        }

        // Fixed-step update (physics-stable)
        this._accumulator += dt;
        while (this._accumulator >= this._fixedStep) {
            this._fixedUpdate(this._fixedStep);
            this._accumulator -= this._fixedStep;
        }

        // Variable-rate update (animations, input smoothing)
        this._update(dt);

        // Render with interpolation alpha
        const alpha = this._accumulator / this._fixedStep;
        this._render(alpha);

        // Flush entity additions/removals
        this._flushEntities();
    }

    // --- Update pipeline -----------------------------------------------------

    _fixedUpdate(dt) {
        if (this.state && this.states[this.state]?.fixedUpdate) {
            this.states[this.state].fixedUpdate(dt);
        }
        for (const entity of this.entities) {
            if (entity.active && entity.fixedUpdate) {
                entity.fixedUpdate(dt);
            }
        }
    }

    _update(dt) {
        if (this.state && this.states[this.state]?.update) {
            this.states[this.state].update(dt);
        }
        for (const entity of this.entities) {
            if (entity.active && entity.update) {
                entity.update(dt);
            }
        }
    }

    // --- Render pipeline -----------------------------------------------------

    _render(alpha) {
        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT);

        // State-specific background render
        if (this.state && this.states[this.state]?.render) {
            this.states[this.state].render(ctx, alpha);
        }

        // Entity render (sorted by z-index)
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

    _renderDebug(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(4, 4, 120, 50);
        ctx.fillStyle = '#0f0';
        ctx.font = '11px monospace';
        ctx.fillText(`FPS: ${this.fps}`, 10, 18);
        ctx.fillText(`Entities: ${this.entities.length}`, 10, 32);
        ctx.fillText(`State: ${this.state || 'none'}`, 10, 46);
    }

    // --- Entity management ---------------------------------------------------

    addEntity(entity) {
        entity.engine = this;
        this._pendingAdd.push(entity);
        return entity;
    }

    removeEntity(entity) {
        this._pendingRemove.add(entity);
    }

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

    findByTag(tag) {
        return this.entities.filter(e => e.tag === tag);
    }

    findOne(tag) {
        return this.entities.find(e => e.tag === tag);
    }

    // --- State machine -------------------------------------------------------

    registerState(name, handlers) {
        this.states[name] = handlers;
    }

    switchState(name) {
        if (this.state && this.states[this.state]?.exit) {
            this.states[this.state].exit();
        }
        this.state = name;
        if (this.states[name]?.enter) {
            this.states[name].enter();
        }
    }
}


// ============================================================================
// BASE ENTITY
// ============================================================================

class Entity {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 0;
        this.height = 0;
        this.z = 0;          // render order
        this.active = true;
        this.visible = true;
        this.tag = null;
        this.engine = null;  // set by engine.addEntity()
    }

    // Store previous position for interpolation
    fixedUpdate(dt) {
        this.prevX = this.x;
        this.prevY = this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    // Interpolated position for smooth rendering
    lerpX(alpha) {
        return this.prevX + (this.x - this.prevX) * alpha;
    }

    lerpY(alpha) {
        return this.prevY + (this.y - this.prevY) * alpha;
    }

    // Override in subclass
    update(dt) {}
    render(ctx, alpha) {}

    // AABB bounds
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            w: this.width,
            h: this.height
        };
    }

    destroy() {
        if (this.engine) this.engine.removeEntity(this);
    }
}


// ============================================================================
// PLAYER ENTITY
// ============================================================================

class Player extends Entity {
    constructor(x, y) {
        super(x, y);
        this.tag = 'player';
        this.width = 40;
        this.height = 60;
        this.z = 10;

        // Movement
        this.speed = 220;      // px/s
        this.moveDir = 0;      // -1, 0, 1

        // State
        this.state = 'idle';   // idle, run, jump, fall
        this.facing = 1;       // 1 = right, -1 = left
        this.grounded = false;
        this.color = '#00e5ff';
    }

    fixedUpdate(dt) {
        this.prevX = this.x;
        this.prevY = this.y;

        // Horizontal movement
        this.vx = this.moveDir * this.speed;
        if (this.moveDir !== 0) this.facing = this.moveDir;

        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Clamp to screen bounds
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > this.engine.WIDTH) {
            this.x = this.engine.WIDTH - this.width;
        }

        // Update state
        this._updateState();
    }

    _updateState() {
        if (!this.grounded) {
            this.state = this.vy < 0 ? 'jump' : 'fall';
        } else if (Math.abs(this.vx) > 10) {
            this.state = 'run';
        } else {
            this.state = 'idle';
        }
    }

    render(ctx, alpha) {
        const rx = this.lerpX(alpha);
        const ry = this.lerpY(alpha);

        // Body
        ctx.fillStyle = this.color;
        ctx.fillRect(rx, ry, this.width, this.height);

        // Direction indicator
        ctx.fillStyle = '#fff';
        const eyeX = this.facing === 1 ? rx + 28 : rx + 8;
        ctx.fillRect(eyeX, ry + 12, 6, 6);

        // State label (debug)
        if (this.engine.debug) {
            ctx.fillStyle = '#ff0';
            ctx.font = '10px monospace';
            ctx.fillText(this.state, rx, ry - 4);
        }
    }
}


// ============================================================================
// EXPORTS (for module or inline use)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameEngine, Entity, Player };
}

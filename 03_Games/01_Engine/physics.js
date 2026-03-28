// ============================================================================
// PHYSICS SYSTEM — Phase 2
// Gravity, Jump Mechanics, AABB Collision Detection & Resolution
// ============================================================================


class PhysicsBody {
    constructor(entity) {
        this.entity = entity;
        this.gravity = 1400;         // px/s² (tuned for 414x896 mobile canvas)
        this.maxFallSpeed = 900;     // terminal velocity
        this.friction = 0.85;        // ground friction multiplier per tick
        this.airFriction = 0.98;     // air friction
        this.bounce = 0;             // 0 = no bounce, 1 = perfect bounce
        this.isStatic = false;       // static bodies don't move
        this.isSolid = true;         // solid bodies block movement
    }

    applyGravity(dt) {
        if (this.isStatic) return;
        this.entity.vy += this.gravity * dt;
        if (this.entity.vy > this.maxFallSpeed) {
            this.entity.vy = this.maxFallSpeed;
        }
    }

    applyFriction(dt) {
        if (this.isStatic) return;
        const f = this.entity.grounded ? this.friction : this.airFriction;
        // Only apply to horizontal — vertical handled by gravity
        if (this.entity.moveDir === 0) {
            this.entity.vx *= f;
            if (Math.abs(this.entity.vx) < 1) this.entity.vx = 0;
        }
    }
}


// ============================================================================
// JUMP CONTROLLER — Responsive, game-feel tuned
// ============================================================================

class JumpController {
    constructor(entity) {
        this.entity = entity;

        // --- Tuning knobs (tweak these for game feel) ---
        this.jumpForce = -520;       // initial upward velocity
        this.jumpCutMultiplier = 0.4; // early release = shorter jump
        this.maxJumps = 2;           // 1 = single, 2 = double jump
        this.coyoteTime = 0.08;      // seconds of grace after leaving edge
        this.jumpBufferTime = 0.1;   // seconds to buffer jump input before landing

        // --- Internal state ---
        this._jumpsLeft = this.maxJumps;
        this._coyoteTimer = 0;
        this._jumpBufferTimer = 0;
        this._isJumpHeld = false;
        this._wasGrounded = false;
    }

    update(dt) {
        const grounded = this.entity.grounded;

        // Reset jumps on ground
        if (grounded) {
            this._jumpsLeft = this.maxJumps;
            this._coyoteTimer = this.coyoteTime;
        } else {
            this._coyoteTimer -= dt;
        }

        // Track leaving ground without jumping (for coyote time)
        if (this._wasGrounded && !grounded && this._jumpsLeft === this.maxJumps) {
            // Walked off edge — don't consume first jump, but start coyote timer
        }
        this._wasGrounded = grounded;

        // Decrement jump buffer
        if (this._jumpBufferTimer > 0) {
            this._jumpBufferTimer -= dt;
        }

        // Auto-execute buffered jump on landing
        if (grounded && this._jumpBufferTimer > 0) {
            this._executeJump();
            this._jumpBufferTimer = 0;
        }
    }

    requestJump() {
        // Buffer the input
        this._jumpBufferTimer = this.jumpBufferTime;
        this._isJumpHeld = true;

        const canCoyote = this._coyoteTimer > 0 && this._jumpsLeft === this.maxJumps;
        const canJump = this.entity.grounded || canCoyote || this._jumpsLeft > 0;

        if (canJump) {
            this._executeJump();
            this._jumpBufferTimer = 0;
        }
    }

    releaseJump() {
        this._isJumpHeld = false;
        // Variable jump height: cut upward velocity on early release
        if (this.entity.vy < 0) {
            this.entity.vy *= this.jumpCutMultiplier;
        }
    }

    _executeJump() {
        // Coyote time: if still within grace period, treat as first jump
        if (!this.entity.grounded && this._coyoteTimer > 0 && this._jumpsLeft === this.maxJumps) {
            this._jumpsLeft--;
        }

        if (this._jumpsLeft <= 0) return;

        this.entity.vy = this.jumpForce;
        this.entity.grounded = false;
        this._jumpsLeft--;
        this._coyoteTimer = 0;

        // Emit event for sound/particles
        if (this.entity.engine) {
            this.entity.engine._emit('jump', {
                entity: this.entity,
                jumpsLeft: this._jumpsLeft
            });
        }
    }

    get isDoubleJump() {
        return this._jumpsLeft < this.maxJumps - 1;
    }
}


// ============================================================================
// COLLISION SYSTEM — AABB detection + resolution
// ============================================================================

class CollisionSystem {
    constructor(engine) {
        this.engine = engine;
        this._colliders = [];
    }

    register(entity, options = {}) {
        const collider = {
            entity,
            physics: entity.physics || new PhysicsBody(entity),
            layer: options.layer || 'default',
            isTrigger: options.isTrigger || false, // triggers detect but don't resolve
            onCollide: options.onCollide || null,
        };
        this._colliders.push(collider);
        return collider;
    }

    unregister(entity) {
        this._colliders = this._colliders.filter(c => c.entity !== entity);
    }

    update() {
        const len = this._colliders.length;

        // Reset grounded flag for all dynamic entities at START of collision check
        // (before collision system sets it based on collisions)
        for (let i = 0; i < len; i++) {
            if (!this._colliders[i].physics.isStatic) {
                this._colliders[i].entity.grounded = false;
            }
        }

        for (let i = 0; i < len; i++) {
            for (let j = i + 1; j < len; j++) {
                const a = this._colliders[i];
                const b = this._colliders[j];
                if (!a.entity.active || !b.entity.active) continue;

                const overlap = this._testAABB(a.entity, b.entity);
                if (!overlap) continue;

                // Fire callbacks
                if (a.onCollide) a.onCollide(b.entity, overlap);
                if (b.onCollide) b.onCollide(a.entity, overlap);

                // Resolve only if both are solid and neither is trigger
                if (!a.isTrigger && !b.isTrigger && a.physics.isSolid && b.physics.isSolid) {
                    this._resolve(a, b, overlap);
                }
            }
        }
    }

    _testAABB(a, b) {
        const ax = a.x, ay = a.y, aw = a.width, ah = a.height;
        const bx = b.x, by = b.y, bw = b.width, bh = b.height;

        const overlapX = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
        const overlapY = Math.min(ay + ah, by + bh) - Math.max(ay, by);

        if (overlapX <= 0 || overlapY <= 0) return null;

        return { x: overlapX, y: overlapY };
    }

    _resolve(a, b, overlap) {
        const ea = a.entity, eb = b.entity;
        const aStatic = a.physics.isStatic;
        const bStatic = b.physics.isStatic;

        if (aStatic && bStatic) return;

        // Determine push direction — resolve along smallest axis
        if (overlap.x < overlap.y) {
            // Horizontal push
            const dir = (ea.x + ea.width / 2) < (eb.x + eb.width / 2) ? -1 : 1;
            if (aStatic) {
                eb.x += overlap.x * -dir * -1;
                eb.vx *= -b.physics.bounce;
            } else if (bStatic) {
                ea.x += overlap.x * dir;
                ea.vx *= -a.physics.bounce;
            } else {
                ea.x += (overlap.x / 2) * dir;
                eb.x -= (overlap.x / 2) * dir;
            }
        } else {
            // Vertical push
            const dir = (ea.y + ea.height / 2) < (eb.y + eb.height / 2) ? -1 : 1;
            if (aStatic) {
                eb.y += overlap.y * -dir * -1;
                if (dir === 1) { eb.grounded = true; }
                eb.vy *= -b.physics.bounce;
            } else if (bStatic) {
                ea.y += overlap.y * dir;
                if (dir === -1) { ea.grounded = true; }
                ea.vy *= -a.physics.bounce;
            } else {
                ea.y += (overlap.y / 2) * dir;
                eb.y -= (overlap.y / 2) * dir;
            }
        }
    }
}


// ============================================================================
// PLATFORM ENTITY — Static collidable surface
// ============================================================================

class Platform extends Entity {
    constructor(x, y, w, h, color = '#2a5a2a') {
        super(x, y);
        this.width = w;
        this.height = h;
        this.tag = 'platform';
        this.z = 1;
        this.color = color;

        this.physics = new PhysicsBody(this);
        this.physics.isStatic = true;
    }

    render(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Surface highlight
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(this.x, this.y, this.width, 2);
    }
}


// ============================================================================
// EXTEND ENGINE — Event system (used by JumpController)
// ============================================================================
// Note: _listeners is now initialized per-instance in GameEngine constructor
// These methods just add the event handling API to the prototype

GameEngine.prototype.on = function(event, fn) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
};

GameEngine.prototype.off = function(event, fn) {
    if (!this._listeners?.[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
};

GameEngine.prototype._emit = function(event, data) {
    if (!this._listeners?.[event]) return;
    for (const fn of this._listeners[event]) fn(data);
};


// ============================================================================
// EXTEND PLAYER — Attach physics + jump
// ============================================================================

const _origPlayerConstructor = Player.prototype.constructor;

Player.prototype._initPhysics = function() {
    this.physics = new PhysicsBody(this);
    this.physics.gravity = 1400;
    this.physics.maxFallSpeed = 900;

    this.jump = new JumpController(this);
    this.jump.jumpForce = -520;
    this.jump.maxJumps = 2;
};

const _origPlayerFixedUpdate = Player.prototype.fixedUpdate;
Player.prototype.fixedUpdate = function(dt) {
    if (!this.physics) this._initPhysics();

    this.prevX = this.x;
    this.prevY = this.y;

    // Gravity
    // NOTE: grounded reset is now done in CollisionSystem.update() before collision tests
    this.physics.applyGravity(dt);

    // Horizontal movement with acceleration
    const targetVx = this.moveDir * this.speed;
    const accel = this.grounded ? 12 : 6; // snappier on ground
    this.vx += (targetVx - this.vx) * Math.min(1, accel * dt);

    if (this.moveDir !== 0) this.facing = this.moveDir;

    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Screen bounds
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.width > this.engine.WIDTH) {
        this.x = this.engine.WIDTH - this.width;
        this.vx = 0;
    }

    // Jump controller tick
    this.jump.update(dt);

    // Friction
    this.physics.applyFriction(dt);

    // State
    this._updateState();
};


// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PhysicsBody, JumpController, CollisionSystem, Platform };
}

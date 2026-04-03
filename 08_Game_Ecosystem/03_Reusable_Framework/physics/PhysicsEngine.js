/**
 * PhysicsEngine.js
 * 2D physics simulation with gravity, friction, collision detection and resolution.
 * Supports both static and dynamic bodies with trigger volumes.
 *
 * Features:
 * - Gravity (1400 px/s²) with terminal velocity (900 px/s)
 * - Ground friction (0.85) and air friction (0.98)
 * - AABB collision detection and resolution
 * - Trigger volumes (detect without resolve)
 * - Bounce and bounce multipliers
 * - Ball trajectory physics (parabolic motion)
 * - Curve decay for curved ball shots
 *
 * @module physics/PhysicsEngine
 */

'use strict';

/**
 * PhysicsBody manages physical properties and behaviors of an entity.
 *
 * @class PhysicsBody
 */
class PhysicsBody {
    /**
     * @param {Entity} entity - The entity to attach physics to
     * @param {object} [config] - Configuration options
     * @param {number} [config.gravity=1400] - Downward acceleration (px/s²)
     * @param {number} [config.maxFallSpeed=900] - Terminal velocity (px/s)
     * @param {number} [config.friction=0.85] - Ground friction (0-1)
     * @param {number} [config.airFriction=0.98] - Air friction (0-1)
     * @param {number} [config.bounce=0] - Bounce coefficient (0-1)
     * @param {boolean} [config.isStatic=false] - Static bodies don't move
     * @param {boolean} [config.isSolid=true] - Solid bodies collide
     */
    constructor(entity, config = {}) {
        this.entity = entity;

        // Physics parameters (tuned for mobile 414x896)
        this.gravity = config.gravity !== undefined ? config.gravity : 1400;
        this.maxFallSpeed = config.maxFallSpeed !== undefined ? config.maxFallSpeed : 900;
        this.friction = config.friction !== undefined ? config.friction : 0.85;
        this.airFriction = config.airFriction !== undefined ? config.airFriction : 0.98;
        this.bounce = config.bounce || 0;

        // Behavior flags
        this.isStatic = config.isStatic || false;
        this.isSolid = config.isSolid !== undefined ? config.isSolid : true;
    }

    /**
     * Apply gravity to the entity.
     * Increases downward velocity and clamps to terminal velocity.
     *
     * @param {number} dt - Delta time in seconds
     */
    applyGravity(dt) {
        if (this.isStatic) return;
        this.entity.vy += this.gravity * dt;
        if (this.entity.vy > this.maxFallSpeed) {
            this.entity.vy = this.maxFallSpeed;
        }
    }

    /**
     * Apply friction to slow movement.
     * Uses ground friction when grounded, air friction otherwise.
     *
     * @param {number} dt - Delta time in seconds
     */
    applyFriction(dt) {
        if (this.isStatic) return;
        const f = (this.entity.grounded !== undefined && this.entity.grounded)
            ? this.friction
            : this.airFriction;

        // Apply horizontal friction only
        if (this.entity.moveDir === 0) {
            this.entity.vx *= f;
            if (Math.abs(this.entity.vx) < 1) this.entity.vx = 0;
        }
    }
}

/**
 * CollisionSystem manages all collision detection and resolution.
 * Uses AABB (axis-aligned bounding box) testing for efficiency.
 *
 * @class CollisionSystem
 */
class CollisionSystem {
    /**
     * @param {GameEngine} engine - Reference to the game engine
     */
    constructor(engine) {
        this.engine = engine;
        this._colliders = [];
    }

    /**
     * Register an entity for collision detection.
     *
     * @param {Entity} entity - Entity to register
     * @param {object} [options] - Configuration
     * @param {string} [options.layer='default'] - Collision layer
     * @param {boolean} [options.isTrigger=false] - Trigger volumes don't block
     * @param {Function} [options.onCollide] - Callback(otherEntity, overlapData)
     * @returns {object} Collider reference
     */
    register(entity, options = {}) {
        const collider = {
            entity,
            physics: entity.physics || new PhysicsBody(entity),
            layer: options.layer || 'default',
            isTrigger: options.isTrigger || false,
            onCollide: options.onCollide || null
        };
        this._colliders.push(collider);
        return collider;
    }

    /**
     * Unregister an entity from collision detection.
     *
     * @param {Entity} entity
     */
    unregister(entity) {
        this._colliders = this._colliders.filter(c => c.entity !== entity);
    }

    /**
     * Update collisions (detect and resolve).
     * Called once per fixed physics step.
     */
    update() {
        const len = this._colliders.length;

        // Reset grounded flag for all dynamic entities
        for (let i = 0; i < len; i++) {
            if (!this._colliders[i].physics.isStatic) {
                this._colliders[i].entity.grounded = false;
            }
        }

        // Broad phase: test all pairs
        for (let i = 0; i < len; i++) {
            for (let j = i + 1; j < len; j++) {
                const a = this._colliders[i];
                const b = this._colliders[j];

                if (!a.entity.active || !b.entity.active) continue;

                const overlap = this._testAABB(a.entity, b.entity);
                if (!overlap) continue;

                // Fire collision callbacks
                if (a.onCollide) a.onCollide(b.entity, overlap);
                if (b.onCollide) b.onCollide(a.entity, overlap);

                // Resolve only if both solid and neither is trigger
                if (!a.isTrigger && !b.isTrigger && a.physics.isSolid && b.physics.isSolid) {
                    this._resolve(a, b, overlap);
                }
            }
        }
    }

    /**
     * Test AABB collision between two entities.
     * @private
     */
    _testAABB(a, b) {
        const ax = a.x, ay = a.y, aw = a.width, ah = a.height;
        const bx = b.x, by = b.y, bw = b.width, bh = b.height;

        const overlapX = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
        const overlapY = Math.min(ay + ah, by + bh) - Math.max(ay, by);

        if (overlapX <= 0 || overlapY <= 0) return null;

        return { x: overlapX, y: overlapY };
    }

    /**
     * Resolve overlap between two colliders.
     * Pushes entities apart along shortest axis.
     * Sets grounded flag for vertical collisions.
     * @private
     */
    _resolve(a, b, overlap) {
        const ea = a.entity, eb = b.entity;
        const aStatic = a.physics.isStatic;
        const bStatic = b.physics.isStatic;

        if (aStatic && bStatic) return;

        if (overlap.x < overlap.y) {
            // Horizontal collision — push left/right
            const dir = (ea.x + ea.width / 2) < (eb.x + eb.width / 2) ? -1 : 1;

            if (aStatic) {
                eb.x += overlap.x * -dir * -1;
                eb.vx *= -a.physics.bounce;
            } else if (bStatic) {
                ea.x += overlap.x * dir;
                ea.vx *= -a.physics.bounce;
            } else {
                ea.x += (overlap.x / 2) * dir;
                eb.x -= (overlap.x / 2) * dir;
            }
        } else {
            // Vertical collision — push up/down + set grounded
            const dir = (ea.y + ea.height / 2) < (eb.y + eb.height / 2) ? -1 : 1;

            if (aStatic) {
                eb.y += overlap.y * -dir * -1;
                if (dir === 1) eb.grounded = true;
                eb.vy *= -b.physics.bounce;
            } else if (bStatic) {
                ea.y += overlap.y * dir;
                if (dir === -1) ea.grounded = true;
                ea.vy *= -a.physics.bounce;
            } else {
                ea.y += (overlap.y / 2) * dir;
                eb.y -= (overlap.y / 2) * dir;
                if (dir === -1) ea.grounded = true;
                if (dir === 1) eb.grounded = true;
            }
        }
    }

    /**
     * Raycast to find entity at position.
     * Useful for hit detection, aiming, etc.
     *
     * @param {number} x - World X
     * @param {number} y - World Y
     * @returns {Entity|null} Entity at position or null
     */
    raycast(x, y) {
        for (let i = this._colliders.length - 1; i >= 0; i--) {
            const e = this._colliders[i].entity;
            if (e.active && x >= e.x && x <= e.x + e.width &&
                y >= e.y && y <= e.y + e.height) {
                return e;
            }
        }
        return null;
    }
}

/**
 * Platform entity — Static solid surface for collision.
 * Commonly used for walls, floors, platforms in platformers.
 *
 * @class Platform
 */
class Platform {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {string} [color='#2a5a2a'] - Render color
     */
    constructor(x, y, w, h, color = '#2a5a2a') {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.vx = 0;
        this.vy = 0;
        this.tag = 'platform';
        this.z = 1;
        this.active = true;
        this.visible = true;
        this.color = color;

        this.physics = new PhysicsBody(this, {
            isStatic: true,
            isSolid: true
        });
    }

    render(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Surface highlight
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(this.x, this.y, this.width, 2);
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            w: this.width,
            h: this.height
        };
    }
}

/**
 * BallPhysics — Specialized physics for projectile/ball motion.
 * Handles parabolic trajectory, curve decay, and chip/loft mechanics.
 *
 * @class BallPhysics
 */
class BallPhysics {
    /**
     * @param {object} [config]
     * @param {number} [config.curveDecay=0.97] - Curve effect decay per frame
     * @param {number} [config.chipGravity=2000] - Extra gravity for chip shots
     * @param {number} [config.liftGravity=800] - Reduced gravity for loft shots
     */
    constructor(config = {}) {
        this.curveDecay = config.curveDecay || 0.97;
        this.chipGravity = config.chipGravity || 2000;
        this.liftGravity = config.liftGravity || 800;
        this.spinVx = 0; // Horizontal spin velocity
        this.spinVy = 0; // Vertical spin velocity
        this.shotType = 'normal'; // 'normal', 'chip', 'loft', 'curve'
    }

    /**
     * Apply ball-specific physics.
     *
     * @param {Entity} ball - The ball entity
     * @param {PhysicsBody} body - The physics body
     * @param {number} dt - Delta time
     */
    update(ball, body, dt) {
        // Spin/curve effect
        if (Math.abs(this.spinVx) > 0.1) {
            ball.vx += this.spinVx * dt;
            this.spinVx *= this.curveDecay;
        }

        // Gravity variation by shot type
        let gravityMod = 1.0;
        if (this.shotType === 'chip') gravityMod = this.chipGravity / 1400;
        if (this.shotType === 'loft') gravityMod = this.liftGravity / 1400;

        ball.vy += (body.gravity * gravityMod) * dt;
        if (ball.vy > body.maxFallSpeed) {
            ball.vy = body.maxFallSpeed;
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PhysicsBody, CollisionSystem, Platform, BallPhysics };
}

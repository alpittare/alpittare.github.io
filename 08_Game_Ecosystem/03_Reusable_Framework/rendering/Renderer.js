/**
 * Renderer.js
 * Canvas rendering framework with layering, camera, particles, and effects.
 * Provides reusable rendering utilities for game visuals.
 *
 * Features:
 * - Layered drawing (background → entities → effects → HUD)
 * - Camera system (shake, zoom, center-based transform)
 * - Particle system (pool-based, 250 max)
 * - Trail system (80-point history with gradients)
 * - Easing functions (easeOutCubic, easeOutBack, easeInOutQuad, lerp)
 * - Text rendering with shadow/glow
 * - roundRect polyfill (critical for older WebViews)
 * - DPI scaling support
 *
 * @module rendering/Renderer
 */

'use strict';

/**
 * Camera provides 2D camera transforms (position, zoom, shake).
 *
 * @class Camera
 */
class Camera {
    /**
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     */
    constructor(width, height) {
        this.x = 0;
        this.y = 0;
        this.width = width;
        this.height = height;
        this.zoom = 1.0;

        // Shake
        this.shakeAmount = 0;
        this.shakeTimer = 0;
        this.shakeDuration = 0;
    }

    /**
     * Shake the camera.
     *
     * @param {number} amount - Shake intensity
     * @param {number} duration - Duration in seconds
     */
    shake(amount, duration) {
        this.shakeAmount = amount;
        this.shakeDuration = duration;
        this.shakeTimer = duration;
    }

    /**
     * Update camera (decreases shake).
     *
     * @param {number} dt - Delta time
     */
    update(dt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        } else {
            this.shakeAmount = 0;
        }
    }

    /**
     * Get current shake offset.
     *
     * @returns {{x: number, y: number}}
     */
    getShake() {
        if (this.shakeAmount === 0) return { x: 0, y: 0 };

        const intensity = (this.shakeTimer / this.shakeDuration) * this.shakeAmount;
        return {
            x: (Math.random() - 0.5) * intensity,
            y: (Math.random() - 0.5) * intensity
        };
    }

    /**
     * Apply camera transform to context.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    apply(ctx) {
        const shake = this.getShake();
        ctx.translate(shake.x, shake.y);
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x - this.width / 2, -this.y - this.height / 2);
    }
}

/**
 * Particle represents a single particle in the system.
 *
 * @class Particle
 */
class Particle {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} vx
     * @param {number} vy
     * @param {number} lifetime
     * @param {string} color
     */
    constructor(x, y, vx, vy, lifetime, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.lifetime = lifetime;
        this.maxLifetime = lifetime;
        this.color = color;
        this.size = 4;
        this.gravity = 0;
        this.active = true;
    }

    /**
     * Update particle.
     *
     * @param {number} dt - Delta time
     */
    update(dt) {
        if (!this.active) return;

        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.active = false;
            return;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += this.gravity * dt;
    }

    /**
     * Render particle.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        const alpha = this.lifetime / this.maxLifetime;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

/**
 * ParticleSystem manages a pool of particles.
 *
 * @class ParticleSystem
 */
class ParticleSystem {
    /**
     * @param {number} [maxParticles=250]
     */
    constructor(maxParticles = 250) {
        this.maxParticles = maxParticles;
        this.particles = [];
    }

    /**
     * Emit particles.
     *
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     * @param {number} count - Particle count
     * @param {object} [options] - Configuration
     * @param {number} [options.vx=0] - Velocity X
     * @param {number} [options.vy=0] - Velocity Y
     * @param {number} [options.spread=100] - Velocity spread
     * @param {string} [options.color='#fff'] - Color
     * @param {number} [options.lifetime=1] - Duration
     */
    emit(x, y, count, options = {}) {
        if (this.particles.length >= this.maxParticles) return;

        const vx = options.vx || 0;
        const vy = options.vy || 0;
        const spread = options.spread || 100;
        const color = options.color || '#fff';
        const lifetime = options.lifetime || 1;

        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;

            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * spread;
            const px = x + Math.cos(angle) * 5;
            const py = y + Math.sin(angle) * 5;
            const pvx = vx + Math.cos(angle) * speed;
            const pvy = vy + Math.sin(angle) * speed;

            const p = new Particle(px, py, pvx, pvy, lifetime, color);
            this.particles.push(p);
        }
    }

    /**
     * Update all particles.
     *
     * @param {number} dt - Delta time
     */
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (!this.particles[i].active) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * Render all particles.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        for (const p of this.particles) {
            p.render(ctx);
        }
    }

    /**
     * Clear all particles.
     */
    clear() {
        this.particles = [];
    }
}

/**
 * TrailRenderer tracks and renders movement trails.
 *
 * @class TrailRenderer
 */
class TrailRenderer {
    /**
     * @param {number} [maxPoints=80]
     */
    constructor(maxPoints = 80) {
        this.maxPoints = maxPoints;
        this.points = [];
    }

    /**
     * Add point to trail.
     *
     * @param {number} x
     * @param {number} y
     * @param {string} color
     */
    addPoint(x, y, color = '#fff') {
        this.points.push({ x, y, color });
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
    }

    /**
     * Render trail as gradient line.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (this.points.length < 2) return;

        for (let i = 1; i < this.points.length; i++) {
            const prev = this.points[i - 1];
            const curr = this.points[i];
            const alpha = i / this.points.length;

            ctx.strokeStyle = prev.color;
            ctx.globalAlpha = alpha * 0.6;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Clear trail.
     */
    clear() {
        this.points = [];
    }
}

/**
 * Easing functions for animations.
 */
const Easing = {
    /**
     * Linear interpolation.
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Ease out cubic.
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    /**
     * Ease out back.
     */
    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) + 1;
    },

    /**
     * Ease in-out quad.
     */
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
};

/**
 * Renderer provides high-level rendering utilities.
 *
 * @class Renderer
 */
class Renderer {
    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     */
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;

        this.camera = new Camera(width, height);
        this.particles = new ParticleSystem();
        this.trails = [];

        // Polyfill roundRect for older WebViews (critical for iOS)
        this._setupRoundRectPolyfill();
    }

    /**
     * Polyfill for CanvasRenderingContext2D.roundRect (iOS WebView compatibility).
     * @private
     */
    _setupRoundRectPolyfill() {
        if (CanvasRenderingContext2D.prototype.roundRect) return;

        CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
            if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
            this.beginPath();
            this.moveTo(x + r.tl, y);
            this.lineTo(x + w - r.tr, y);
            this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
            this.lineTo(x + w, y + h - r.br);
            this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
            this.lineTo(x + r.bl, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
            this.lineTo(x, y + r.tl);
            this.quadraticCurveTo(x, y, x + r.tl, y);
            this.closePath();
        };
    }

    /**
     * Render text with optional shadow and glow.
     *
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {object} [options]
     * @param {string} [options.color='#fff'] - Text color
     * @param {string} [options.font='16px Arial'] - Font
     * @param {string} [options.align='left'] - Text alignment
     * @param {boolean} [options.shadow=false] - Add shadow
     * @param {boolean} [options.glow=false] - Add glow
     */
    drawText(text, x, y, options = {}) {
        const color = options.color || '#fff';
        const font = options.font || '16px Arial';
        const align = options.align || 'left';

        this.ctx.font = font;
        this.ctx.textAlign = align;

        if (options.shadow) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillText(text, x + 2, y + 2);
        }

        if (options.glow) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(text, x, y);
        }

        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
    }

    /**
     * Update camera and particle system.
     *
     * @param {number} dt - Delta time
     */
    update(dt) {
        this.camera.update(dt);
        this.particles.update(dt);
    }

    /**
     * Get easing functions.
     *
     * @returns {object} Easing function map
     */
    static get Easing() {
        return Easing;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Renderer, Camera, ParticleSystem, TrailRenderer, Particle, Easing };
}

/**
 * InputManager.js
 * Unified input handling for touch, mouse, and virtual joystick input.
 * Supports swipe detection, tap buttons, and coordinate transformation.
 *
 * Features:
 * - Touch + mouse input support
 * - Swipe detection with angle, distance, magnitude, duration
 * - Virtual joystick (circular analog stick)
 * - Tap detection with button hit testing
 * - Screen-to-game coordinate transformation
 * - Passive event listeners for performance
 *
 * @module input/InputManager
 */

'use strict';

/**
 * SwipeDetector tracks touch swipe gestures.
 *
 * @class SwipeDetector
 */
class SwipeDetector {
    /**
     * @param {object} [config]
     * @param {number} [config.minDistance=20] - Minimum pixels to register swipe
     * @param {number} [config.maxDuration=500] - Maximum milliseconds
     */
    constructor(config = {}) {
        this.minDistance = config.minDistance || 20;
        this.maxDuration = config.maxDuration || 500;

        this.startX = 0;
        this.startY = 0;
        this.startTime = 0;
        this.isActive = false;
    }

    /**
     * Start tracking a touch.
     */
    start(x, y) {
        this.startX = x;
        this.startY = y;
        this.startTime = Date.now();
        this.isActive = true;
    }

    /**
     * Check if current position is a swipe.
     *
     * @param {number} x - Current X
     * @param {number} y - Current Y
     * @returns {object|null} { angle, distance, magnitude, duration } or null
     */
    check(x, y) {
        if (!this.isActive) return null;

        const dx = x - this.startX;
        const dy = y - this.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = Date.now() - this.startTime;

        if (distance < this.minDistance || duration > this.maxDuration) return null;

        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const magnitude = distance / this.maxDuration * 1000; // pixels per second

        return { angle, distance, magnitude, duration };
    }

    /**
     * End swipe tracking.
     */
    end() {
        this.isActive = false;
    }
}

/**
 * VirtualJoystick renders and tracks an on-screen analog stick.
 *
 * @class VirtualJoystick
 */
class VirtualJoystick {
    /**
     * @param {object} config
     * @param {number} config.x - Center X position
     * @param {number} config.y - Center Y position
     * @param {number} [config.radius=80] - Joystick radius in pixels
     * @param {CanvasRenderingContext2D} [config.ctx] - Canvas context for rendering
     */
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.radius = config.radius || 80;
        this.ctx = config.ctx || null;

        this.inputX = 0; // -1 to 1
        this.inputY = 0; // -1 to 1
        this.isActive = false;
        this.touchId = null;

        // Visual
        this.baseColor = '#333';
        this.stickColor = '#0f0';
        this.opacity = 0.5;
    }

    /**
     * Check if touch is within joystick bounds.
     *
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    contains(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist <= this.radius * 1.2; // Slightly oversized hit area
    }

    /**
     * Update joystick input from touch position.
     *
     * @param {number} x
     * @param {number} y
     */
    update(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.radius * 0.8;

        if (dist === 0) {
            this.inputX = 0;
            this.inputY = 0;
        } else {
            const clampedDist = Math.min(dist, maxDist);
            this.inputX = (dx / dist) * (clampedDist / maxDist);
            this.inputY = (dy / dist) * (clampedDist / maxDist);
        }
    }

    /**
     * Release joystick.
     */
    release() {
        this.inputX = 0;
        this.inputY = 0;
        this.isActive = false;
        this.touchId = null;
    }

    /**
     * Render joystick on canvas.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Base circle
        ctx.fillStyle = this.baseColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Stick position
        const stickX = this.x + this.inputX * this.radius * 0.7;
        const stickY = this.y + this.inputY * this.radius * 0.7;

        ctx.fillStyle = this.stickColor;
        ctx.beginPath();
        ctx.arc(stickX, stickY, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Get direction string ('up', 'down', 'left', 'right', etc.).
     * @returns {string}
     */
    getDirection() {
        const angle = Math.atan2(this.inputY, this.inputX) * 180 / Math.PI;
        if (Math.abs(this.inputX) < 0.3 && Math.abs(this.inputY) < 0.3) return 'neutral';
        if (angle > -45 && angle < 45) return 'right';
        if (angle > 45 && angle < 135) return 'down';
        if (angle < -45 && angle > -135) return 'up';
        return 'left';
    }
}

/**
 * InputManager handles all input events and coordinate transformation.
 *
 * @class InputManager
 */
class InputManager {
    /**
     * @param {GameEngine} engine - Reference to game engine
     * @param {object} [config]
     * @param {boolean} [config.enableVirtualJoystick=false] - Show on-screen joystick
     * @param {number} [config.joystickX] - Virtual joystick X position
     * @param {number} [config.joystickY] - Virtual joystick Y position
     */
    constructor(engine, config = {}) {
        this.engine = engine;

        // Input state
        this.keys = {};
        this.mouseDown = false;
        this.touches = {};

        // Swipe detection
        this.swipe = new SwipeDetector();
        this.lastSwipe = null;

        // Virtual joystick (optional)
        this.virtualJoystick = null;
        if (config.enableVirtualJoystick) {
            this.virtualJoystick = new VirtualJoystick({
                x: config.joystickX || engine.WIDTH * 0.2,
                y: config.joystickY || engine.HEIGHT * 0.8,
                radius: 80
            });
        }

        // Button hit testing
        this.buttons = []; // { x, y, w, h, callback, tag }

        // Passive listeners for performance
        this._setupListeners();
    }

    /**
     * Register a clickable button.
     *
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {Function} callback
     * @param {string} [tag] - Optional identifier
     */
    registerButton(x, y, w, h, callback, tag = null) {
        this.buttons.push({ x, y, w, h, callback, tag });
    }

    /**
     * Setup event listeners.
     * @private
     */
    _setupListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => this._onKeyDown(e), { passive: true });
        window.addEventListener('keyup', (e) => this._onKeyUp(e), { passive: true });

        // Mouse
        window.addEventListener('mousedown', (e) => this._onMouseDown(e), { passive: true });
        window.addEventListener('mousemove', (e) => this._onMouseMove(e), { passive: true });
        window.addEventListener('mouseup', (e) => this._onMouseUp(e), { passive: true });

        // Touch
        window.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
        window.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: true });
        window.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: true });
    }

    // --- Keyboard handlers ---

    _onKeyDown(e) {
        this.keys[e.key] = true;
        this.engine.emit('keydown', { key: e.key });
    }

    _onKeyUp(e) {
        this.keys[e.key] = false;
        this.engine.emit('keyup', { key: e.key });
    }

    // --- Mouse handlers ---

    _onMouseDown(e) {
        this.mouseDown = true;
        const pos = this.engine.screenToWorld(e.clientX, e.clientY);

        this.swipe.start(pos.x, pos.y);
        this._checkButtonPress(pos.x, pos.y);
        this.engine.emit('mousedown', pos);
    }

    _onMouseMove(e) {
        const pos = this.engine.screenToWorld(e.clientX, e.clientY);
        this.engine.emit('mousemove', pos);
    }

    _onMouseUp(e) {
        this.mouseDown = false;
        const pos = this.engine.screenToWorld(e.clientX, e.clientY);
        const swipeData = this.swipe.check(pos.x, pos.y);

        if (swipeData) {
            this.lastSwipe = swipeData;
            this.engine.emit('swipe', swipeData);
        } else {
            this.engine.emit('tap', pos);
        }

        this.swipe.end();
        this.engine.emit('mouseup', pos);
    }

    // --- Touch handlers ---

    _onTouchStart(e) {
        for (const touch of e.touches) {
            const pos = this.engine.screenToWorld(touch.clientX, touch.clientY);
            this.touches[touch.identifier] = { x: pos.x, y: pos.y, id: touch.identifier };

            // Check joystick
            if (this.virtualJoystick && this.virtualJoystick.contains(pos.x, pos.y)) {
                this.virtualJoystick.isActive = true;
                this.virtualJoystick.touchId = touch.identifier;
            }

            // Check buttons
            this._checkButtonPress(pos.x, pos.y);

            this.swipe.start(pos.x, pos.y);
            this.engine.emit('touchstart', pos);
        }
    }

    _onTouchMove(e) {
        for (const touch of e.touches) {
            const pos = this.engine.screenToWorld(touch.clientX, touch.clientY);
            this.touches[touch.identifier] = { x: pos.x, y: pos.y, id: touch.identifier };

            // Update joystick
            if (this.virtualJoystick && this.virtualJoystick.touchId === touch.identifier) {
                this.virtualJoystick.update(pos.x, pos.y);
            }

            this.engine.emit('touchmove', pos);
        }
    }

    _onTouchEnd(e) {
        for (const touch of e.changedTouches) {
            const pos = this.touches[touch.identifier];
            if (pos) {
                const swipeData = this.swipe.check(pos.x, pos.y);
                if (swipeData) {
                    this.lastSwipe = swipeData;
                    this.engine.emit('swipe', swipeData);
                } else {
                    this.engine.emit('tap', pos);
                }
            }

            // Release joystick
            if (this.virtualJoystick && this.virtualJoystick.touchId === touch.identifier) {
                this.virtualJoystick.release();
            }

            delete this.touches[touch.identifier];
            this.swipe.end();
            this.engine.emit('touchend', pos);
        }
    }

    /**
     * Check if any button was pressed.
     * @private
     */
    _checkButtonPress(x, y) {
        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.w &&
                y >= btn.y && y <= btn.y + btn.h) {
                btn.callback({ tag: btn.tag, x, y });
                this.engine.emit('buttonpress', { tag: btn.tag });
                return;
            }
        }
    }

    /**
     * Get input axis value (-1 to 1).
     *
     * @param {string} axis - 'horizontal' or 'vertical'
     * @returns {number}
     */
    getAxis(axis) {
        if (this.virtualJoystick) {
            return axis === 'horizontal' ? this.virtualJoystick.inputX : this.virtualJoystick.inputY;
        }

        // Keyboard fallback
        let value = 0;
        if (axis === 'horizontal') {
            if (this.keys['ArrowLeft'] || this.keys['a']) value -= 1;
            if (this.keys['ArrowRight'] || this.keys['d']) value += 1;
        } else if (axis === 'vertical') {
            if (this.keys['ArrowUp'] || this.keys['w']) value -= 1;
            if (this.keys['ArrowDown'] || this.keys['s']) value += 1;
        }
        return value;
    }

    /**
     * Check if a key is pressed.
     *
     * @param {string} key
     * @returns {boolean}
     */
    isKeyPressed(key) {
        return this.keys[key] || false;
    }

    /**
     * Render virtual joystick (if enabled).
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (this.virtualJoystick) {
            this.virtualJoystick.render(ctx);
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputManager, SwipeDetector, VirtualJoystick };
}

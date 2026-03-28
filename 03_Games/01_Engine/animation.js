// ============================================================================
// ANIMATION SYSTEM — Phase 3
// Sprite Sheets, Frame-based Animation, State-driven Animation Controller
// ============================================================================


// ============================================================================
// SPRITE SHEET — Manages a grid-based sprite atlas
// ============================================================================

class SpriteSheet {
    /**
     * @param {HTMLImageElement|HTMLCanvasElement} source - Image or canvas containing sprite frames
     * @param {number} frameW - Width of each frame in pixels
     * @param {number} frameH - Height of each frame in pixels
     * @param {object} [options]
     * @param {number} [options.cols] - Columns in sheet (auto-calculated if omitted)
     * @param {number} [options.rows] - Rows in sheet (auto-calculated if omitted)
     * @param {number} [options.offsetX=0] - Pixel offset from left edge of source
     * @param {number} [options.offsetY=0] - Pixel offset from top edge of source
     * @param {number} [options.spacingX=0] - Horizontal gap between frames
     * @param {number} [options.spacingY=0] - Vertical gap between frames
     */
    constructor(source, frameW, frameH, options = {}) {
        this.source = source;
        this.frameW = frameW;
        this.frameH = frameH;
        this.offsetX = options.offsetX || 0;
        this.offsetY = options.offsetY || 0;
        this.spacingX = options.spacingX || 0;
        this.spacingY = options.spacingY || 0;

        // Calculate grid dimensions
        const usableW = (source.width || source.naturalWidth) - this.offsetX;
        const usableH = (source.height || source.naturalHeight) - this.offsetY;
        this.cols = options.cols || Math.floor(usableW / (frameW + this.spacingX));
        this.rows = options.rows || Math.floor(usableH / (frameH + this.spacingY));
        this.totalFrames = this.cols * this.rows;
    }

    /**
     * Draw a specific frame index to the canvas context
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} frameIndex - 0-based frame index (left-to-right, top-to-bottom)
     * @param {number} x - Destination X
     * @param {number} y - Destination Y
     * @param {number} [w] - Destination width (defaults to frameW)
     * @param {number} [h] - Destination height (defaults to frameH)
     * @param {boolean} [flipX=false] - Mirror horizontally
     */
    drawFrame(ctx, frameIndex, x, y, w, h, flipX = false) {
        const idx = frameIndex % this.totalFrames;
        const col = idx % this.cols;
        const row = Math.floor(idx / this.cols);

        const sx = this.offsetX + col * (this.frameW + this.spacingX);
        const sy = this.offsetY + row * (this.frameH + this.spacingY);
        const dw = w || this.frameW;
        const dh = h || this.frameH;

        if (flipX) {
            ctx.save();
            ctx.translate(x + dw, y);
            ctx.scale(-1, 1);
            ctx.drawImage(this.source, sx, sy, this.frameW, this.frameH, 0, 0, dw, dh);
            ctx.restore();
        } else {
            ctx.drawImage(this.source, sx, sy, this.frameW, this.frameH, x, y, dw, dh);
        }
    }
}


// ============================================================================
// ANIMATION CLIP — Defines a named sequence of frames with timing
// ============================================================================

class AnimationClip {
    /**
     * @param {string} name - Clip identifier (e.g. 'idle', 'run', 'jump')
     * @param {object} config
     * @param {number[]} config.frames - Array of frame indices from the sprite sheet
     * @param {number} [config.fps=10] - Playback speed in frames per second
     * @param {boolean} [config.loop=true] - Whether to loop
     * @param {string} [config.next=null] - Clip to transition to when non-looping clip ends
     * @param {Function} [config.onComplete=null] - Callback when non-looping clip finishes
     */
    constructor(name, config) {
        this.name = name;
        this.frames = config.frames || [0];
        this.fps = config.fps || 10;
        this.loop = config.loop !== undefined ? config.loop : true;
        this.next = config.next || null;
        this.onComplete = config.onComplete || null;
    }

    get duration() {
        return this.frames.length / this.fps;
    }
}


// ============================================================================
// ANIMATION CONTROLLER — State-driven animation switching + playback
// ============================================================================

class AnimationController {
    /**
     * @param {SpriteSheet} spriteSheet - The sprite sheet to draw from
     */
    constructor(spriteSheet) {
        this.spriteSheet = spriteSheet;
        this.clips = {};           // name -> AnimationClip
        this.currentClip = null;   // active AnimationClip
        this.frameTime = 0;        // time accumulated in current frame
        this.frameIndex = 0;       // index within clip's frames array
        this.finished = false;     // true when non-looping clip completes
        this.speed = 1;            // playback speed multiplier

        // State mapping: entity state -> clip name
        this._stateMap = {};
    }

    /**
     * Register an animation clip
     * @param {AnimationClip} clip
     * @returns {AnimationController} this (for chaining)
     */
    addClip(clip) {
        this.clips[clip.name] = clip;
        return this;
    }

    /**
     * Convenience: add clip from config object
     * @param {string} name
     * @param {number[]} frames
     * @param {object} [options]
     * @returns {AnimationController}
     */
    define(name, frames, options = {}) {
        return this.addClip(new AnimationClip(name, {
            frames,
            fps: options.fps || 10,
            loop: options.loop !== undefined ? options.loop : true,
            next: options.next || null,
            onComplete: options.onComplete || null
        }));
    }

    /**
     * Map entity states to clip names
     * @param {object} map - e.g. { idle: 'idle', run: 'run', jump: 'jump_up', fall: 'fall' }
     * @returns {AnimationController}
     */
    mapStates(map) {
        this._stateMap = { ...this._stateMap, ...map };
        return this;
    }

    /**
     * Play a specific clip by name (if not already playing)
     * @param {string} name
     * @param {boolean} [force=false] - Restart even if already playing
     */
    play(name, force = false) {
        if (!this.clips[name]) return;
        if (!force && this.currentClip && this.currentClip.name === name) return;

        this.currentClip = this.clips[name];
        this.frameIndex = 0;
        this.frameTime = 0;
        this.finished = false;
    }

    /**
     * Update animation from entity state (call each frame)
     * @param {string} entityState - e.g. 'idle', 'run', 'jump', 'fall'
     */
    syncToState(entityState) {
        const clipName = this._stateMap[entityState];
        if (clipName) {
            this.play(clipName);
        }
    }

    /**
     * Advance animation timer
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (!this.currentClip || this.finished) return;

        this.frameTime += dt * this.speed;
        const frameDuration = 1 / this.currentClip.fps;

        while (this.frameTime >= frameDuration) {
            this.frameTime -= frameDuration;
            this.frameIndex++;

            if (this.frameIndex >= this.currentClip.frames.length) {
                if (this.currentClip.loop) {
                    this.frameIndex = 0;
                } else {
                    this.frameIndex = this.currentClip.frames.length - 1;
                    this.finished = true;

                    if (this.currentClip.onComplete) {
                        this.currentClip.onComplete();
                    }
                    // Auto-transition to next clip
                    if (this.currentClip.next) {
                        this.play(this.currentClip.next);
                    }
                    break;
                }
            }
        }
    }

    /**
     * Get the current sprite sheet frame index
     * @returns {number}
     */
    get currentFrame() {
        if (!this.currentClip) return 0;
        return this.currentClip.frames[this.frameIndex] || 0;
    }

    /**
     * Draw current frame to canvas
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} [w]
     * @param {number} [h]
     * @param {boolean} [flipX=false]
     */
    draw(ctx, x, y, w, h, flipX = false) {
        if (!this.spriteSheet || !this.currentClip) return;
        this.spriteSheet.drawFrame(ctx, this.currentFrame, x, y, w, h, flipX);
    }
}


// ============================================================================
// PROCEDURAL SPRITE GENERATOR — Creates placeholder sprite sheets via canvas
// Useful for prototyping before real art assets exist
// ============================================================================

class ProceduralSprites {
    /**
     * Generate a sprite sheet canvas with procedural character frames
     * @param {object} config
     * @param {number} config.frameW - Frame width
     * @param {number} config.frameH - Frame height
     * @param {number} config.cols - Columns in sheet
     * @param {number} config.rows - Rows in sheet
     * @param {string} [config.bodyColor='#00e5ff']
     * @param {string} [config.eyeColor='#fff']
     * @param {Function} [config.drawFrame] - Custom draw function(ctx, frameIndex, x, y, w, h)
     * @returns {{ canvas: HTMLCanvasElement, sheet: SpriteSheet }}
     */
    static generateCharacter(config) {
        const { frameW, frameH, cols, rows } = config;
        const bodyColor = config.bodyColor || '#00e5ff';
        const eyeColor = config.eyeColor || '#fff';

        const canvas = document.createElement('canvas');
        canvas.width = frameW * cols;
        canvas.height = frameH * rows;
        const ctx = canvas.getContext('2d');

        // If custom draw function provided, use it
        if (config.drawFrame) {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const idx = r * cols + c;
                    config.drawFrame(ctx, idx, c * frameW, r * frameH, frameW, frameH);
                }
            }
            return {
                canvas,
                sheet: new SpriteSheet(canvas, frameW, frameH, { cols, rows })
            };
        }

        // Default procedural character:
        // Row 0: Idle (4 frames — subtle bob)
        // Row 1: Run  (6 frames — leg animation)
        // Row 2: Jump (2 frames — up + apex)
        // Row 3: Fall (2 frames — down + anticipation)

        const drawBody = (x, y, w, h, yOffset = 0) => {
            const bx = x + w * 0.2;
            const by = y + h * 0.15 + yOffset;
            const bw = w * 0.6;
            const bh = h * 0.55;

            // Body
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 4);
            ctx.fill();

            // Eye
            ctx.fillStyle = eyeColor;
            ctx.fillRect(bx + bw * 0.55, by + bh * 0.2, bw * 0.18, bh * 0.15);

            return { bx, by, bw, bh };
        };

        const drawLegs = (x, y, w, h, leftAngle, rightAngle, yOff = 0) => {
            const legW = w * 0.12;
            const legH = h * 0.25;
            const baseY = y + h * 0.7 + yOff;

            // Left leg
            ctx.fillStyle = bodyColor;
            ctx.save();
            ctx.translate(x + w * 0.35, baseY);
            ctx.rotate(leftAngle);
            ctx.fillRect(-legW / 2, 0, legW, legH);
            ctx.restore();

            // Right leg
            ctx.save();
            ctx.translate(x + w * 0.65, baseY);
            ctx.rotate(rightAngle);
            ctx.fillRect(-legW / 2, 0, legW, legH);
            ctx.restore();
        };

        // Row 0: Idle frames (subtle breathing bob)
        for (let i = 0; i < cols; i++) {
            const fx = i * frameW;
            const yBob = Math.sin(i / cols * Math.PI * 2) * 2;
            drawBody(fx, 0, frameW, frameH, yBob);
            drawLegs(fx, 0, frameW, frameH, 0, 0, yBob);
        }

        // Row 1: Run frames (leg cycling)
        if (rows > 1) {
            for (let i = 0; i < cols; i++) {
                const fx = i * frameW;
                const fy = frameH;
                const phase = (i / cols) * Math.PI * 2;
                const yBob = Math.abs(Math.sin(phase)) * -3;
                drawBody(fx, fy, frameW, frameH, yBob);
                drawLegs(fx, fy, frameW, frameH,
                    Math.sin(phase) * 0.5,
                    Math.sin(phase + Math.PI) * 0.5,
                    yBob
                );
            }
        }

        // Row 2: Jump frames
        if (rows > 2) {
            for (let i = 0; i < cols; i++) {
                const fx = i * frameW;
                const fy = frameH * 2;
                // Squash at start, stretch at apex
                const t = i / Math.max(cols - 1, 1);
                const yOff = -4 * t;
                drawBody(fx, fy, frameW, frameH, yOff);
                // Legs tucked
                drawLegs(fx, fy, frameW, frameH, -0.3 - t * 0.2, 0.3 + t * 0.2, yOff);
            }
        }

        // Row 3: Fall frames
        if (rows > 3) {
            for (let i = 0; i < cols; i++) {
                const fx = i * frameW;
                const fy = frameH * 3;
                const t = i / Math.max(cols - 1, 1);
                drawBody(fx, fy, frameW, frameH, 2 * t);
                // Legs spread
                drawLegs(fx, fy, frameW, frameH, -0.4, 0.4, 2 * t);
            }
        }

        return {
            canvas,
            sheet: new SpriteSheet(canvas, frameW, frameH, { cols, rows })
        };
    }
}


// ============================================================================
// ANIMATED ENTITY MIXIN — Adds animation to any Entity subclass
// ============================================================================

/**
 * Attach animation capabilities to an existing entity
 * @param {Entity} entity - Entity instance to enhance
 * @param {AnimationController} controller - Configured animation controller
 */
function attachAnimation(entity, controller) {
    entity.animator = controller;

    // Store original render
    const _origRender = entity.render.bind(entity);

    entity.render = function(ctx, alpha) {
        if (!this.animator || !this.animator.currentClip) {
            // Fallback to original render
            _origRender(ctx, alpha);
            return;
        }

        const rx = this.lerpX(alpha);
        const ry = this.lerpY(alpha);
        const flipX = this.facing === -1;

        this.animator.draw(ctx, rx, ry, this.width, this.height, flipX);

        // Debug: state label
        if (this.engine && this.engine.debug) {
            ctx.fillStyle = '#ff0';
            ctx.font = '10px monospace';
            ctx.fillText(this.state, rx, ry - 4);
        }
    };

    // Hook into update to advance animation
    const _origUpdate = entity.update ? entity.update.bind(entity) : null;

    entity.update = function(dt) {
        if (_origUpdate) _origUpdate(dt);

        if (this.animator) {
            // Sync animation clip to entity state
            this.animator.syncToState(this.state);
            this.animator.update(dt);
        }
    };
}


// ============================================================================
// UTILITY — Load image as Promise
// ============================================================================

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
    });
}


// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SpriteSheet,
        AnimationClip,
        AnimationController,
        ProceduralSprites,
        attachAnimation,
        loadImage
    };
}

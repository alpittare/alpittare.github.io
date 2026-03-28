// ============================================================================
// CRICKET PHYSICS ENGINE — Sport-Specific Module
// Ball Delivery, Batting Mechanics, Scoring, Trajectory, Fielding
// Built on top of core.js Entity system
// ============================================================================

'use strict';


// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CricketConfig = {
    // --- Field dimensions (relative to 414x896 canvas) ----------------------
    field: {
        pitchTop: 120,           // bowler's crease Y
        pitchBottom: 730,        // batsman's crease Y
        pitchWidth: 80,          // pitch strip width
        batsmanY: 730,           // batsman standing position
        batsmanX: 207,           // center of pitch
        stumpX: 207,             // stump center
        stumpWidth: 28,          // stumps width
    },

    // --- Ball physics -------------------------------------------------------
    ball: {
        radius: 10,
        gravity: 0.15,           // post-hit parabolic gravity (px/frame²)
        hitShrinkRate: 0.985,    // perspective shrinking per frame
        swingDecay: 0.97,        // pre-hit swing attenuation/frame
        lineDrift: 0.005,        // horizontal drift multiplier toward line
    },

    // --- Ball speeds by difficulty ------------------------------------------
    speeds: {
        easy:   { min: 2, max: 3 },
        medium: { min: 3, max: 4.5 },
        hard:   { min: 4, max: 6 },
        legend: { min: 5, max: 8 },
    },

    // --- Ball types (delivery variations) -----------------------------------
    ballTypes: [
        { name: 'fast',    speedMul: 1.0,  swing: 0,   spin: 0   },
        { name: 'medium',  speedMul: 0.9,  swing: 0.5, spin: 0   },
        { name: 'spin',    speedMul: 0.75, swing: 1.5, spin: 1.5 },
        { name: 'yorker',  speedMul: 1.05, swing: 0.2, spin: 0   },
        { name: 'bouncer', speedMul: 0.85, swing: 0,   spin: 0   },
        { name: 'slower',  speedMul: 0.6,  swing: 0.3, spin: 0.5 },
    ],

    // --- Bowl lengths -------------------------------------------------------
    lengths: {
        short:  { speedMul: 0.8,  swingMul: 0.5, label: 'Short' },
        good:   { speedMul: 1.0,  swingMul: 1.0, label: 'Good Length' },
        yorker: { speedMul: 1.15, swingMul: 0.3, label: 'Yorker' },
    },

    // --- Bowl lines (horizontal offset from center) -------------------------
    lines: {
        left:   { xOffset: -25, label: 'Outside Off' },
        center: { xOffset: 0,   label: 'Middle Stump' },
        right:  { xOffset: 25,  label: 'Outside Leg' },
    },

    // --- Timing zones (ball Y position for quality assessment) ---------------
    timingZones: {
        perfect: { min: 690, max: 745 },
        good:    { min: 655, max: 690, min2: 745, max2: 775 },
        edge:    { min: 620, max: 655, min2: 775, max2: 810 },
    },

    // --- Hit detection box --------------------------------------------------
    hitZone: {
        dx: 70,   // horizontal detection radius (px)
        dy: 90,   // vertical detection radius (px)
    },

    // --- Swipe thresholds ---------------------------------------------------
    swipe: {
        minDist: 25,             // min px to trigger shot vs. defend
        powerNorm: 80,           // px distance for power=1.0
    },

    // --- AI level scaling ---------------------------------------------------
    levelScaling: {
        speedPerLevel: 0.015,    // +1.5%/level
        speedCap: 0.30,          // max +30%
        swingPerLevel: 0.01,     // +1%/level
        swingCap: 0.20,          // max +20%
    },
};


// ============================================================================
// DELIVERY SYSTEM — Generates ball deliveries with type, length, line
// ============================================================================

class DeliverySystem {
    constructor(config = {}) {
        this.difficulty = config.difficulty || 'medium';
        this.level = config.level || 1;
        this.fatigueMul = 1.0;   // bowler fatigue affects speed
    }

    /**
     * Generate a delivery configuration
     * @param {object} [overrides] - Force specific type/length/line
     * @returns {object} delivery descriptor
     */
    generate(overrides = {}) {
        const types = CricketConfig.ballTypes;
        const ballType = overrides.type
            ? types.find(t => t.name === overrides.type) || types[0]
            : types[Math.floor(Math.random() * types.length)];

        const lengthKeys = Object.keys(CricketConfig.lengths);
        const lengthKey = overrides.length || lengthKeys[Math.floor(Math.random() * lengthKeys.length)];
        const lengthData = CricketConfig.lengths[lengthKey];

        const lineKeys = Object.keys(CricketConfig.lines);
        const lineKey = overrides.line || lineKeys[Math.floor(Math.random() * lineKeys.length)];
        const lineData = CricketConfig.lines[lineKey];

        // Level scaling
        const lvl = this.level;
        const ls = CricketConfig.levelScaling;
        const levelSpeed = 1.0 + Math.min(lvl * ls.speedPerLevel, ls.speedCap);
        const levelSwing = 1.0 + Math.min(lvl * ls.swingPerLevel, ls.swingCap);

        // Speed calculation
        const speeds = CricketConfig.speeds[this.difficulty] || CricketConfig.speeds.medium;
        const baseSpeed = speeds.min + Math.random() * (speeds.max - speeds.min);
        const finalSpeed = baseSpeed * ballType.speedMul * lengthData.speedMul * this.fatigueMul * levelSpeed;

        // Swing calculation
        const swingAmount = (ballType.swing + ballType.spin) *
            lengthData.swingMul * levelSwing * (0.7 + Math.random() * 0.6);
        const swingDir = Math.random() > 0.5 ? 1 : -1;

        return {
            ballType,
            length: { key: lengthKey, ...lengthData },
            line: { key: lineKey, ...lineData },
            speed: Math.max(1.5, Math.min(10, finalSpeed)),
            swing: swingDir * swingAmount,
            lineOffset: lineData.xOffset,
        };
    }
}


// ============================================================================
// CRICKET BALL — Entity with bowling + post-hit trajectory physics
// ============================================================================

class CricketBall extends Entity {
    constructor() {
        super(0, 0);
        this.tag = 'cricket-ball';
        this.width = CricketConfig.ball.radius * 2;
        this.height = CricketConfig.ball.radius * 2;
        this.z = 20;

        // Ball state
        this.radius = CricketConfig.ball.radius;
        this.speedY = 0;
        this.speedX = 0;
        this.swing = 0;
        this.active = false;
        this.hit = false;
        this.hitVx = 0;
        this.hitVy = 0;
        this.resultGiven = false;

        // Delivery reference
        this.delivery = null;
    }

    /**
     * Launch a new delivery
     * @param {object} delivery - from DeliverySystem.generate()
     */
    bowl(delivery) {
        this.delivery = delivery;
        this.x = CricketConfig.field.batsmanX + delivery.lineOffset;
        this.y = CricketConfig.field.pitchTop;
        this.speedY = delivery.speed;
        this.speedX = delivery.lineOffset * CricketConfig.ball.lineDrift;
        this.swing = delivery.swing;
        this.radius = CricketConfig.ball.radius;
        this.hit = false;
        this.hitVx = 0;
        this.hitVy = 0;
        this.resultGiven = false;
        this.active = true;
    }

    /**
     * Apply a hit result to the ball
     * @param {object} hitResult - from BattingSystem.processHit()
     */
    applyHit(hitResult) {
        this.hit = true;
        this.hitVx = hitResult.hitVx;
        this.hitVy = hitResult.hitVy;
    }

    fixedUpdate(dt) {
        if (!this.active) return;
        this.prevX = this.x;
        this.prevY = this.y;

        if (!this.hit) {
            // Pre-hit: ball traveling toward batsman
            this.y += this.speedY;
            this.x += this.speedX + this.swing * 0.01;

            // Swing decay
            if (Math.abs(this.swing) > 0.05) {
                this.swing *= CricketConfig.ball.swingDecay;
            }
        } else {
            // Post-hit: parabolic trajectory
            this.x += this.hitVx;
            this.y += this.hitVy;
            this.hitVy += CricketConfig.ball.gravity;
            this.radius *= CricketConfig.ball.hitShrinkRate;
        }
    }

    /**
     * Check if ball is in the batting hit zone
     * @param {number} batsmanX
     * @param {number} batsmanY
     * @returns {boolean}
     */
    isInHitZone(batsmanX, batsmanY) {
        if (this.hit || !this.active) return false;
        const dx = Math.abs(this.x - batsmanX);
        const dy = Math.abs(this.y - batsmanY);
        return dx < CricketConfig.hitZone.dx && dy < CricketConfig.hitZone.dy;
    }

    /**
     * Check if ball has passed the batsman (missed/bowled)
     * @returns {boolean}
     */
    isPastBatsman() {
        return !this.hit && this.y > CricketConfig.field.batsmanY + 60;
    }

    /**
     * Check if ball is off screen (post-hit trajectory complete)
     * @param {number} canvasW
     * @param {number} canvasH
     * @returns {boolean}
     */
    isOffScreen(canvasW, canvasH) {
        return this.x < -50 || this.x > canvasW + 50 ||
               this.y < -50 || this.y > canvasH + 50;
    }

    render(ctx, alpha) {
        if (!this.active) return;
        const rx = this.lerpX(alpha);
        const ry = this.lerpY(alpha);

        // Shadow
        if (!this.hit) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(rx + 3, ry + 3, this.radius, this.radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Ball
        ctx.fillStyle = '#cc2200';
        ctx.beginPath();
        ctx.arc(rx, ry, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Seam highlight
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rx, ry, this.radius * 0.5, 0, Math.PI);
        ctx.stroke();
    }
}


// ============================================================================
// SHOT TYPES — Direction-based shot classification
// ============================================================================

const ShotTypes = {
    LOFT:   { name: 'LOFT',   minRuns: 4, sixChance: 0.65, angleMin: -120, angleMax: -60 },
    DRIVE:  { name: 'DRIVE',  minRuns: 2, sixChance: 0.30, angleMin: -60,  angleMax: -15 },
    CUT:    { name: 'CUT',    minRuns: 2, sixChance: 0.10, angleMin: -15,  angleMax: 45 },
    PULL:   { name: 'PULL',   minRuns: 2, sixChance: 0.10, angleMin: 135,  angleMax: 180 },
    SWEEP:  { name: 'SWEEP',  minRuns: 1, sixChance: 0.05, angleMin: 45,   angleMax: 135 },
    DEFEND: { name: 'DEFEND', minRuns: 0, sixChance: 0.00 },
};

/**
 * Classify shot from swipe angle (degrees)
 * @param {number} angle - Swipe angle in degrees (-180 to 180)
 * @param {number} distance - Swipe distance in pixels
 * @returns {object} Shot type descriptor
 */
function classifyShot(angle, distance) {
    if (distance < CricketConfig.swipe.minDist) return ShotTypes.DEFEND;

    const deg = angle * (180 / Math.PI);
    if (deg >= -120 && deg < -60) return ShotTypes.LOFT;
    if ((deg >= -60 && deg < -15) || (deg >= -180 && deg < -120)) return ShotTypes.DRIVE;
    if (deg >= -15 && deg < 45) return ShotTypes.CUT;
    if (deg >= 135 || deg < -180 + 45) return ShotTypes.PULL;
    if (deg >= 45 && deg < 135) return ShotTypes.SWEEP;
    return ShotTypes.DEFEND;
}


// ============================================================================
// BATTING SYSTEM — Hit processing, timing quality, run calculation
// ============================================================================

class BattingSystem {
    constructor() {
        this.surgeMultiplier = 1.0;  // external multiplier (surge/power play)
    }

    /**
     * Evaluate timing quality based on ball Y position at hit time
     * @param {number} ballY - Ball's Y position when swing triggered
     * @returns {string} 'perfect' | 'good' | 'edge' | 'miss'
     */
    evaluateTiming(ballY) {
        const tz = CricketConfig.timingZones;
        if (ballY >= tz.perfect.min && ballY <= tz.perfect.max) return 'perfect';
        if ((ballY >= tz.good.min && ballY < tz.good.max) ||
            (ballY > tz.good.min2 && ballY <= tz.good.max2)) return 'good';
        if ((ballY >= tz.edge.min && ballY < tz.edge.max) ||
            (ballY > tz.edge.min2 && ballY <= tz.edge.max2)) return 'edge';
        return 'miss';
    }

    /**
     * Process a batting action
     * @param {CricketBall} ball
     * @param {object} swipe - { angle: radians, distance: px }
     * @returns {object} { runs, quality, shotType, wasCaught, hitVx, hitVy, hitAngle }
     */
    processHit(ball, swipe) {
        const quality = this.evaluateTiming(ball.y);
        const shotType = classifyShot(swipe.angle, swipe.distance);
        const swipePower = Math.min(swipe.distance / CricketConfig.swipe.powerNorm, 1.0);

        let runs = 0;
        let wasCaught = false;

        // --- Run calculation by quality + shot type ---
        if (quality === 'perfect') {
            runs = this._perfectRuns(shotType, swipePower);
        } else if (quality === 'good') {
            runs = this._goodRuns(shotType, swipePower);
        } else if (quality === 'edge') {
            const catchResult = this._edgeRuns(shotType);
            runs = catchResult.runs;
            wasCaught = catchResult.caught;
        } else {
            runs = this._missRuns(shotType);
        }

        // Apply surge multiplier
        if (this.surgeMultiplier > 1.0 && runs > 0) {
            runs = Math.ceil(runs * this.surgeMultiplier);
        }

        // --- Hit trajectory calculation ---
        const hitAngle = Math.cos(swipe.angle) * 0.8 + (Math.random() - 0.5) * 0.3;
        const { hitVx, hitVy } = this._hitTrajectory(runs, hitAngle, wasCaught);

        return { runs, quality, shotType, wasCaught, hitVx, hitVy, hitAngle };
    }

    _perfectRuns(shot, power) {
        if (shot === ShotTypes.LOFT) return Math.random() < (0.55 + power * 0.25) ? 6 : 4;
        if (shot === ShotTypes.DRIVE) return Math.random() < 0.55 ? 4 : (Math.random() < 0.3 ? 6 : 2);
        if (shot === ShotTypes.CUT || shot === ShotTypes.PULL) return Math.random() < 0.5 ? 4 : 2;
        if (shot === ShotTypes.SWEEP) return Math.random() < 0.4 ? 4 : 2;
        return Math.random() < 0.3 ? 2 : 1;  // DEFEND
    }

    _goodRuns(shot, power) {
        if (shot === ShotTypes.LOFT) return Math.random() < 0.35 ? 6 : (Math.random() < 0.5 ? 4 : 2);
        if (shot === ShotTypes.DRIVE) return Math.random() < 0.45 ? 4 : 2;
        if (shot === ShotTypes.CUT || shot === ShotTypes.PULL) return Math.random() < 0.35 ? 4 : 2;
        if (shot === ShotTypes.SWEEP) return Math.random() < 0.3 ? 2 : 1;
        return 1;
    }

    _edgeRuns(shot) {
        // 12% catch probability on edges
        if (Math.random() < 0.12) {
            return { runs: 0, caught: true };
        }
        return { runs: Math.random() > 0.7 ? 2 : 1, caught: false };
    }

    _missRuns(shot) {
        if (shot === ShotTypes.DEFEND) return Math.random() < 0.4 ? 1 : 0;
        if (shot === ShotTypes.LOFT) return Math.random() < 0.15 ? 2 : 0;
        return Math.random() < 0.25 ? 1 : 0;
    }

    /**
     * Calculate post-hit ball velocity based on runs scored
     */
    _hitTrajectory(runs, hitAngle, wasCaught) {
        let hitVx, hitVy;

        if (wasCaught) {
            hitVx = (Math.random() - 0.5) * 3;
            hitVy = -5 - Math.random() * 2;
        } else if (runs >= 6) {
            hitVx = hitAngle * 6;
            hitVy = -10 - Math.random() * 3;
        } else if (runs >= 4) {
            hitVx = hitAngle * 5;
            hitVy = -7 - Math.random() * 2;
        } else if (runs >= 2) {
            hitVx = hitAngle * 3;
            hitVy = -4 - Math.random() * 2;
        } else {
            hitVx = hitAngle * 1.5;
            hitVy = -1.5 - Math.random() * 0.5;
        }

        return { hitVx, hitVy };
    }
}


// ============================================================================
// SURGE SYSTEM — Run multiplier progression
// ============================================================================

class SurgeSystem {
    constructor() {
        this.progress = 0;       // 0.0 - 1.0
        this.activeTier = null;  // current surge tier
        this.tiers = [
            { threshold: 0.25, name: 'POWER PLAY',  multiplier: 1.3, color: '#27ae60' },
            { threshold: 0.50, name: 'SUPER OVER',  multiplier: 1.6, color: '#f39c12' },
            { threshold: 0.75, name: 'ULTRA SMASH',  multiplier: 2.0, color: '#e67e22' },
            { threshold: 1.00, name: 'LEGEND MODE',  multiplier: 2.5, color: '#c0392b' },
        ];
    }

    /**
     * Add progress based on runs scored
     * @param {number} runs
     */
    addProgress(runs) {
        if (runs >= 6) this.progress += 0.12;
        else if (runs >= 4) this.progress += 0.06;
        else if (runs >= 2) this.progress += 0.03;
        else if (runs >= 1) this.progress += 0.02;

        this.progress = Math.min(1.0, this.progress);
        this._updateTier();
    }

    _updateTier() {
        this.activeTier = null;
        for (let i = this.tiers.length - 1; i >= 0; i--) {
            if (this.progress >= this.tiers[i].threshold) {
                this.activeTier = this.tiers[i];
                break;
            }
        }
    }

    get multiplier() {
        return this.activeTier ? this.activeTier.multiplier : 1.0;
    }

    reset() {
        this.progress = 0;
        this.activeTier = null;
    }
}


// ============================================================================
// INNINGS MANAGER — Overs, balls, wickets tracking
// ============================================================================

class InningsManager {
    constructor(config = {}) {
        this.maxOvers = config.overs || 10;
        this.maxWickets = config.wickets || 3;
        this.reset();
    }

    reset() {
        this.runs = 0;
        this.wickets = 0;
        this.oversCompleted = 0;
        this.ballsInOver = 0;
        this.ballsFaced = 0;
        this.fours = 0;
        this.sixes = 0;
        this.dots = 0;
        this.ballLog = [];       // per-ball history
    }

    /**
     * Record a ball result
     * @param {object} result - { runs, wasCaught, shotType, quality }
     * @returns {object} { overComplete, inningsComplete, reason }
     */
    recordBall(result) {
        this.ballsFaced++;
        this.ballsInOver++;

        // Score
        this.runs += result.runs;
        if (result.runs === 0) this.dots++;
        if (result.runs === 4) this.fours++;
        if (result.runs >= 6) this.sixes++;

        // Wicket
        if (result.wasCaught) {
            this.wickets++;
        }

        this.ballLog.push({
            ball: this.ballsFaced,
            over: this.oversCompleted,
            ballInOver: this.ballsInOver,
            ...result,
        });

        let overComplete = false;
        let inningsComplete = false;
        let reason = null;

        // Over boundary
        if (this.ballsInOver >= 6) {
            this.oversCompleted++;
            this.ballsInOver = 0;
            overComplete = true;
        }

        // Innings end conditions
        if (this.wickets >= this.maxWickets) {
            inningsComplete = true;
            reason = 'all_out';
        } else if (this.oversCompleted >= this.maxOvers) {
            inningsComplete = true;
            reason = 'overs_complete';
        }

        return { overComplete, inningsComplete, reason };
    }

    get overString() {
        return `${this.oversCompleted}.${this.ballsInOver}`;
    }

    get scoreString() {
        return `${this.runs}/${this.wickets}`;
    }
}


// ============================================================================
// SWIPE DETECTOR — Touch/mouse swipe input for batting
// ============================================================================

class SwipeDetector {
    constructor(canvas) {
        this.canvas = canvas;
        this._startX = 0;
        this._startY = 0;
        this._startTime = 0;
        this._active = false;
        this.onSwipe = null;     // callback: (swipeData) => void

        this._bindEvents();
    }

    _bindEvents() {
        const c = this.canvas;
        c.addEventListener('touchstart', (e) => this._onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        c.addEventListener('touchend', (e) => this._onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY));
        c.addEventListener('mousedown', (e) => this._onStart(e.clientX, e.clientY));
        c.addEventListener('mouseup', (e) => this._onEnd(e.clientX, e.clientY));
    }

    _onStart(x, y) {
        this._startX = x;
        this._startY = y;
        this._startTime = performance.now();
        this._active = true;
    }

    _onEnd(x, y) {
        if (!this._active) return;
        this._active = false;

        const dx = x - this._startX;
        const dy = y - this._startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const duration = performance.now() - this._startTime;

        if (this.onSwipe) {
            this.onSwipe({ dx, dy, distance, angle, duration });
        }
    }
}


// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CricketConfig,
        DeliverySystem,
        CricketBall,
        ShotTypes,
        classifyShot,
        BattingSystem,
        SurgeSystem,
        InningsManager,
        SwipeDetector,
    };
}

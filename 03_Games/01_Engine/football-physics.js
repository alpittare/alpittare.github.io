// ============================================================================
// FOOTBALL (SOCCER) PHYSICS ENGINE — Sport-Specific Module
// Ball Kick, Curve/Spin, Goal Detection, Goalkeeper AI, Difficulty Scaling
// Built on top of core.js Entity system
// ============================================================================

'use strict';


// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const FootballConfig = {
    // --- Field dimensions (relative to 414x832 canvas) ----------------------
    field: {
        width: 414,
        height: 832,
        top: 80,
        bottom: 700,
        goalWidth: 200,
        goalHeight: 60,
        goalPostWidth: 8,
        goalLineY: 72,
        crossbarY: 17,
        goalCenterX: 207,        // center of goal (414/2)
    },

    // --- Ball physics -------------------------------------------------------
    ball: {
        radius: 12,
        shotSpeed: 18,           // base speed (px/frame)
        friction: 0.995,         // velocity decay/frame
        curveDecay: 0.97,        // curve force decay/frame
        heightGravity: 0.25,     // chip shot gravity (px/frame²)
        maxHeight: 12,           // cap height for chip shots
        chipThreshold: 0.85,     // power threshold to trigger chip
        trailMax: 80,            // max trail particles
        trailDecay: 0.06,        // trail alpha decay rate
    },

    // --- Player/Kicker ------------------------------------------------------
    kicker: {
        x: 207,                  // center
        y: 600,                  // bottom area
        aimOscSpeed: 0.025,      // aim oscillation speed
        aimOscRange: 0.33,       // fraction of goalWidth for oscillation
        powerChargeRate: 0.02,   // power gauge speed (0-1 per frame)
        minPower: 0.3,           // minimum kick power
        curveScale: 0.5,         // lateral input → curve force scale
    },

    // --- Goalkeeper ---------------------------------------------------------
    keeper: {
        width: 50,
        height: 70,
        idleSwaySpeed: 0.03,
        idleSwayAmount: 15,
        diveDuration: 0.04,      // default dive speed (progress/frame)
        armReach: 45,            // extra reach from arm extension
        diveYBonus: 15,          // forward reach bonus during dive
    },

    // --- Difficulty configs -------------------------------------------------
    difficulties: {
        easy: {
            maxRounds: 8,
            reactionDelayMs: 260,
            predictionError: 0.48,
            missChance: 0.28,
            diveSpeed: 0.05,
            saveReach: 0.72,
            positionAccuracy: 0.40,
            overcommitChance: 0.22,
            earlyDiveBonus: 0,
        },
        medium: {
            maxRounds: 10,
            reactionDelayMs: 180,
            predictionError: 0.28,
            missChance: 0.12,
            diveSpeed: 0.07,
            saveReach: 0.90,
            positionAccuracy: 0.65,
            overcommitChance: 0.12,
            earlyDiveBonus: 0.1,
        },
        hard: {
            maxRounds: 12,
            reactionDelayMs: 90,
            predictionError: 0.10,
            missChance: 0.05,
            diveSpeed: 0.10,
            saveReach: 1.02,
            positionAccuracy: 0.85,
            overcommitChance: 0.05,
            earlyDiveBonus: 0.30,
        },
        legend: {
            maxRounds: 15,
            reactionDelayMs: 50,
            predictionError: 0.05,
            missChance: 0.02,
            diveSpeed: 0.13,
            saveReach: 1.10,
            positionAccuracy: 0.94,
            overcommitChance: 0.02,
            earlyDiveBonus: 0.45,
        },
    },
};


// ============================================================================
// UTILITY — Math helpers
// ============================================================================

const FBUtils = {
    clamp(val, min, max) { return Math.max(min, Math.min(max, val)); },
    lerp(a, b, t) { return a + (b - a) * t; },
    angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
    dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); },
    randRange(min, max) { return min + Math.random() * (max - min); },
    randInt(min, max) { return Math.floor(FBUtils.randRange(min, max + 1)); },
    easeOutCubic(t) { return 1 - (1 - t) ** 3; },
};


// ============================================================================
// FOOTBALL — Ball entity with kick, curve, height, trail physics
// ============================================================================

class Football extends Entity {
    constructor() {
        super(0, 0);
        this.tag = 'football';
        this.z = 15;
        this.radius = FootballConfig.ball.radius;
        this.width = this.radius * 2;
        this.height = this.radius * 2;

        // Physics state
        this.vx = 0;
        this.vy = 0;
        this.ballHeight = 0;     // simulated Z-height for chip shots
        this.heightVel = 0;
        this.spinAngle = 0;
        this.curveForce = 0;
        this.active = false;
        this.surgeMode = false;
        this.surgeLevel = 0;

        // Trail
        this.trail = [];

        // Shadow
        this.shadow = { x: 0, y: 0, scale: 1 };
    }

    reset() {
        this.x = FootballConfig.field.goalCenterX;
        this.y = FootballConfig.kicker.y;
        this.vx = 0;
        this.vy = 0;
        this.ballHeight = 0;
        this.heightVel = 0;
        this.spinAngle = 0;
        this.curveForce = 0;
        this.active = false;
        this.trail = [];
    }

    /**
     * Launch the ball toward a target
     * @param {number} angle - direction in radians
     * @param {number} power - 0..1 normalized
     * @param {number} [curve=0] - lateral curve force
     */
    shoot(angle, power, curve = 0) {
        const cfg = FootballConfig.ball;
        const speed = cfg.shotSpeed * FBUtils.clamp(power, FootballConfig.kicker.minPower, 1.0);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.curveForce = curve * 0.3;
        this.active = true;

        // Chip shot at high power
        if (power > cfg.chipThreshold) {
            this.heightVel = (power - cfg.chipThreshold) * 20;
        }
    }

    fixedUpdate(dt) {
        if (!this.active) return;
        this.prevX = this.x;
        this.prevY = this.y;

        const cfg = FootballConfig.ball;

        // Curve (Magnus-like lateral force)
        this.vx += this.curveForce;
        this.curveForce *= cfg.curveDecay;

        // Position
        this.x += this.vx;
        this.y += this.vy;

        // Height (chip simulation)
        this.ballHeight += this.heightVel;
        this.heightVel -= cfg.heightGravity;
        if (this.ballHeight < 0) { this.ballHeight = 0; this.heightVel = 0; }
        if (this.ballHeight > cfg.maxHeight) {
            this.ballHeight = cfg.maxHeight;
            this.heightVel = Math.min(this.heightVel, 0);
        }

        // Friction
        this.vx *= cfg.friction;
        this.vy *= cfg.friction;

        // Spin visual
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.spinAngle += speed * 0.08;

        // Trail generation
        if (speed > 2) {
            this.trail.push({
                x: this.x, y: this.y - this.ballHeight,
                alpha: 1, size: this.radius,
                surge: this.surgeMode, surgeLevel: this.surgeLevel,
            });
        }
        if (this.trail.length > cfg.trailMax) {
            this.trail.splice(0, this.trail.length - cfg.trailMax);
        }
        const trailDecay = this.surgeMode
            ? Math.max(0.02, cfg.trailDecay - this.surgeLevel * 0.01)
            : cfg.trailDecay;
        this.trail = this.trail.filter(t => {
            t.alpha -= trailDecay;
            t.size *= 0.95;
            return t.alpha > 0;
        });

        // Shadow
        this.shadow.x = this.x + this.ballHeight * 0.3;
        this.shadow.y = this.y + 5;
        this.shadow.scale = 1 - this.ballHeight * 0.01;

        // Side boundaries (wall bounce)
        if (this.x < 20) { this.x = 20; this.vx *= -0.5; }
        if (this.x > FootballConfig.field.width - 20) {
            this.x = FootballConfig.field.width - 20;
            this.vx *= -0.5;
        }
    }

    get speed() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    render(ctx, alpha) {
        if (!this.active) return;
        const rx = this.lerpX(alpha);
        const ry = this.lerpY(alpha) - this.ballHeight;

        // Trail
        for (const t of this.trail) {
            ctx.globalAlpha = t.alpha * 0.4;
            ctx.fillStyle = t.surge ? '#ff6600' : '#fff';
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Shadow
        ctx.fillStyle = `rgba(0,0,0,${0.3 * this.shadow.scale})`;
        ctx.beginPath();
        ctx.ellipse(this.shadow.x, this.shadow.y, this.radius * this.shadow.scale,
            this.radius * 0.4 * this.shadow.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ball
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(rx, ry, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Pentagon pattern (simplified)
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(rx, ry, this.radius * 0.45, this.spinAngle, this.spinAngle + Math.PI * 1.2);
        ctx.lineTo(rx, ry);
        ctx.fill();
    }
}


// ============================================================================
// GOALKEEPER — AI-driven keeper with prediction, dive, save mechanics
// ============================================================================

class Goalkeeper extends Entity {
    constructor() {
        super(FootballConfig.field.goalCenterX, FootballConfig.field.goalLineY + 15);
        this.tag = 'goalkeeper';
        this.width = FootballConfig.keeper.width;
        this.height = FootballConfig.keeper.height;
        this.z = 10;

        // AI state
        this.state = 'idle';      // idle | anticipate | dive | save | concede
        this.stateTime = 0;
        this.idleSway = 0;

        // Dive parameters
        this.targetX = this.x;
        this.targetY = this.y;
        this.diveProgress = 0;
        this.diveDirection = 0;   // -1 left, 0 center, 1 right
        this.bodyAngle = 0;
        this.armExtension = 0;    // 0-1

        // AI decision
        this.willMiss = false;
        this.saveReachMultiplier = 1.0;
        this.earlyDiveBonus = 0;
    }

    reset() {
        this.x = FootballConfig.field.goalCenterX;
        this.y = FootballConfig.field.goalLineY + 15;
        this.state = 'idle';
        this.stateTime = 0;
        this.diveProgress = 0;
        this.bodyAngle = 0;
        this.armExtension = 0;
        this.willMiss = false;
    }

    /**
     * Trigger a dive toward target position
     * @param {number} targetX - dive target X
     * @param {number} diveSpeed - progress per frame
     * @param {boolean} willMiss - AI decided to miss
     */
    dive(targetX, diveSpeed, willMiss = false) {
        this.state = 'dive';
        this.stateTime = 0;
        this.diveProgress = 0;
        this.targetX = targetX;
        this.targetY = FootballConfig.field.goalLineY + 5;
        this.willMiss = willMiss;

        const goalCX = FootballConfig.field.goalCenterX;
        this.diveDirection = targetX < goalCX ? -1 : (targetX > goalCX ? 1 : 0);
        this._diveSpeed = diveSpeed || FootballConfig.keeper.diveDuration;
    }

    /**
     * Slight anticipatory shift before diving
     * @param {number} targetX
     */
    anticipate(targetX) {
        this.state = 'anticipate';
        this.stateTime = 0;
        this.targetX = targetX;
    }

    fixedUpdate(dt) {
        this.stateTime++;
        this.idleSway += FootballConfig.keeper.idleSwaySpeed;

        switch (this.state) {
            case 'idle':
                this.x = FootballConfig.field.goalCenterX +
                    Math.sin(this.idleSway) * FootballConfig.keeper.idleSwayAmount;
                this.y = FootballConfig.field.goalLineY + 15;
                this.bodyAngle = Math.sin(this.idleSway) * 0.05;
                this.armExtension = 0;
                break;

            case 'anticipate':
                this.x = FBUtils.lerp(this.x, this.targetX, 0.02);
                this.bodyAngle = (this.targetX - this.x) * 0.003;
                break;

            case 'dive':
                this.diveProgress = Math.min(1, this.diveProgress + this._diveSpeed);
                const eased = FBUtils.easeOutCubic(this.diveProgress);
                this.x = FBUtils.lerp(FootballConfig.field.goalCenterX, this.targetX, eased);
                this.y = FBUtils.lerp(FootballConfig.field.goalLineY + 15, this.targetY, eased * 0.5);
                this.bodyAngle = this.diveDirection * eased * 0.8;
                this.armExtension = eased;
                break;

            case 'save':
                this.bodyAngle *= 0.95;
                this.armExtension *= 0.98;
                if (this.stateTime > 60) this.state = 'idle';
                break;

            case 'concede':
                this.bodyAngle *= 0.95;
                this.armExtension *= 0.95;
                if (this.stateTime > 60) this.state = 'idle';
                break;
        }
    }

    /**
     * Check if keeper can save the ball at given position
     * @param {number} ballX
     * @param {number} ballY
     * @param {number} ballHeight - chip shot height
     * @returns {boolean}
     */
    canSave(ballX, ballY, ballHeight = 0) {
        const dx = Math.abs(ballX - this.x);
        const dy = Math.abs(ballY - this.y);
        const reach = this.saveReachMultiplier;

        const baseReachX = this.width * 0.5 + this.armExtension * FootballConfig.keeper.armReach;
        const baseReachY = this.height * 0.5 + 25;

        const earlyBonus = this.earlyDiveBonus || 0;
        const reachX = (baseReachX + earlyBonus * 20) * reach;
        const reachY = (baseReachY + earlyBonus * 10) * reach;

        // Chip shots reduce save effectiveness
        const heightPenalty = ballHeight > 2 ? Math.min(ballHeight * 1.5, 18) : 0;

        // Diving forward reach
        const diveYBonus = this.state === 'dive'
            ? this.diveProgress * FootballConfig.keeper.diveYBonus : 0;

        return dx < (reachX - heightPenalty) && dy < (reachY + diveYBonus);
    }

    render(ctx, alpha) {
        const rx = this.lerpX(alpha);
        const ry = this.lerpY(alpha);

        ctx.save();
        ctx.translate(rx + this.width / 2, ry + this.height / 2);
        ctx.rotate(this.bodyAngle);

        // Body
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Arms (extend during dive)
        if (this.armExtension > 0.01) {
            const armLen = 25 * this.armExtension;
            ctx.fillStyle = '#ffcc00';
            // Left arm
            ctx.fillRect(-this.width / 2 - armLen, -this.height / 4, armLen, 8);
            // Right arm
            ctx.fillRect(this.width / 2, -this.height / 4, armLen, 8);
        }

        // Gloves
        ctx.fillStyle = '#00cc44';
        ctx.fillRect(-this.width / 2 - 4, -this.height / 4 - 2, 8, 12);
        ctx.fillRect(this.width / 2 - 4, -this.height / 4 - 2, 8, 12);

        ctx.restore();
    }
}


// ============================================================================
// KEEPER AI — Decision-making engine for goalkeeper behavior
// ============================================================================

class KeeperAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.adaptiveBias = 0;   // -1 (easier) to +1 (harder) based on performance
        this._shotHistory = [];  // for pattern prediction
    }

    get config() {
        return FootballConfig.difficulties[this.difficulty] || FootballConfig.difficulties.medium;
    }

    /**
     * Record a shot for pattern learning
     * @param {string} direction - 'left', 'center', 'right'
     */
    recordShot(direction) {
        this._shotHistory.push(direction);
        if (this._shotHistory.length > 20) this._shotHistory.shift();
    }

    /**
     * Simple pattern-based prediction of next shot direction
     * @returns {{ direction: string, confidence: number }}
     */
    predict() {
        if (this._shotHistory.length < 3) {
            return { direction: ['left', 'center', 'right'][FBUtils.randInt(0, 2)], confidence: 0.33 };
        }

        // Count direction frequency
        const counts = { left: 0, center: 0, right: 0 };
        for (const d of this._shotHistory) counts[d]++;
        const total = this._shotHistory.length;

        // Most frequent direction
        let maxDir = 'center';
        let maxCount = 0;
        for (const [dir, count] of Object.entries(counts)) {
            if (count > maxCount) { maxCount = count; maxDir = dir; }
        }

        // Check recent streak (last 3)
        const recent = this._shotHistory.slice(-3);
        if (recent[0] === recent[1] && recent[1] === recent[2]) {
            // Streak detected — higher confidence
            return { direction: recent[0], confidence: 0.7 };
        }

        return { direction: maxDir, confidence: FBUtils.clamp(maxCount / total, 0.33, 0.85) };
    }

    /**
     * Compute full keeper dive decision
     * @param {number} aimX - player's aim X position
     * @param {number} aimY - player's aim Y position
     * @returns {{ targetX: number, diveSpeed: number, willMiss: boolean, reactionDelay: number }}
     */
    computeDive(aimX, aimY) {
        const cfg = this.config;
        const adapt = this.adaptiveBias;
        const goalCX = FootballConfig.field.goalCenterX;
        const goalW = FootballConfig.field.goalWidth;
        const goalLeft = goalCX - goalW / 2;
        const goalRight = goalCX + goalW / 2;

        // Step 1: Predict direction
        const pred = this.predict();
        let predictedDir = pred.direction;
        let confidence = pred.confidence;

        // Scale confidence by difficulty
        const confScaleMap = { easy: 0.3, medium: 0.55, hard: 0.85, legend: 1.0 };
        const confScale = confScaleMap[this.difficulty] || 0.55;
        const scaledConf = 0.33 + (confidence - 0.33) * confScale;

        // Step 2: Apply prediction error
        const effectiveError = Math.max(0, cfg.predictionError - adapt * 0.1);
        if (Math.random() < effectiveError) {
            const dirs = ['left', 'center', 'right'].filter(d => d !== predictedDir);
            predictedDir = dirs[FBUtils.randInt(0, dirs.length - 1)];
            confidence *= 0.4;
        }

        // Step 3: Convert direction to target X
        const accuracy = FBUtils.clamp(cfg.positionAccuracy + adapt * 0.1, 0, 1);
        const aimBias = (aimX - goalCX) * accuracy;
        let diveX;
        switch (predictedDir) {
            case 'left':  diveX = goalCX - goalW * 0.35 + aimBias * 0.3; break;
            case 'right': diveX = goalCX + goalW * 0.35 + aimBias * 0.3; break;
            default:      diveX = goalCX + aimBias * 0.2; break;
        }

        // Step 4: Overcommit (dives too far)
        if (Math.random() < cfg.overcommitChance) {
            const overAmount = FBUtils.randRange(20, 45);
            if (predictedDir === 'left') diveX -= overAmount;
            else if (predictedDir === 'right') diveX += overAmount;
        }

        // Step 5: Human imprecision jitter
        const jitter = FBUtils.randRange(-15, 15) * (1 - accuracy * 0.5);
        diveX = FBUtils.clamp(diveX + jitter, goalLeft - 15, goalRight + 15);

        // Step 6: Will keeper miss?
        const effectiveMiss = Math.max(0.01, cfg.missChance - adapt * 0.05);
        const willMiss = Math.random() < effectiveMiss;

        // Step 7: Confidence-driven speed/timing
        let diveSpeed = cfg.diveSpeed;
        let reactionDelay = cfg.reactionDelayMs;

        if (scaledConf > 0.55) {
            const confBoost = (scaledConf - 0.5) * confScale;
            diveSpeed *= (1 + confBoost * 0.8);
            reactionDelay *= (1 - confBoost * 0.5);
        } else if (scaledConf < 0.38) {
            diveSpeed *= (0.85 + (1 - confScale) * 0.1);
            diveX = FBUtils.lerp(diveX, goalCX, 0.3 * confScale);
        }

        // Adaptive adjustments
        reactionDelay = Math.max(40, reactionDelay - adapt * 80);
        diveSpeed = Math.min(0.15, diveSpeed + adapt * 0.02);

        return {
            targetX: diveX,
            diveSpeed,
            willMiss,
            reactionDelay,
            predictedDir,
            confidence: scaledConf,
        };
    }

    /**
     * Adjust adaptive difficulty based on result
     * @param {string} result - 'goal' | 'save' | 'miss' | 'post'
     */
    adjustDifficulty(result) {
        switch (result) {
            case 'goal':
                this.adaptiveBias = FBUtils.clamp(this.adaptiveBias + 0.1, -1, 1);
                break;
            case 'save':
                this.adaptiveBias = FBUtils.clamp(this.adaptiveBias - 0.08, -1, 1);
                break;
            case 'miss':
            case 'post':
                this.adaptiveBias = FBUtils.clamp(this.adaptiveBias - 0.05, -1, 1);
                break;
        }
    }
}


// ============================================================================
// GOAL DETECTOR — Checks ball position against goal geometry
// ============================================================================

class GoalDetector {
    /**
     * Evaluate ball position relative to goal
     * @param {Football} ball
     * @param {Goalkeeper} keeper
     * @returns {null | { result: string, saved: boolean }}
     *   result: 'goal' | 'save' | 'post' | 'over' | 'miss'
     */
    static check(ball, keeper) {
        if (!ball.active) return null;

        const cfg = FootballConfig.field;
        const bx = ball.x;
        const by = ball.y;
        const pw = cfg.goalPostWidth;

        const goalLeft = cfg.goalCenterX - cfg.goalWidth / 2;
        const goalRight = cfg.goalCenterX + cfg.goalWidth / 2;
        const postInnerLeft = goalLeft + pw;
        const postInnerRight = goalRight - pw;

        const betweenPosts = bx > postInnerLeft && bx < postInnerRight;
        const hitLeftPost = Math.abs(bx - goalLeft - pw / 2) < 14 && by < cfg.goalLineY + 10;
        const hitRightPost = Math.abs(bx - goalRight + pw / 2) < 14 && by < cfg.goalLineY + 10;
        const pastGoalLine = by <= cfg.goalLineY;
        const deepInGoal = by <= cfg.goalLineY - 15;
        const overCrossbar = by < cfg.crossbarY - 10;

        // Ball hasn't reached goal area yet
        if (!pastGoalLine && !hitLeftPost && !hitRightPost) {
            // Check if ball went way off screen
            if (by < cfg.crossbarY - 30 || bx < goalLeft - 50 || bx > goalRight + 50) {
                return { result: 'miss', saved: false };
            }
            return null;
        }

        // Between posts
        if (betweenPosts) {
            const positionedForSave = keeper.canSave(bx, by, ball.ballHeight);
            const aiWillMiss = keeper.willMiss;
            const saved = positionedForSave && !aiWillMiss && !deepInGoal;

            if (saved) {
                keeper.state = 'save';
                keeper.stateTime = 0;
                return { result: 'save', saved: true };
            } else if (overCrossbar) {
                return { result: 'over', saved: false };
            } else {
                keeper.state = 'concede';
                keeper.stateTime = 0;
                return { result: 'goal', saved: false };
            }
        }

        // Hit post
        if (hitLeftPost || hitRightPost) {
            return { result: 'post', saved: false };
        }

        // Wide miss
        return { result: 'miss', saved: false };
    }
}


// ============================================================================
// MATCH MANAGER — Rounds, scoring, streaks
// ============================================================================

class MatchManager {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.maxRounds = FootballConfig.difficulties[difficulty]?.maxRounds || 10;
        this.reset();
    }

    reset() {
        this.round = 0;
        this.playerScore = 0;
        this.keeperScore = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.results = [];       // per-round history
    }

    /**
     * Record a round result
     * @param {string} result - 'goal' | 'save' | 'miss' | 'post' | 'over'
     * @returns {{ roundComplete: boolean, matchComplete: boolean }}
     */
    recordResult(result) {
        this.round++;
        this.results.push(result);

        if (result === 'goal') {
            this.playerScore++;
            this.streak++;
            if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        } else {
            if (result === 'save') this.keeperScore++;
            this.streak = 0;
        }

        return {
            roundComplete: true,
            matchComplete: this.round >= this.maxRounds,
        };
    }

    get scoreString() {
        return `${this.playerScore} - ${this.keeperScore}`;
    }
}


// ============================================================================
// AIM SYSTEM — Auto-oscillating aim target
// ============================================================================

class AimSystem {
    constructor() {
        this.x = FootballConfig.field.goalCenterX;
        this.y = (FootballConfig.field.goalLineY + FootballConfig.field.crossbarY) / 2;
        this.oscillation = 0;
        this.locked = false;
    }

    update() {
        if (this.locked) return;

        const cfg = FootballConfig;
        const goalCX = cfg.field.goalCenterX;
        const goalW = cfg.field.goalWidth;
        const goalLeft = goalCX - goalW / 2 + 20;
        const goalRight = goalCX + goalW / 2 - 20;

        this.oscillation += cfg.kicker.aimOscSpeed;
        const oscAmount = Math.sin(this.oscillation) * (goalW * cfg.kicker.aimOscRange);
        this.x = FBUtils.clamp(goalCX + oscAmount, goalLeft, goalRight);
        this.y = FBUtils.clamp(this.y,
            cfg.field.crossbarY + 5, cfg.field.goalLineY);
    }

    lock() {
        this.locked = true;
    }

    reset() {
        this.locked = false;
        this.x = FootballConfig.field.goalCenterX;
    }
}


// ============================================================================
// POWER GAUGE — Auto-oscillating power charge
// ============================================================================

class PowerGauge {
    constructor() {
        this.power = 0;
        this.charging = false;
        this.locked = false;
    }

    startCharge() {
        this.power = 0;
        this.charging = true;
        this.locked = false;
    }

    update() {
        if (!this.charging || this.locked) return;
        this.power = (this.power + FootballConfig.kicker.powerChargeRate) % 1.0;
    }

    lock() {
        this.locked = true;
        this.charging = false;
    }

    get clampedPower() {
        return FBUtils.clamp(this.power, FootballConfig.kicker.minPower, 1.0);
    }

    reset() {
        this.power = 0;
        this.charging = false;
        this.locked = false;
    }
}


// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FootballConfig,
        FBUtils,
        Football,
        Goalkeeper,
        KeeperAI,
        GoalDetector,
        MatchManager,
        AimSystem,
        PowerGauge,
    };
}

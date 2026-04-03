# Game Development Ecosystem: Architecture & Technical Stack

**Document Version:** 1.0
**Date:** March 30, 2026
**Scope:** Unified Architecture for Cricket AI 2026, Football AI 2026, Baseball AI 2026
**Classification:** Production Reference Architecture

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Canvas Architecture](#canvas-architecture)
4. [Game Loop Architecture](#game-loop-architecture)
5. [State Machine & Screen Management](#state-machine--screen-management)
6. [AI Engine Architecture](#ai-engine-architecture)
7. [Data Flow & State Management](#data-flow--state-management)
8. [Backend Architecture](#backend-architecture)
9. [Native Bridge & Platform Integration](#native-bridge--platform-integration)
10. [Deployment Architecture](#deployment-architecture)
11. [Performance Budgets & Optimization](#performance-budgets--optimization)
12. [Security Architecture](#security-architecture)
13. [Component Dependency Maps](#component-dependency-maps)
14. [Network & Data Synchronization](#network--data-synchronization)
15. [Appendix: Diagrams & Reference](#appendix-diagrams--reference)

---

## System Overview

### Unified Architecture Pattern

All three production games (Cricket AI 2026, Football AI 2026, Baseball AI 2026) share an identical architectural foundation despite their domain differences. This unified approach enables:

- **Code reusability** across sports titles
- **Consistent player experience** and UI patterns
- **Predictable performance** characteristics
- **Streamlined deployment** and DevOps
- **Shared AI infrastructure** with sport-specific tweaks

### Core Architecture Principles

```
┌─────────────────────────────────────────────────────────┐
│         UNIFIED GAME ENGINE ARCHITECTURE                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Single HTML5 Canvas + Vanilla JS (12K-16K LOC)          │
│  ├─ Monolithic: Single HTML file + inline CSS/JS         │
│  ├─ No frameworks (React, Vue, Angular)                  │
│  └─ Optimized for mobile native wrapping                 │
│                                                           │
│  Fixed-Timestep Game Loop (60Hz Physics)                 │
│  ├─ Physics simulation locked to 60 FPS                  │
│  ├─ Variable render framerate (vsync-dependent)          │
│  └─ Delta-time accumulation for frame skipping           │
│                                                           │
│  Entity-Component System with Z-Sorted Rendering         │
│  ├─ Position, rotation, velocity, collider               │
│  ├─ Component composition (no inheritance)               │
│  └─ Layered rendering (background → entities → UI)       │
│                                                           │
│  4-Phase AI Engine with Claude Integration               │
│  ├─ Phase 1: Lookup tables (sport-specific rules)        │
│  ├─ Phase 2: Player modeling (behavior frequency)        │
│  ├─ Phase 3: Bayesian/Markov prediction                  │
│  └─ Phase 4: Claude API advisor (circuit-breaker)        │
│                                                           │
│  Dual Native Wrapping                                    │
│  ├─ Capacitor 5/6 + Xcode → iOS App Store               │
│  └─ Expo 55 + EAS Build → Expo Go / App Store           │
│                                                           │
│  Backend as a Service (Convex)                           │
│  ├─ Real-time database + API layer                       │
│  ├─ Multiplayer rooms & leaderboards                     │
│  └─ Session persistence & analytics                      │
│                                                           │
│  Progressive Web App                                     │
│  ├─ Service Worker offline support                       │
│  ├─ PWA manifest + installation capability               │
│  └─ localStorage for client-side persistence             │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend Layer

| Layer | Technology | Purpose | Notes |
|-------|-----------|---------|-------|
| **Language** | Vanilla JavaScript (ES6+) | Core game logic | No transpilation needed for modern browsers |
| **Rendering** | HTML5 Canvas 2D API | Graphics output | Single 2D context, no WebGL |
| **DOM/Styling** | CSS (inlined in HTML) | UI overlays, layout | Minimal DOM usage |
| **Input** | Touch Events API | Mobile input handling | Capacitor bridges to native |
| **Storage** | localStorage + Capacitor Preferences | Client-side persistence | Dual-source for cross-platform reliability |
| **Audio** | Web Audio API | Sound synthesis | Oscillator-based, zero audio files |

### AI & ML Layer

| Component | Technology | Purpose | Sport-Specific |
|-----------|-----------|---------|-----------------|
| **Pattern Matching** | Lookup tables (arrays) | Rule-based decisions | Yes (Cricket/Football/Baseball rules) |
| **Player Modeling** | Frequency tables + EMA | Opponent behavior prediction | Yes (sport-specific aggression/risk metrics) |
| **Prediction Engine** | Bayesian inference | Probabilistic outcomes | Yes (shot effectiveness, game state) |
| **Sequence Prediction** | Markov chains | Next-move forecasting | Yes (typical sequences per sport) |
| **ML Inference** | TensorFlow.js 4.x | Neural networks (Football only) | No (Cricket/Baseball use traditional ML) |
| **External AI** | Claude API (Anthropic) | Contextual strategy advisor | Optional, circuit-breaker protected |

### Backend Layer

| Service | Technology | Purpose | Provider |
|---------|-----------|---------|----------|
| **Database** | Convex (real-time) | Player data, leaderboards, sessions | BaaS |
| **API Layer** | Convex mutations/queries | Server-side business logic | BaaS |
| **Multiplayer** | Convex rooms + WebSocket | Real-time multiplayer sync | BaaS |
| **Authentication** | Convex auth | Player registration & sessions | BaaS |
| **Leaderboards** | Convex tables | Global/local ranking | BaaS |
| **Analytics** | Convex events + external sink | Player telemetry | BaaS |

**Convex Deployment:** gallant-kingfisher-867.convex.cloud

### Native Layer

| Platform | Framework | Wrapper | Deployment |
|----------|-----------|---------|------------|
| **iOS** | Capacitor 5/6 OR Expo SDK 55 | WebView bridge | App Store via EAS or Xcode |
| **Web** | N/A | PWA manifest | Vercel / Netlify / GitHub Pages |
| **Android** | Capacitor OR Expo SDK 55 | WebView bridge | Google Play via EAS |

### Payment & Monetization

| Component | Technology | Purpose | Integration |
|-----------|-----------|---------|-------------|
| **In-App Purchases** | Superwall + expo-superwall | Subscription/one-time | React Native WebView injection |
| **IAP Backend** | Convex mutations | Receipt validation & entitlements | Server-side state sync |
| **Native Bridge** | window.NativePurchase | JavaScript → native IAP | postMessage across bridge |

### DevOps & CI/CD

| Stage | Tool | Purpose | Config |
|-------|------|---------|--------|
| **VCS** | GitHub | Source control | Branch: main, dev |
| **CI/CD** | GitHub Actions | Automated builds & tests | .github/workflows/*.yml |
| **Build (iOS)** | EAS Build OR Xcode | Compile to .ipa/.app | eas.json + xcode config |
| **Build (Web)** | Vite / esbuild | Bundle JavaScript | vite.config.js |
| **Deploy (Web)** | Vercel / Netlify | Static hosting + CDN | Vercel.json or netlify.toml |
| **Deploy (iOS)** | EAS Submit OR Xcode | Publish to App Store | eas.json + Apple Developer |
| **Monitoring** | Sentry (optional) | Error tracking | DSN in config |

---

## Canvas Architecture

### Design Resolution & Responsive Scaling

The canvas uses a **base design resolution** that scales responsively across devices:

```javascript
// Design resolutions by sport
const DESIGN_RESOLUTIONS = {
  cricket: { width: 414, height: 896 },   // iPhone 12/13
  football: { width: 414, height: 896 },  // iPhone 12/13
  baseball: { width: 390, height: 844 }   // iPhone SE / standard compact
};

// Runtime scaling (in init)
const devicePixelRatio = window.devicePixelRatio || 1;
canvas.width = designWidth * devicePixelRatio;
canvas.height = designHeight * devicePixelRatio;

// Game logic uses design coordinates, rendering uses device coordinates
ctx.scale(devicePixelRatio, devicePixelRatio);

// Responsive fit to window
const scaleX = window.innerWidth / designWidth;
const scaleY = window.innerHeight / designHeight;
const scale = Math.min(scaleX, scaleY);

canvas.style.transform = `scale(${scale})`;
canvas.style.transformOrigin = 'top left';
```

### Coordinate Systems

```
┌────────────────────────────────────────────────┐
│  Screen Coordinates (user input, CSS px)       │
│  (0,0) top-left                                │
│                                                │
│  ↓ screenToGame() transform                    │
│                                                │
│  Game Coordinates (physics, entities)          │
│  (0,0) top-left, range [0..designW, 0..designH] │
│                                                │
│  ↓ viewport offset (for camera)                │
│                                                │
│  World Coordinates (unlimited space)           │
│  (0,0) origin, can extend beyond screen       │
│                                                │
│  ↓ gameToScreen() transform                    │
│                                                │
│  Canvas Coordinates (pixel positions)          │
│  Device-aware rendering                       │
│                                                │
└────────────────────────────────────────────────┘
```

### Canvas Rendering Pipeline

```javascript
// Main render function (called every requestAnimationFrame)
function render(ctx, alpha) {
  // 1. Clear canvas
  ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  // 2. Render background layer
  renderStadium(ctx);

  // 3. Render game entities (sorted by z-order)
  entities.sort((a, b) => a.zIndex - b.zIndex);
  for (const entity of entities) {
    renderEntity(ctx, entity, alpha);
  }

  // 4. Render particle effects
  for (const particle of particles) {
    renderParticle(ctx, particle, alpha);
  }

  // 5. Render HUD and UI
  renderHUD(ctx);
  renderUI(ctx);

  // 6. Debug overlay (if enabled)
  if (DEBUG_MODE) renderDebugOverlay(ctx);
}
```

### Z-Index Layering System

```
Layer 9: Debug overlay
Layer 8: UI buttons, tooltips
Layer 7: HUD (score, timer)
Layer 6: Particle effects, animations
Layer 5: Dynamic entities (players, ball, wickets)
Layer 4: Field elements (boundaries, pitch markings)
Layer 3: Stadium/field background
Layer 2: Gradient/color background
Layer 1: Reserved for future
Layer 0: (unused)
```

---

## Game Loop Architecture

### Frame Timing & Delta Time

```javascript
let lastTime = performance.now();
let accumulator = 0;
const FIXED_TIMESTEP = 1 / 60; // 16.67ms
const MAX_DELTA = 50; // Cap frame skip at 50ms

function loop(currentTime) {
  const dt = Math.min((currentTime - lastTime) / 1000, MAX_DELTA / 1000);
  lastTime = currentTime;

  accumulator += dt;

  // Run fixed updates in steps
  while (accumulator >= FIXED_TIMESTEP) {
    fixedUpdate(FIXED_TIMESTEP);
    accumulator -= FIXED_TIMESTEP;
  }

  // Variable-rate update
  update(dt);

  // Interpolation ratio for smooth animation
  const alpha = accumulator / FIXED_TIMESTEP;

  // Render with interpolation
  render(alpha);

  requestAnimationFrame(loop);
}
```

### Complete Game Loop Flow

```
┌──────────────────────────────────────────────────────────┐
│ requestAnimationFrame(loop)                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 1. TIMING                                                │
│    ├─ Calculate delta time since last frame              │
│    ├─ Cap at 50ms (prevents spiral of death)            │
│    └─ Accumulate for fixed-timestep queue                │
│                                                          │
│ 2. FIXED UPDATES (60 Hz, physics-driven)                 │
│    ├─ [REPEAT while accumulator >= 16.67ms]             │
│    │  ├─ Physics simulation                              │
│    │  │  ├─ Update velocities                            │
│    │  │  ├─ Apply gravity/forces                         │
│    │  │  └─ Update positions                             │
│    │  ├─ Collision detection (AABB)                      │
│    │  │  ├─ Broad phase (spatial grid)                   │
│    │  │  └─ Narrow phase (entity pairs)                  │
│    │  ├─ Collision response                              │
│    │  ├─ AI tick (budget-guarded, max 2ms)              │
│    │  │  ├─ AI decision making                           │
│    │  │  └─ Behavior state updates                       │
│    │  └─ Game logic                                      │
│    │     ├─ Score updates                                │
│    │     ├─ Win condition checks                         │
│    │     └─ Event processing                             │
│    │                                                     │
│ 3. VARIABLE UPDATES (frame-dependent, <16.67ms)         │
│    ├─ Input processing                                  │
│    │  ├─ Touch/tap events                                │
│    │  └─ Gesture recognition                             │
│    ├─ Animation advancement                              │
│    │  ├─ Sprite frame updates                            │
│    │  └─ Tween/ease-out calculations                     │
│    ├─ Particle system updates                            │
│    ├─ Particle lifecycle (birth → death)                │
│    │  ├─ Position updates                                │
│    │  └─ Opacity/scale effects                           │
│    └─ Audio synthesis updates                            │
│                                                          │
│ 4. RENDERING (interpolated)                              │
│    ├─ Clear canvas                                       │
│    ├─ Background rendering                               │
│    ├─ Entity rendering (z-sorted)                        │
│    │  ├─ Each entity.render(ctx, alpha)                  │
│    │  └─ alpha for smooth interpolation                  │
│    ├─ Particle rendering                                 │
│    ├─ HUD/UI overlay                                     │
│    └─ Optional debug overlay                             │
│                                                          │
│ 5. REPEAT                                                │
│    └─ Next requestAnimationFrame                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Physics Simulation

```javascript
// Fixed timestep physics (called 60 times per second)
function fixedUpdate(dt) {
  // Apply forces
  for (const entity of physicsEntities) {
    if (entity.hasPhysics) {
      entity.velocity.x += entity.force.x / entity.mass * dt;
      entity.velocity.y += entity.force.y / entity.mass * dt;
      entity.position.x += entity.velocity.x * dt;
      entity.position.y += entity.velocity.y * dt;
      entity.force.set(0, 0); // Reset forces each step
    }
  }

  // Collision detection (broad phase: spatial partitioning)
  const pairs = broadPhaseCollisionDetection();

  // Collision response (narrow phase: AABB)
  for (const [entityA, entityB] of pairs) {
    if (checkAABBCollision(entityA, entityB)) {
      resolveCollision(entityA, entityB);
      // Call collision callbacks
      entityA.onCollision?.(entityB);
      entityB.onCollision?.(entityA);
    }
  }
}

// AABB (Axis-Aligned Bounding Box) collision
function checkAABBCollision(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}
```

---

## State Machine & Screen Management

### Screen Hierarchy

All games follow a consistent screen state machine:

```
                          ┌─────────┐
                          │  MENU   │ (main screen)
                          └────┬────┘
                  ┌─────────────┼─────────────┐
                  ▼             ▼             ▼
              ┌───────┐    ┌───────┐    ┌──────────┐
              │ GAME  │    │LEVELS │    │  SHOP    │
              └───┬───┘    └───────┘    └──────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
    ┌─────────┐      ┌──────────────┐
    │GAMEOVER │      │CAMPAIGN_RESULT│
    └─────────┘      └──────────────┘
         │                 │
         └────────┬────────┘
                  ▼
            ┌──────────────┐
            │ACHIEVEMENTS  │
            └──────────────┘
                  │
         ┌────────┴──────────┐
         ▼                   ▼
    ┌────────┐          ┌───────────┐
    │ STATS  │          │LEADERBOARD│
    └────────┘          └───────────┘
         │                   │
         └────────┬──────────┘
                  ▼
            ┌──────────────┐
            │   SETTINGS   │
            └──────────────┘
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
  ┌────────┐ ┌──────────┐ ┌──────────┐
  │PROFILE │ │MULTIPLAYER   │ │SUPPORT  │
  └────────┘ └──────────┘ └──────────┘
      │           │           │
      │     ┌─────┴─────┐     │
      │     ▼           ▼     │
      │  ┌──────┐  ┌────────┐ │
      │  │CREATE│  │  JOIN  │ │
      │  └──────┘  └────────┘ │
      │     │           │     │
      │     └─────┬─────┘     │
      │           ▼           │
      │       ┌─────────┐     │
      │       │MP_RESULT│     │
      │       └─────────┘     │
      │           │           │
      └───────────┴───────────┘
              ▼
          ┌────────┐
          │  MENU  │ (loop back)
          └────────┘
```

### Screen Implementation Pattern

```javascript
// Base screen class
class Screen {
  constructor() {
    this.isActive = false;
  }

  onEnter() {
    // Initialize screen (called when transitioning in)
    this.isActive = true;
  }

  onExit() {
    // Cleanup (called when transitioning out)
    this.isActive = false;
  }

  handleInput(event) {
    // Process touch/tap events
  }

  update(dt) {
    // Variable-rate updates
  }

  fixedUpdate(dt) {
    // Fixed-timestep updates (if needed)
  }

  render(ctx, alpha) {
    // Draw screen content
  }
}

// Screen manager
class ScreenManager {
  constructor() {
    this.screens = new Map();
    this.currentScreen = null;
  }

  registerScreen(name, screenInstance) {
    this.screens.set(name, screenInstance);
  }

  switchScreen(newScreenName) {
    if (this.currentScreen) {
      this.currentScreen.onExit();
    }

    this.currentScreen = this.screens.get(newScreenName);
    this.currentScreen.onEnter();
  }

  handleInput(event) {
    this.currentScreen?.handleInput(event);
  }

  update(dt) {
    this.currentScreen?.update(dt);
  }

  fixedUpdate(dt) {
    this.currentScreen?.fixedUpdate(dt);
  }

  render(ctx, alpha) {
    this.currentScreen?.render(ctx, alpha);
  }
}
```

---

## AI Engine Architecture

### 4-Phase AI System

The AI engine operates in four sequential phases, each building on the previous:

```
┌──────────────────────────────────────────────────────────┐
│ AIEngine (Sport-agnostic orchestrator)                    │
│ Lazy instantiation per sport                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Phase 1: Rule-Based Lookup Tables                        │
│ ├─ Sport-specific rules engine                           │
│ ├─ Effectiveness weights (hardcoded arrays)              │
│ ├─ Situational decision trees                            │
│ └─ Deterministic, <1ms execution                         │
│    Example: Cricket shot selection vs field placement    │
│                                                          │
│ ↓ (always executes, foundation)                          │
│                                                          │
│ Phase 2: Player Model Builder                            │
│ ├─ Frequency tables of opponent behavior                 │
│ ├─ Exponential moving average (EMA) of aggression        │
│ ├─ 2-4KB memory per opponent                             │
│ ├─ Historical behavior patterns                          │
│ └─ Semi-deterministic, <2ms execution                    │
│    Example: "Opponent favors aggressive shots 60% of    │
│             time when ahead, adjusts as EMA changes"     │
│                                                          │
│ ↓ (always executes, foundation)                          │
│                                                          │
│ Phase 3: Probabilistic Prediction                        │
│ ├─ BayesPredictor: P(outcome | game_state)              │
│ ├─ SequencePredictor: Next N moves (Markov chains)      │
│ ├─ AdaptiveDifficulty: Skill level adjustment            │
│ ├─ Ensemble voting on predictions                        │
│ └─ Probabilistic, <3ms execution                         │
│    Example: "65% chance opponent hits boundary, 35%     │
│             chance dot ball; adjust difficulty if       │
│             player skill detected as improving"          │
│                                                          │
│ ↓ (always executes, foundation)                          │
│                                                          │
│ Phase 4: Claude AI Advisor (OPTIONAL)                    │
│ ├─ External API call to Claude (Anthropic)              │
│ ├─ Circuit breaker pattern (fallback to Phase 3)         │
│ ├─ LRU cache (50 items, 30s TTL)                         │
│ ├─ Rate limiting (1 call per 5 seconds max)              │
│ ├─ Async, non-blocking (AJAX)                            │
│ └─ Contextual strategy & narrative                       │
│    Example: "Based on game state, suggest a surprise     │
│             bowling tactic with explanation"              │
│                                                          │
│ ↓ (conditional, advisory only)                           │
│                                                          │
│ Final Decision                                           │
│ ├─ Phase 4 result if available & confident              │
│ ├─ Phase 3 ensemble vote if Phase 4 unavailable         │
│ └─ Fallback to Phase 2/1 if timeout                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### AI Engine Implementation

```javascript
class AIEngine {
  constructor(sport) {
    this.sport = sport;
    this.phase1 = null; // Lazy init
    this.phase2 = null;
    this.phase3 = null;
    this.phase4 = null;
  }

  // Lazy initialization (only when needed)
  _ensureInitialized() {
    if (!this.phase1) {
      const rules = SPORT_RULES[this.sport];
      this.phase1 = new RuleBasedEngine(rules);
      this.phase2 = new PlayerModelEngine(this.sport);
      this.phase3 = new PredictionEngine(this.sport);
      this.phase4 = new ClaudeAIAdvisor(this.sport);
    }
  }

  async makeDecision(gameState, maxTimeMs = 2) {
    this._ensureInitialized();

    const startTime = performance.now();

    // Phase 1: Rules (deterministic)
    const phase1Decision = this.phase1.decide(gameState);
    if (phase1Decision.confidence > 0.95) return phase1Decision;

    // Phase 2: Player model (historical)
    const phase2Decision = this.phase2.decide(gameState, phase1Decision);
    if (phase2Decision.confidence > 0.9) return phase2Decision;

    // Phase 3: Prediction ensemble
    const phase3Decision = this.phase3.decide(gameState, phase2Decision);
    if (performance.now() - startTime > maxTimeMs * 0.8) {
      return phase3Decision; // Time budget exceeded
    }

    // Phase 4: Claude AI (async, don't block)
    const timeRemaining = maxTimeMs - (performance.now() - startTime);
    if (timeRemaining > 0.5 && this.phase4.isReady()) {
      try {
        const phase4Decision = await Promise.race([
          this.phase4.decide(gameState, phase3Decision),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeRemaining)
          )
        ]);
        return phase4Decision;
      } catch (err) {
        console.warn('Phase 4 failed, using Phase 3:', err);
        return phase3Decision;
      }
    }

    return phase3Decision;
  }
}

// Phase 1: Rule-based decision
class RuleBasedEngine {
  constructor(rules) {
    this.rules = rules; // Sport-specific rules object
  }

  decide(gameState) {
    const { fieldPosition, ballPosition, score, wickets } = gameState;

    // Example for cricket
    const fieldingStrength = this.calculateFieldingStrength(fieldPosition);
    const ballThreat = this.calculateBallThreat(ballPosition);

    let decision = null;
    let confidence = 0;

    if (ballThreat > 0.7 && fieldingStrength < 0.5) {
      decision = 'DEFEND'; // Conservative action
      confidence = 0.95;
    } else if (score.opposition < 50) {
      decision = 'ATTACK'; // Aggressive action
      confidence = 0.85;
    }

    return { action: decision, confidence, source: 'rules' };
  }
}

// Phase 2: Player modeling
class PlayerModelEngine {
  constructor(sport) {
    this.sport = sport;
    this.playerHistory = new Map(); // opponent ID → frequency tables
  }

  decide(gameState, phase1Hint) {
    const opponentId = gameState.opponent.id;
    const history = this.playerHistory.get(opponentId) ||
                    this.initializePlayerProfile();

    // Calculate EMA of observed aggression
    const aggressionEMA = this.calculateAggression(history);

    // Predict likely action based on history
    const likelyAction = this.predictAction(history, gameState, aggressionEMA);
    const confidence = this.getHistoricalConfidence(history);

    this.updateHistory(opponentId, gameState);

    return { action: likelyAction, confidence, source: 'player_model' };
  }

  initializePlayerProfile() {
    return {
      actionFrequency: new Map(),
      aggressionHistory: [],
      outcomesObserved: new Map()
    };
  }

  calculateAggression(history) {
    if (history.aggressionHistory.length === 0) return 0.5;
    const alpha = 0.2; // EMA smoothing factor
    let ema = history.aggressionHistory[0];
    for (let i = 1; i < history.aggressionHistory.length; i++) {
      ema = alpha * history.aggressionHistory[i] + (1 - alpha) * ema;
    }
    return ema;
  }
}

// Phase 3: Probabilistic prediction
class PredictionEngine {
  constructor(sport) {
    this.sport = sport;
    this.bayesPredictor = new BayesPredictor(sport);
    this.sequencePredictor = new SequencePredictor(sport);
    this.difficultyAdjuster = new AdaptiveDifficulty();
  }

  decide(gameState, phase2Hint) {
    // Bayesian: P(outcome | state)
    const bayesVote = this.bayesPredictor.predictOutcome(gameState);

    // Markov: Sequence of next moves
    const sequenceVote = this.sequencePredictor.predictSequence(gameState);

    // Ensemble: Combine votes
    const ensemble = this.combineVotes([bayesVote, sequenceVote, phase2Hint]);

    // Adjust difficulty dynamically
    const difficulty = this.difficultyAdjuster.calculate(gameState);

    return {
      action: ensemble.action,
      confidence: ensemble.confidence,
      source: 'prediction_ensemble',
      difficulty
    };
  }

  combineVotes(votes) {
    // Weighted voting: confidence-weighted average
    const weighted = votes
      .filter(v => v)
      .map(v => ({ ...v, weight: v.confidence }));

    const totalWeight = weighted.reduce((sum, v) => sum + v.weight, 0);
    const avgConfidence = totalWeight / weighted.length;

    // Select action from highest-confidence vote
    const bestVote = weighted.reduce((best, v) =>
      v.weight > best.weight ? v : best
    );

    return {
      action: bestVote.action,
      confidence: avgConfidence
    };
  }
}

// Phase 4: Claude AI Advisor
class ClaudeAIAdvisor {
  constructor(sport) {
    this.sport = sport;
    this.apiEndpoint = 'https://api.anthropic.com/v1/messages';
    this.cache = new LRUCache(50); // 50 items max
    this.cacheTTL = 30000; // 30 seconds
    this.rateLimiter = new RateLimiter(1, 5000); // 1 call per 5s
    this.circuitBreaker = new CircuitBreaker();
  }

  async decide(gameState, phase3Hint) {
    // Check cache first
    const cacheKey = this.getCacheKey(gameState);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    // Rate limiting
    if (!this.rateLimiter.isReady()) {
      return null; // Skip, let fallback handle
    }

    // Circuit breaker
    if (this.circuitBreaker.isOpen()) {
      return null; // Service unavailable, fallback
    }

    try {
      const prompt = this.buildPrompt(gameState, this.sport);

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        this.circuitBreaker.recordFailure();
        return null;
      }

      const data = await response.json();
      const text = data.content[0].text;

      const decision = this.parseResponse(text, gameState);

      // Cache result
      this.cache.set(cacheKey, {
        value: decision,
        timestamp: Date.now()
      });

      this.circuitBreaker.recordSuccess();
      return decision;

    } catch (error) {
      console.error('Claude API error:', error);
      this.circuitBreaker.recordFailure();
      return null; // Fallback to Phase 3
    }
  }

  buildPrompt(gameState, sport) {
    return `
You are an expert ${sport} AI advisor for a mobile game.
Current game state: ${JSON.stringify(gameState, null, 2)}

Recommend the next action (1-2 words) and a brief strategic explanation (1 sentence).
Respond as: ACTION: [action], REASON: [brief explanation]
    `.trim();
  }

  parseResponse(text, gameState) {
    // Simple parsing: extract ACTION and REASON
    const actionMatch = text.match(/ACTION:\s*(\w+)/i);
    const reasonMatch = text.match(/REASON:\s*([^,\n]+)/i);

    return {
      action: actionMatch ? actionMatch[1] : null,
      confidence: 0.7,
      source: 'claude_ai',
      reason: reasonMatch ? reasonMatch[1] : ''
    };
  }
}

// Supporting utilities
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // Move to end (most recent)
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.calls = [];
  }

  isReady() {
    const now = Date.now();
    this.calls = this.calls.filter(t => now - t < this.windowMs);
    if (this.calls.length < this.limit) {
      this.calls.push(now);
      return true;
    }
    return false;
  }
}

class CircuitBreaker {
  constructor(failureThreshold = 5, resetTimeMs = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeMs = resetTimeMs;
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  isOpen() {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeMs) {
        this.state = 'HALF_OPEN';
        this.failures = 0;
        return false; // Allow one attempt
      }
      return true; // Still open
    }
    return false;
  }
}
```

---

## Data Flow & State Management

### Complete Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│ INPUT LAYER                                              │
│ (Touch events, taps, swipes, device sensors)             │
└──────────────┬───────────────────────────────────────────┘
               │ screenToGame() transform
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ GAME LOGIC LAYER                                         │
│ (Screen manager, state machine)                          │
│  ├─ Parse input                                          │
│  ├─ Validate against game rules                          │
│  └─ Queue game events                                    │
└──────────────┬───────────────────────────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
┌──────────┐    ┌──────────────────┐
│ PHYSICS  │    │   AI ENGINE      │
│ SYSTEM   │    │  (4-phase)       │
│          │    │  ├─ Rules        │
│ - Pos    │    │  ├─ Model        │
│ - Vel    │    │  ├─ Prediction   │
│ - Accel  │    │  └─ Claude API   │
│ - Collis │    └──────────────────┘
│   ions   │
└────┬─────┘         ┌───────────┐
     │               │ANIMATIONS │
     │               │(tweens)    │
     │               └─────┬─────┘
     └───────┬─────────────┘
             │ (all updates)
             ▼
┌──────────────────────────────────────────────────────────┐
│ STATE UPDATE LAYER                                       │
│ (Entity positions, velocities, scores, timers)           │
│ (Accumulate all changes this frame)                      │
└──────────────┬───────────────────────────────────────────┘
               │
      ┌────────┴─────────┐
      │                  │
      ▼                  ▼
┌────────────┐     ┌────────────────┐
│ LOCAL      │     │ BACKEND        │
│ STORAGE    │     │ (Convex)       │
│ (browser)  │     │ (async)        │
│            │     │  ├─ Leaderboard│
│ localStorage│    │  ├─ Sessions   │
│ Preferences │    │  └─ Multiplayer│
└────────────┘     └────────────────┘
      │                  │
      └────────┬─────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ RENDER LAYER                                             │
│ (Interpolate for smooth animation)                       │
│  ├─ Clear canvas                                         │
│  ├─ Render background                                    │
│  ├─ Render entities (alpha-interpolated)                 │
│  ├─ Render particles                                     │
│  ├─ Render HUD/UI                                        │
│  └─ Optional debug overlay                               │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ OUTPUT LAYER                                             │
│ (Canvas pixels → screen)                                 │
│ (Web Audio → speakers)                                   │
└──────────────────────────────────────────────────────────┘
```

### State Model

```javascript
// Global game state structure
const gameState = {
  // Player data
  player: {
    id: 'player_uuid',
    name: 'John Doe',
    level: 15,
    totalScore: 5000,
    achievements: new Set(['first_win', 'high_score_100']),
    skillRating: 1200, // Elo-style
    preferences: {
      soundEnabled: true,
      difficultyLevel: 'hard'
    }
  },

  // Game session
  session: {
    gameType: 'cricket', // cricket, football, baseball
    difficulty: 'hard',
    opponent: {
      id: 'opp_ai_15',
      name: 'Virtual Opponent',
      level: 15,
      aggressionEMA: 0.65
    },
    startTime: Date.now(),
    isActive: true
  },

  // Game board/field
  board: {
    width: 414,
    height: 896,
    entities: [], // All game objects
    particles: [] // Visual effects
  },

  // Score and game progress
  score: {
    player: 45,
    opponent: 38,
    rounds: 1,
    totalRounds: 3,
    status: 'active' // active, won, lost, draw
  },

  // Multiplayer (optional)
  multiplayer: {
    enabled: false,
    roomId: null,
    otherPlayers: [],
    syncInterval: 200 // ms
  },

  // Transient AI state
  aiState: {
    lastDecision: null,
    decisionTime: 0,
    phase3Confidence: 0.7,
    claudeAdvisorEnabled: true
  }
};
```

---

## Backend Architecture

### Convex Database Schema

```javascript
// tables/players.ts
export const players = defineTable({
  userId: v.string(),
  name: v.string(),
  email: v.string(),
  level: v.number(),
  totalScore: v.number(),
  skillRating: v.number(),
  createdAt: v.number(), // timestamp
  updatedAt: v.number(),
  preferences: v.object({
    soundEnabled: v.boolean(),
    difficultyLevel: v.string(),
    language: v.string()
  })
});

// tables/sessions.ts
export const sessions = defineTable({
  playerId: v.id('players'),
  gameType: v.string(), // 'cricket', 'football', 'baseball'
  difficulty: v.string(),
  opponentLevel: v.number(),
  score: v.object({
    player: v.number(),
    opponent: v.number()
  }),
  status: v.string(), // 'active', 'completed'
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  duration: v.optional(v.number()), // ms
  playerWon: v.optional(v.boolean())
});

// tables/leaderboard.ts
export const leaderboard = defineTable({
  playerId: v.id('players'),
  playerName: v.string(),
  skillRating: v.number(),
  totalScore: v.number(),
  gamesWon: v.number(),
  gamesPlayed: v.number(),
  winRate: v.number(),
  rank: v.number(),
  lastUpdated: v.number()
});

// tables/achievements.ts
export const achievements = defineTable({
  playerId: v.id('players'),
  achievementId: v.string(),
  unlockedAt: v.number(),
  progress: v.object({
    current: v.number(),
    target: v.number()
  })
});

// tables/multiplayerRooms.ts
export const multiplayerRooms = defineTable({
  code: v.string(), // room code
  createdBy: v.id('players'),
  players: v.array(v.object({
    id: v.id('players'),
    name: v.string(),
    score: v.number(),
    status: v.string()
  })),
  gameType: v.string(),
  maxPlayers: v.number(),
  createdAt: v.number(),
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
  state: v.string() // 'waiting', 'active', 'finished'
});

// tables/campaign.ts
export const campaign = defineTable({
  playerId: v.id('players'),
  currentLevel: v.number(),
  completedLevels: v.array(v.object({
    levelId: v.number(),
    score: v.number(),
    stars: v.number(),
    completedAt: v.number()
  })),
  totalStars: v.number(),
  lastPlayedAt: v.number()
});
```

### Convex API Functions

```typescript
// mutations.ts

export const registerPlayer = mutation(
  async (ctx, args: { name: string; email: string }) => {
    const playerId = await ctx.db.insert('players', {
      userId: args.email,
      name: args.name,
      email: args.email,
      level: 1,
      totalScore: 0,
      skillRating: 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      preferences: {
        soundEnabled: true,
        difficultyLevel: 'medium',
        language: 'en'
      }
    });
    return playerId;
  }
);

export const submitGameResult = mutation(
  async (ctx, args: {
    playerId: string;
    gameType: string;
    playerScore: number;
    opponentScore: number;
    difficulty: string;
    duration: number;
  }) => {
    const sessionId = await ctx.db.insert('sessions', {
      playerId: args.playerId,
      gameType: args.gameType,
      difficulty: args.difficulty,
      opponentLevel: 10,
      score: {
        player: args.playerScore,
        opponent: args.opponentScore
      },
      status: 'completed',
      startedAt: Date.now() - args.duration,
      completedAt: Date.now(),
      duration: args.duration,
      playerWon: args.playerScore > args.opponentScore
    });

    // Update player stats
    const player = await ctx.db.get(args.playerId);
    const newScore = player.totalScore + args.playerScore;
    const newRating = this.calculateNewRating(
      player.skillRating,
      args.playerScore,
      args.opponentScore
    );

    await ctx.db.patch(args.playerId, {
      totalScore: newScore,
      skillRating: newRating,
      updatedAt: Date.now()
    });

    // Update leaderboard
    await this.updateLeaderboard(ctx, args.playerId, newRating);

    return sessionId;
  }
);

export const unlockAchievement = mutation(
  async (ctx, args: { playerId: string; achievementId: string }) => {
    const existing = await ctx.db.query('achievements')
      .filter(q => q.and(
        q.eq(q.field('playerId'), args.playerId),
        q.eq(q.field('achievementId'), args.achievementId)
      ))
      .first();

    if (!existing) {
      await ctx.db.insert('achievements', {
        playerId: args.playerId,
        achievementId: args.achievementId,
        unlockedAt: Date.now(),
        progress: { current: 1, target: 1 }
      });
    }
  }
);

export const createMultiplayerRoom = mutation(
  async (ctx, args: { playerId: string; gameType: string; maxPlayers: number }) => {
    const roomCode = this.generateRoomCode();
    const player = await ctx.db.get(args.playerId);

    const roomId = await ctx.db.insert('multiplayerRooms', {
      code: roomCode,
      createdBy: args.playerId,
      players: [{
        id: args.playerId,
        name: player.name,
        score: 0,
        status: 'ready'
      }],
      gameType: args.gameType,
      maxPlayers: args.maxPlayers,
      createdAt: Date.now(),
      state: 'waiting'
    });

    return { roomId, roomCode };
  }
);

export const joinMultiplayerRoom = mutation(
  async (ctx, args: { playerId: string; roomCode: string }) => {
    const room = await ctx.db.query('multiplayerRooms')
      .filter(q => q.eq(q.field('code'), args.roomCode))
      .first();

    if (!room) throw new Error('Room not found');
    if (room.state !== 'waiting') throw new Error('Game already started');
    if (room.players.length >= room.maxPlayers) throw new Error('Room full');

    const player = await ctx.db.get(args.playerId);
    const updatedPlayers = [...room.players, {
      id: args.playerId,
      name: player.name,
      score: 0,
      status: 'ready'
    }];

    await ctx.db.patch(room._id, { players: updatedPlayers });
    return room._id;
  }
);

// queries.ts

export const getLeaderboard = query(
  async (ctx, args: { limit?: number; offset?: number }) => {
    const limit = args.limit || 20;
    const offset = args.offset || 0;

    return await ctx.db.query('leaderboard')
      .order('desc', q => q.field('skillRating'))
      .paginate({ numPage: offset, pageSize: limit });
  }
);

export const getPlayerRank = query(
  async (ctx, args: { playerId: string }) => {
    const player = await ctx.db.query('leaderboard')
      .filter(q => q.eq(q.field('playerId'), args.playerId))
      .first();

    return player ? player.rank : null;
  }
);

export const getPlayerStats = query(
  async (ctx, args: { playerId: string }) => {
    const player = await ctx.db.get(args.playerId);
    const sessions = await ctx.db.query('sessions')
      .filter(q => q.eq(q.field('playerId'), args.playerId))
      .collect();

    const gamesWon = sessions.filter(s => s.playerWon).length;
    const totalGames = sessions.length;

    return {
      ...player,
      stats: {
        gamesPlayed: totalGames,
        gamesWon,
        winRate: totalGames > 0 ? (gamesWon / totalGames) : 0,
        totalPlayTime: sessions.reduce((sum, s) => sum + (s.duration || 0), 0)
      }
    };
  }
);

export const getMultiplayerRoom = query(
  async (ctx, args: { roomCode: string }) => {
    return await ctx.db.query('multiplayerRooms')
      .filter(q => q.eq(q.field('code'), args.roomCode))
      .first();
  }
);
```

### Convex API Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/api/players/register` | POST | New player signup | `{ name, email }` | `{ playerId, token }` |
| `/api/sessions/submit` | POST | Submit game result | `{ playerId, gameType, scores, difficulty }` | `{ sessionId, newRating }` |
| `/api/leaderboard/get` | GET | Fetch global leaderboard | `?limit=20&offset=0` | `{ players, count, rank }` |
| `/api/leaderboard/rank` | GET | Get player rank | `?playerId=xxx` | `{ rank, skillRating, percentile }` |
| `/api/achievements/unlock` | POST | Unlock achievement | `{ playerId, achievementId }` | `{ success, newAchievements }` |
| `/api/multiplayer/rooms/create` | POST | Create multiplayer room | `{ playerId, gameType, maxPlayers }` | `{ roomId, roomCode }` |
| `/api/multiplayer/rooms/join` | POST | Join multiplayer room | `{ playerId, roomCode }` | `{ roomId, players }` |
| `/api/multiplayer/rooms/sync` | POST | Sync room state (WebSocket) | `{ roomId, playerUpdates }` | `{ allPlayers, state }` |
| `/api/campaign/get` | GET | Get campaign progress | `?playerId=xxx` | `{ currentLevel, completedLevels, stars }` |
| `/api/campaign/complete` | POST | Complete campaign level | `{ playerId, levelId, score, stars }` | `{ newLevel, totalStars }` |

**Deployment:** gallant-kingfisher-867.convex.cloud

---

## Native Bridge & Platform Integration

### Capacitor Architecture

```
┌─────────────────────────────────────────────┐
│   React Native (Expo) / Capacitor UI        │
│   (WebView + Native Wrapper)                │
├─────────────────────────────────────────────┤
│                                             │
│  Native Layer (iOS/Android)                 │
│  ├─ In-App Purchase SDK                     │
│  ├─ Analytics SDK                           │
│  ├─ Push Notifications                      │
│  └─ Contacts/Calendar APIs                  │
│                                             │
│  ↓↑ (Native Bridge)                         │
│                                             │
│  Capacitor Core Plugin Interface            │
│  ├─ registerPlugin('PurchasePlugin')        │
│  ├─ registerPlugin('AnalyticsPlugin')       │
│  └─ registerPlugin('NotificationPlugin')    │
│                                             │
│  ↓↑ (postMessage)                           │
│                                             │
│  WebView JavaScript                         │
│  ├─ window.NativePurchase.buy()             │
│  ├─ window.NativeAnalytics.track()          │
│  └─ window.NativeNotification.request()     │
│                                             │
│  ↓↑ (Event listeners)                       │
│                                             │
│  Game Code (Vanilla JS)                     │
│  ├─ purchaseSuccess event                   │
│  ├─ purchaseFailure event                   │
│  └─ analyticsEvent listener                 │
│                                             │
└─────────────────────────────────────────────┘
```

### Native Bridge Implementation

```javascript
// Native purchase handler (iOS Capacitor)
if (typeof window !== 'undefined' && window.NativePurchase) {
  window.NativePurchase.buy = function(productId) {
    return new Promise((resolve, reject) => {
      try {
        // Setup event listeners
        const successHandler = (data) => {
          window.removeEventListener('purchaseSuccess', successHandler);
          resolve(data);
        };

        const failureHandler = (error) => {
          window.removeEventListener('purchaseFailure', failureHandler);
          reject(error);
        };

        window.addEventListener('purchaseSuccess', successHandler);
        window.addEventListener('purchaseFailure', failureHandler);

        // Call native method via Capacitor
        if (window.capacitor?.NativePurchase?.buy) {
          window.capacitor.NativePurchase.buy({ productId });
        } else {
          reject(new Error('Native purchase not available'));
        }

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('purchaseSuccess', successHandler);
          window.removeEventListener('purchaseFailure', failureHandler);
          reject(new Error('Purchase timeout'));
        }, 30000);
      } catch (err) {
        reject(err);
      }
    });
  };
} else {
  // Web fallback (no native purchases)
  window.NativePurchase = {
    buy: async (productId) => {
      console.warn('Native purchases not available on web');
      return null;
    }
  };
}

// Usage in game code
async function buyPremium() {
  try {
    const receipt = await window.NativePurchase.buy('premium_subscription');

    // Verify receipt on backend
    const response = await fetch('/api/verify-purchase', {
      method: 'POST',
      body: JSON.stringify({ receipt })
    });

    if (response.ok) {
      gameState.player.isPremium = true;
      showPurchaseSuccess();
    }
  } catch (error) {
    console.error('Purchase failed:', error);
    showPurchaseError(error.message);
  }
}
```

### Platform Detection

```javascript
// Platform detection utility
const Platform = {
  isIOS: () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  },

  isAndroid: () => {
    return /Android/.test(navigator.userAgent);
  },

  isWeb: () => {
    return !Platform.isIOS() && !Platform.isAndroid();
  },

  isNative: () => {
    return typeof window.capacitor !== 'undefined' ||
           typeof window.expo !== 'undefined';
  },

  isPWA: () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           navigator.standalone === true;
  },

  getAppVersion: () => {
    if (window.capacitor?.App?.getInfo) {
      return window.capacitor.App.getInfo();
    }
    return null;
  }
};

// Feature capability detection
const Capabilities = {
  hasInAppPurchase: Platform.isNative(),
  hasLocalNotifications: Platform.isNative(),
  hasPushNotifications: Platform.isNative(),
  hasOfflineStorage: true, // All platforms
  hasServiceWorker: 'serviceWorker' in navigator,
  hasWebAudio: window.AudioContext || window.webkitAudioContext
};
```

### Expo Integration

```javascript
// eas.json
{
  "build": {
    "preview": {
      "ios": {
        "resourceClass": "m1"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m1"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}

// app.json
{
  "expo": {
    "name": "Cricket AI 2026",
    "slug": "cricket-ai-2026",
    "version": "1.0.0",
    "assetBundlePatterns": [
      "**/*"
    ],
    "plugins": [
      [
        "expo-superwall",
        {
          "apiKey": "YOUR_SUPERWALL_API_KEY"
        }
      ]
    ],
    "ios": {
      "supportsTabletMode": false,
      "bundleIdentifier": "com.yourstudio.cricket2026"
    }
  }
}
```

---

## Deployment Architecture

### Web Deployment

```
┌────────────────────────────────────────┐
│ GitHub Repository                       │
│ └─ main branch (production)             │
│    └─ dev branch (staging)              │
└───────────────┬────────────────────────┘
                │ git push
                ▼
┌────────────────────────────────────────┐
│ GitHub Actions CI/CD                    │
│ ├─ Trigger: push to main                │
│ ├─ Build: npm run build                 │
│ ├─ Test: npm run test                   │
│ ├─ Generate: dist/ directory            │
│ └─ Artifact: ready for deployment       │
└───────────────┬────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
┌─────────────┐      ┌──────────────┐
│ Vercel      │      │ Netlify      │
│ (Primary)   │      │ (Fallback)   │
│             │      │              │
│ - Builds    │      │ - Builds     │
│ - Preview   │      │ - Deploy     │
│ - CDN       │      │ - CDN        │
│ - Analytics │      │ - Analytics  │
└─────────────┘      └──────────────┘
    │                       │
    └───────────┬───────────┘
                ▼
        ┌───────────────┐
        │ CloudFlare    │
        │ (Edge Cache)  │
        └───────────────┘
                ▼
        https://play.yourgame.com
```

**Web Build Pipeline:**
```bash
# 1. Local development
npm run dev

# 2. Production build
npm run build

# 3. Output: dist/ folder with:
#    - index.html (game)
#    - manifest.json (PWA)
#    - service-worker.js (offline)
#    - CSS/JS (inlined or minified)

# 4. Deploy to Vercel
vercel --prod

# OR Netlify
netlify deploy --prod --dir=dist
```

### iOS App Deployment (Capacitor)

```
┌──────────────────────────────────┐
│ Build iOS App (Capacitor)        │
├──────────────────────────────────┤
│                                  │
│ 1. Build web (npm run build)     │
│    └─ dist/ directory            │
│                                  │
│ 2. Sync Capacitor                │
│    npx cap sync ios              │
│    └─ Updates ios/App folder     │
│                                  │
│ 3. Open Xcode                    │
│    npx cap open ios              │
│    └─ ios/App/App.xcodeproj      │
│                                  │
│ 4. Configure signing             │
│    ├─ Team ID                    │
│    ├─ Bundle ID                  │
│    ├─ Provisioning profile       │
│    └─ Signing certificate        │
│                                  │
│ 5. Archive (Xcode)               │
│    ├─ Build → Archive            │
│    └─ Create .ipa file           │
│                                  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ App Store Connect (Apple)        │
├──────────────────────────────────┤
│ - Upload .ipa                    │
│ - App Review (24-48h)            │
│ - Approval                       │
│ - Release to App Store           │
└──────────────────────────────────┘
               │
               ▼
        ┌────────────────┐
        │ Apple App Store│
        └────────────────┘
```

**iOS Build Commands:**
```bash
# Build web
npm run build

# Sync Capacitor
npx cap sync ios

# Option A: Using Xcode
npx cap open ios
# Then: Product → Archive → Distribute

# Option B: Using EAS Build (Expo)
eas build --platform ios --auto-submit
```

### iOS App Deployment (Expo)

```
┌────────────────────────────────────┐
│ Build using Expo (EAS Build)       │
├────────────────────────────────────┤
│                                    │
│ eas build --platform ios           │
│  ├─ Login to Expo account          │
│  ├─ Remote build (Expo servers)    │
│  ├─ Return .ipa file               │
│  └─ Option: auto-submit to App     │
│     Store via --auto-submit flag   │
│                                    │
└────────────────────────────────────┘
```

**Expo Build Commands:**
```bash
# Login to Expo
npx eas login

# Build for iOS
eas build --platform ios

# Build + auto-submit to App Store
eas build --platform ios --auto-submit

# Build for Android
eas build --platform android

# Monitor build status
eas build --status
```

### Progressive Web App (PWA)

```
┌──────────────────────────────────────────┐
│ PWA Configuration                         │
├──────────────────────────────────────────┤
│                                          │
│ public/manifest.json                     │
│ ├─ name: "Cricket AI 2026"               │
│ ├─ start_url: "/"                        │
│ ├─ display: "standalone"                 │
│ ├─ icons: [{src, sizes, type}]           │
│ └─ theme_color: "#2E7D32"                │
│                                          │
│ Service Worker Registration              │
│ ├─ Scope: /                              │
│ ├─ Assets to precache                    │
│ └─ Network-first strategy                │
│                                          │
│ Installation (Browser Prompt)            │
│ ├─ User clicks "Install"                 │
│ ├─ App added to home screen              │
│ └─ Opens fullscreen (no address bar)     │
│                                          │
└──────────────────────────────────────────┘
```

**Service Worker Caching Strategy:**
```javascript
// Precache critical assets on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('game-v1').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/styles.css',
        '/game.js'
      ]);
    })
  );
});

// Network first, fallback to cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200) {
          return caches.match(event.request);
        }
        const cache = caches.open('game-v1');
        cache.then(c => c.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

---

## Performance Budgets & Optimization

### Frame Budget Breakdown

```
Frame Time Budget: 16.67ms (60 FPS target)

┌─────────────────────────────────────────────┐
│ Frame Composition (16.67ms total)           │
├─────────────────────────────────────────────┤
│                                             │
│ Physics Simulation      3.0ms (18%)         │
│ ├─ Force application                        │
│ ├─ Position integration                     │
│ ├─ Collision detection                      │
│ └─ Collision response                       │
│                                             │
│ AI Decision Making     2.0ms (12%)          │
│ ├─ Rule lookup                              │
│ ├─ Player model query                       │
│ ├─ Prediction ensemble                      │
│ └─ Claude API (async, non-blocking)         │
│                                             │
│ Input Processing       0.5ms (3%)           │
│ ├─ Touch event parsing                      │
│ ├─ Gesture recognition                      │
│ └─ Validation                               │
│                                             │
│ Animation Updates      1.5ms (9%)           │
│ ├─ Sprite frame advances                    │
│ ├─ Tween calculations                       │
│ └─ Particle updates                         │
│                                             │
│ Rendering Pipeline     8.0ms (48%)          │
│ ├─ Clear canvas         0.5ms               │
│ ├─ Background render    1.0ms               │
│ ├─ Entity rendering     4.5ms (500 entities)│
│ ├─ Particle rendering   1.0ms               │
│ └─ HUD/UI rendering     1.0ms               │
│                                             │
│ Housekeeping           1.67ms (10%)         │
│ ├─ Memory management                        │
│ ├─ Event cleanup                            │
│ ├─ State sync                               │
│ └─ Browser overhead                         │
│                                             │
└─────────────────────────────────────────────┘

Note: Async operations (Claude API, Convex)
      are non-blocking and scheduled between frames.
```

### Memory Budget

```
Total Game Footprint: <5MB

├─ Game Code (JS)           800KB
│  ├─ Core engine           400KB
│  ├─ Sport-specific logic  300KB
│  └─ UI/HUD code          100KB
│
├─ Canvas Buffer            ~2.4MB
│  └─ 414×896×4 bytes (RGBA)
│
├─ Entities & Data          800KB
│  ├─ Entity pool (500 max) 400KB
│  ├─ Particle pool (250)   200KB
│  └─ AI state/history      200KB
│
├─ Audio Synthesis          300KB
│  └─ Web Audio API (no files)
│
└─ Miscellaneous            600KB
   ├─ Browser overhead
   ├─ localStorage
   └─ Buffers/temp data
```

### Storage Budget

```
Client-side Storage: <20KB per player

localStorage (5-10KB)
├─ Player preferences       1KB
├─ Current game state       4KB
├─ Cached leaderboard       2KB
└─ Session data            2KB

IndexedDB (optional, 10KB)
├─ Offline game history
├─ Campaign progress
└─ Achievement data

Capacitor Preferences (native storage)
├─ Token/auth (if needed)
├─ User settings
└─ Analytics flags
```

### Performance Monitoring

```javascript
// FPS Counter
class FPSMonitor {
  constructor() {
    this.frames = 0;
    this.fps = 60;
    this.lastTime = performance.now();
  }

  tick() {
    this.frames++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastTime = now;
      console.log(`FPS: ${this.fps}`);
    }
  }
}

// Performance marks
if ('performance' in window) {
  performance.mark('game-start');

  // ... game code ...

  performance.mark('game-end');
  performance.measure('game-cycle', 'game-start', 'game-end');

  const measure = performance.getEntriesByName('game-cycle')[0];
  console.log(`Frame time: ${measure.duration.toFixed(2)}ms`);
}

// Memory usage (Chrome DevTools)
if ('memory' in performance) {
  console.log(`Heap: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)}MB`);
}
```

### Optimization Strategies

| Technique | Implementation | Benefit |
|-----------|-----------------|---------|
| **Object Pooling** | Pre-allocate particle/entity pools | Reduces GC pauses |
| **Spatial Hashing** | Grid-based collision broad phase | Reduces collision checks |
| **Dirty Flagging** | Only render changed entities | Reduces draw calls |
| **Canvas Transform** | Use transform instead of redraw | Faster animations |
| **Audio Synthesis** | Web Audio API (no file decoding) | Faster load, smaller size |
| **Service Worker** | Cache assets on install | Instant load on repeat visits |
| **Lazy Initialization** | AI engines init on first use | Faster startup |
| **Frame Skipping** | Fixed timestep handles gaps | Smooth gameplay |
| **Convex Caching** | LRU cache for Claude API | Reduced latency |
| **Circuit Breaker** | Graceful degradation | Resilient to outages |

---

## Security Architecture

### Data Security

```
┌─────────────────────────────────────┐
│ Client-Side Security                │
├─────────────────────────────────────┤
│                                     │
│ localStorage / Preferences          │
│ ├─ NO sensitive financial data      │
│ ├─ NO auth tokens (client-side)     │
│ ├─ NO passwords                     │
│ ├─ NO PII (email only if necessary) │
│ └─ Game state (game data is OK)     │
│                                     │
│ What IS safe to store:              │
│ ├─ Player name                      │
│ ├─ Score/stats (non-critical)       │
│ ├─ UI preferences (settings)        │
│ ├─ Game progress (can be reset)     │
│ └─ Cached leaderboard               │
│                                     │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ Server-Side Security (Convex)       │
├─────────────────────────────────────┤
│                                     │
│ Authentication                      │
│ ├─ Convex built-in auth             │
│ ├─ Server-side session validation   │
│ └─ No client-side token exposure    │
│                                     │
│ Authorization                       │
│ ├─ Check player ID in mutations     │
│ ├─ Validate request ownership       │
│ └─ Prevent player ID spoofing       │
│                                     │
│ Data Validation                     │
│ ├─ Type checking (Convex v)         │
│ ├─ Range validation (scores)        │
│ ├─ Cheat detection (impossible       │
│    scores flagged)                  │
│ └─ Input sanitization               │
│                                     │
│ API Rate Limiting                   │
│ ├─ 100 requests/min per IP          │
│ ├─ 1 request/sec per player         │
│ └─ Burst allowance (initial)        │
│                                     │
└─────────────────────────────────────┘
```

### API Security

```javascript
// Secure mutation pattern
export const submitGameResult = mutation(
  async (ctx, args: {
    playerId: string;
    playerScore: number;
    opponentScore: number;
    gameType: string;
  }) => {
    // 1. Authenticate (Convex auto-handles via ctx.auth)
    const userId = ctx.auth.getUserId();
    if (!userId) {
      throw new Error('Unauthorized');
    }

    // 2. Authorize (verify player owns this submission)
    const player = await ctx.db.get(args.playerId);
    if (player.userId !== userId) {
      throw new Error('Forbidden: Cannot modify other player data');
    }

    // 3. Validate inputs
    if (typeof args.playerScore !== 'number' || args.playerScore < 0) {
      throw new Error('Invalid score');
    }

    // 4. Cheat detection
    if (args.playerScore > 1000) {
      console.warn(`Suspicious score submitted: ${args.playerScore}`);
      // Flag for review, don't count toward leaderboard
      args.playerScore = Math.min(args.playerScore, 500);
    }

    // 5. Proceed with business logic
    await ctx.db.insert('sessions', {
      playerId: args.playerId,
      playerScore: args.playerScore,
      opponentScore: args.opponentScore,
      gameType: args.gameType,
      completedAt: Date.now()
    });
  }
);

// Rate limiting helper
class RateLimiter {
  constructor() {
    this.requests = new Map(); // playerId → timestamps
  }

  isAllowed(playerId, windowMs = 1000, limit = 10) {
    const now = Date.now();
    const timestamps = this.requests.get(playerId) || [];

    // Remove old timestamps
    const filtered = timestamps.filter(t => now - t < windowMs);

    if (filtered.length >= limit) {
      return false;
    }

    filtered.push(now);
    this.requests.set(playerId, filtered);
    return true;
  }
}
```

### Cheat Detection Patterns

```javascript
// Impossible score detection
function isScoreLikelyCheat(score, gameType, previousHighScore) {
  const maxPossibleScore = GAME_CONSTANTS[gameType].maxScore || 500;

  if (score > maxPossibleScore) {
    return true; // Exceeds physical limits
  }

  // Check for unrealistic improvement
  if (previousHighScore && score > previousHighScore * 2) {
    return true; // 100%+ improvement is suspicious
  }

  return false;
}

// Session time validation
function isSessionDurationValid(startTime, endTime, minMs, maxMs) {
  const duration = endTime - startTime;

  if (duration < minMs) {
    return false; // Completed too fast
  }

  if (duration > maxMs) {
    return false; // Took too long (likely background)
  }

  return true;
}

// Leaderboard ranking validation
async function validateLeaderboardEntry(ctx, playerId, score) {
  const recentSessions = await ctx.db.query('sessions')
    .filter(q => q.and(
      q.eq(q.field('playerId'), playerId),
      q.gt(q.field('completedAt'), Date.now() - 3600000) // Last hour
    ))
    .collect();

  // Check for rapid score submission (spam detection)
  if (recentSessions.length > 50) {
    // Possible bot/automated submission
    return false;
  }

  return true;
}
```

### Third-Party Security

```javascript
// Claude API security
class ClaudeAIAdvisor {
  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY; // Server-side only
    this.timeout = 5000; // 5 second timeout
    this.maxTokens = 200; // Limit response length
    this.circuitBreaker = new CircuitBreaker();
  }

  async callClaudeAPI(prompt) {
    // 1. Validate prompt (no secrets)
    if (this.containsSecrets(prompt)) {
      throw new Error('Prompt contains sensitive data');
    }

    // 2. Rate limit
    if (!this.rateLimiter.isReady()) {
      throw new Error('Rate limit exceeded');
    }

    // 3. Circuit breaker (fail gracefully)
    if (this.circuitBreaker.isOpen()) {
      throw new Error('Service temporarily unavailable');
    }

    try {
      // 4. Make API call with timeout
      const response = await Promise.race([
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet',
            max_tokens: this.maxTokens,
            messages: [{ role: 'user', content: prompt }]
          })
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        )
      ]);

      return await response.json();
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  containsSecrets(text) {
    const secretPatterns = [
      /api[_-]?key/i,
      /bearer\s+[a-z0-9]+/i,
      /password/i,
      /token/i
    ];
    return secretPatterns.some(p => p.test(text));
  }
}

// Convex backend security
// ✓ No client-side API keys
// ✓ All mutations validated server-side
// ✓ Automatic CORS handling
// ✓ Built-in DDoS protection
// ✓ Data encrypted at rest
```

---

## Component Dependency Maps

### High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    UNIFIED GAME ENGINE                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ INPUT LAYER                                          │  │
│  │ ├─ Touch Handler                                     │  │
│  │ ├─ Gesture Recognizer                                │  │
│  │ └─ Accessibility Input                               │  │
│  └─────────────────┬────────────────────────────────────┘  │
│                    │                                        │
│  ┌─────────────────▼────────────────────────────────────┐  │
│  │ SCREEN MANAGER (State Machine)                       │  │
│  │ ├─ Menu Screen                                       │  │
│  │ ├─ Game Screen                                       │  │
│  │ ├─ Leaderboard Screen                                │  │
│  │ ├─ Settings Screen                                   │  │
│  │ └─ [12+ more screens]                                │  │
│  └─────────────────┬────────────────────────────────────┘  │
│                    │                                        │
│  ┌─────────────────▼────────────────────────────────────┐  │
│  │ GAME LOOP                                            │  │
│  │ ├─ Fixed Update (60Hz)                               │  │
│  │ │  ├─ Physics Engine                                 │  │
│  │ │  ├─ Collision System                               │  │
│  │ │  └─ AI Engine                                      │  │
│  │ ├─ Variable Update                                   │  │
│  │ │  ├─ Animation System                               │  │
│  │ │  ├─ Particle System                                │  │
│  │ │  └─ Audio Synth                                    │  │
│  │ └─ Render (interpolated)                             │  │
│  │    ├─ Canvas Renderer                                │  │
│  │    └─ HUD Renderer                                   │  │
│  └─────────────────┬────────────────────────────────────┘  │
│                    │                                        │
│  ┌─────────────────┴────────────────────────────────────┐  │
│  │ STATE MANAGEMENT                                     │  │
│  ├─ Entity Manager                                      │  │
│  ├─ Event System                                        │  │
│  ├─ Data Serialization                                  │  │
│  └─ Persistence Layer                                   │  │
│     ├─ localStorage (web)                               │  │
│     ├─ Capacitor Preferences (native)                   │  │
│     └─ Convex Backend (remote)                          │  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Entity-Component System

```
┌──────────────────────────────────────┐
│ Entity                                │
├──────────────────────────────────────┤
│ id: string                            │
│ position: {x, y}                      │
│ velocity: {x, y}                      │
│ zIndex: number                        │
│ components: Map<string, Component>    │
└──────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Transform│ │Collider │ │Renderer │
│         │ │         │ │         │
│ pos     │ │ box     │ │ sprite  │
│ rot     │ │ circle  │ │ layer   │
│ scale   │ │ polygon │ │ opacity │
└─────────┘ └─────────┘ └─────────┘
    │            │            │
    └────────────┼────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐ ┌──────────┐ ┌──────────┐
│Physics │ │Behavior  │ │Animation │
│        │ │          │ │          │
│ force  │ │ state    │ │ frame    │
│ mass   │ │ logic    │ │ duration │
│ damping│ │ event    │ │ ease     │
└────────┘ └──────────┘ └──────────┘
```

### AI Engine Component Hierarchy

```
AIEngine (orchestrator)
│
├─ RuleBasedEngine (Phase 1)
│  ├─ CricketRules
│  ├─ FootballRules
│  └─ BaseballRules
│
├─ PlayerModelEngine (Phase 2)
│  ├─ FrequencyTable
│  ├─ EMA Calculator
│  └─ HistoryTracker
│
├─ PredictionEngine (Phase 3)
│  ├─ BayesPredictor
│  │  ├─ OutcomeDistribution
│  │  └─ ConditionalProbability
│  ├─ SequencePredictor
│  │  ├─ MarkovChain
│  │  └─ NGramModel
│  └─ DifficultyAdjuster
│     ├─ SkillDetector
│     └─ ScalingFunction
│
└─ ClaudeAIAdvisor (Phase 4)
   ├─ APIClient
   ├─ LRUCache
   ├─ RateLimiter
   └─ CircuitBreaker
```

### Render Pipeline Dependencies

```
Frame Start
    │
    ├─ Calculate interpolation (alpha)
    │
    ├─ BACKGROUND LAYER
    │  └─ renderStadium()
    │
    ├─ ENTITY LAYER
    │  ├─ Sort by z-index
    │  └─ For each entity:
    │     ├─ Get Transform
    │     ├─ Get Renderer
    │     ├─ Interpolate position
    │     └─ Render sprite
    │
    ├─ PARTICLE LAYER
    │  └─ For each particle:
    │     ├─ Interpolate pos/scale/opacity
    │     └─ Draw (circle/sprite)
    │
    ├─ HUD LAYER
    │  ├─ Score/timer
    │  ├─ Buttons
    │  └─ Alerts
    │
    ├─ DEBUG LAYER (if enabled)
    │  ├─ Colliders (AABB)
    │  ├─ Entity IDs
    │  ├─ FPS counter
    │  └─ Memory usage
    │
    └─ SWAP BUFFERS
       └─ Display on screen
```

---

## Network & Data Synchronization

### Multiplayer Synchronization Protocol

```
Client A (Player 1)          Server (Convex)          Client B (Player 2)
    │                               │                          │
    ├─ Player moves ──────────────→ │                          │
    │   (action event)              │                          │
    │                               ├─ Broadcast update ──────→ │
    │                               │   (movement, score)      │
    │   ← ACK ────────────────────  │                          │
    │   (server accepted)           │                          │
    │                               │ ← Player moves ───────── │
    │   ← Update ────────────────── ├─ Broadcast update ──────→ │
    │   (other player's move)       │                          │
    │                               │                          │
    │ [Sync interval: 200ms]        │                          │
    │                               │                          │
    ├─ Position sync ─────────────→ │                          │
    │   (periodic heartbeat)        ├─ Reconciliation ────────→ │
    │                               │   (authoritative state)   │
    │                               │                          │
    └─ [Continue game] ────────────→ │ ← Continue game ──────── │
                                    │   (both sides)
```

### Real-time State Sync

```javascript
// Client-side multiplayer sync
class MultiplayerManager {
  constructor(roomId, playerId) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.syncInterval = 200; // ms
    this.lastSyncTime = Date.now();
    this.pendingActions = [];
  }

  update(dt) {
    const now = Date.now();

    if (now - this.lastSyncTime >= this.syncInterval) {
      this.syncToServer();
      this.lastSyncTime = now;
    }
  }

  async syncToServer() {
    if (this.pendingActions.length === 0) return;

    const payload = {
      roomId: this.roomId,
      playerId: this.playerId,
      actions: this.pendingActions,
      timestamp: Date.now(),
      gameState: {
        position: gameState.player.position,
        score: gameState.score.player,
        health: gameState.player.health
      }
    };

    try {
      const response = await fetch('/api/multiplayer/sync', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      // Apply authoritative state from server
      if (result.otherPlayers) {
        this.reconcileRemotePlayers(result.otherPlayers);
      }

      this.pendingActions = [];
    } catch (error) {
      console.error('Sync failed:', error);
      // Keep pending actions for retry
    }
  }

  recordAction(action) {
    this.pendingActions.push({
      type: action.type,
      data: action.data,
      timestamp: Date.now()
    });
  }

  reconcileRemotePlayers(remotePlayers) {
    for (const remotePlayer of remotePlayers) {
      if (remotePlayer.id === this.playerId) continue;

      const localPlayer = gameState.entities.find(
        e => e.id === `player_${remotePlayer.id}`
      );

      if (localPlayer) {
        // Interpolate position (smooth movement)
        localPlayer.targetX = remotePlayer.position.x;
        localPlayer.targetY = remotePlayer.position.y;

        // Update score
        gameState.score.opponent = remotePlayer.score;
      }
    }
  }
}
```

### Offline Support

```javascript
// Service Worker offline handling
self.addEventListener('fetch', event => {
  const { request } = event;

  // Game assets: cache first
  if (request.url.includes('assets') || request.url.includes('.js')) {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request);
      })
    );
    return;
  }

  // API calls: network first with fallback
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            // Cache successful API responses
            caches.open('api-cache').then(cache => {
              cache.put(request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached response or offline indicator
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline page
            return new Response('Offline mode: Game data cached, sync when online', {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
    return;
  }

  // Default: network first
  event.respondWith(fetch(request).catch(() => {
    return caches.match(request);
  }));
});

// Client: Detect offline and queue updates
class OfflineQueue {
  constructor() {
    this.queue = JSON.parse(localStorage.getItem('offlineQueue')) || [];
  }

  async enqueue(action) {
    this.queue.push({
      action,
      timestamp: Date.now()
    });
    this.persist();
  }

  persist() {
    localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
  }

  async flushWhenOnline() {
    if (!navigator.onLine) {
      window.addEventListener('online', () => this.flush());
      return;
    }

    await this.flush();
  }

  async flush() {
    for (const item of this.queue) {
      try {
        await this.submitAction(item.action);
      } catch (error) {
        console.error('Failed to submit offline action:', error);
        return; // Stop on first failure, retry later
      }
    }
    this.queue = [];
    this.persist();
  }

  async submitAction(action) {
    const response = await fetch('/api/action', {
      method: 'POST',
      body: JSON.stringify(action)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
  }
}
```

---

## Appendix: Diagrams & Reference

### Technology Stack Summary

```
┌─────────────────────────────────────────────────────────────┐
│                  TECHNOLOGY STACK                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ FRONTEND                                                    │
│ ├─ Language: Vanilla JavaScript (ES6+)                      │
│ ├─ Rendering: HTML5 Canvas 2D                               │
│ ├─ Styling: CSS (inlined)                                   │
│ ├─ Input: Touch Events API                                  │
│ ├─ Audio: Web Audio API (synthesis)                         │
│ ├─ Storage: localStorage + Capacitor Preferences            │
│ └─ Offline: Service Worker + PWA manifest                   │
│                                                             │
│ AI & ML                                                     │
│ ├─ Pattern Matching: Lookup tables (arrays)                 │
│ ├─ Player Modeling: Frequency tables + EMA                  │
│ ├─ Prediction: Bayesian + Markov chains                     │
│ ├─ ML Inference: TensorFlow.js 4.x (Football only)          │
│ └─ External AI: Claude API (Anthropic)                      │
│                                                             │
│ BACKEND                                                     │
│ ├─ Database: Convex (BaaS)                                  │
│ ├─ API: Convex mutations/queries                            │
│ ├─ Auth: Convex built-in                                    │
│ ├─ Multiplayer: WebSocket rooms                             │
│ └─ Deployment: gallant-kingfisher-867.convex.cloud          │
│                                                             │
│ NATIVE PLATFORMS                                            │
│ ├─ iOS:                                                     │
│ │  ├─ Capacitor 5/6 → Xcode → App Store                     │
│ │  └─ Expo 55 → EAS Build → App Store                       │
│ ├─ Android:                                                 │
│ │  ├─ Capacitor 5/6 → Android Studio → Play Store           │
│ │  └─ Expo 55 → EAS Build → Play Store                      │
│ └─ Web: Vercel / Netlify (static hosting)                   │
│                                                             │
│ PAYMENTS                                                    │
│ ├─ SDK: Superwall (expo-superwall)                          │
│ ├─ Native Bridge: window.NativePurchase                     │
│ └─ Validation: Server-side (Convex)                         │
│                                                             │
│ CI/CD                                                       │
│ ├─ VCS: GitHub                                              │
│ ├─ Build: GitHub Actions                                    │
│ ├─ Web Build: Vite / esbuild                                │
│ ├─ iOS: Capacitor + Xcode OR EAS Build                      │
│ └─ Deploy: Vercel / Netlify + App Store + Play Store        │
│                                                             │
│ MONITORING (Optional)                                       │
│ ├─ Error Tracking: Sentry                                   │
│ ├─ Analytics: Convex events                                 │
│ └─ Performance: Chrome DevTools                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
game-ecosystem/
├── README.md
├── package.json
├── tsconfig.json (if using TypeScript)
│
├── src/
│  ├── index.html (main entry, 12K-16K LOC single file)
│  ├── styles.css (inlined)
│  ├── main.js (game loop, initialization)
│  │
│  ├── engine/
│  │  ├── ScreenManager.js
│  │  ├── GameLoop.js
│  │  ├── Entity.js
│  │  ├── Component.js
│  │  ├── Renderer.js
│  │  └── Physics.js
│  │
│  ├── ai/
│  │  ├── AIEngine.js (orchestrator)
│  │  ├── RuleBasedEngine.js (Phase 1)
│  │  ├── PlayerModelEngine.js (Phase 2)
│  │  ├── PredictionEngine.js (Phase 3)
│  │  └─ ClaudeAIAdvisor.js (Phase 4)
│  │
│  ├── sports/
│  │  ├── cricket/
│  │  │  ├── CricketRules.js
│  │  │  ├── CricketScreen.js
│  │  │  └── CricketAssets.js
│  │  ├── football/
│  │  │  ├── FootballRules.js
│  │  │  ├── FootballScreen.js
│  │  │  └── FootballAssets.js
│  │  └── baseball/
│  │     ├── BaseballRules.js
│  │     ├── BaseballScreen.js
│  │     └── BaseballAssets.js
│  │
│  ├── screens/
│  │  ├── MenuScreen.js
│  │  ├── GameScreen.js
│  │  ├── LeaderboardScreen.js
│  │  ├── SettingsScreen.js
│  │  ├── MultiplayerScreen.js
│  │  └── [10+ more]
│  │
│  ├── backend/
│  │  ├── convex/
│  │  │  ├── _generated/
│  │  │  ├── functions/
│  │  │  │  ├── mutations.ts
│  │  │  │  └─ queries.ts
│  │  │  └─ convex.json
│  │  └─ api.js (client wrapper)
│  │
│  ├── utils/
│  │  ├── Math.js
│  │  ├── Platform.js
│  │  ├── Storage.js
│  │  ├── Audio.js
│  │  └─ Cache.js
│  │
│  └── native/
│     ├── capacitor.config.json
│     ├── bridge.js (WebView bridge)
│     └─ eas.json (Expo config)
│
├── public/
│  ├── manifest.json (PWA)
│  ├── icons/ (192x192, 512x512)
│  ├── apple-touch-icon.png
│  └─ robots.txt
│
├── dist/ (build output)
│  ├── index.html
│  ├── game.js (minified)
│  ├── service-worker.js
│  └─ manifest.json
│
├── ios/ (Capacitor output)
│  ├── App/
│  └─ Podfile
│
├── android/ (Capacitor output)
│  └─ app/
│
├── .github/workflows/
│  ├── build-web.yml
│  ├── build-ios.yml
│  └─ deploy.yml
│
└── docs/
   ├── ARCHITECTURE.md (this file)
   ├── API_REFERENCE.md
   ├── DEPLOYMENT_GUIDE.md
   └─ PERFORMANCE_GUIDE.md
```

### Deployment Checklist

- [ ] **Web Build**
  - [ ] npm run build (generates dist/)
  - [ ] Verify dist/index.html is single-file
  - [ ] Test locally: npx serve dist/
  - [ ] Deploy to Vercel: vercel --prod
  - [ ] Verify PWA: lighthouse audit

- [ ] **iOS Deployment**
  - [ ] npx cap sync ios
  - [ ] Open in Xcode: npx cap open ios
  - [ ] Set Team ID and Bundle ID
  - [ ] Archive and export
  - [ ] Upload to App Store Connect
  - [ ] Wait for App Review (24-48h)

- [ ] **Expo Deployment**
  - [ ] eas build --platform ios
  - [ ] eas build --platform android
  - [ ] eas submit --platform ios
  - [ ] eas submit --platform android

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-30 | Initial comprehensive architecture document |

---

**Document Status:** FINAL
**Last Updated:** 2026-03-30
**Maintainer:** System Architect Team
**Access Level:** Internal / Engineering Team

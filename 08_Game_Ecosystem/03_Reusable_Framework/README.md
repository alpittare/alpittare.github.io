# Reusable Game Framework

**Production-ready HTML5 Canvas game engine** extracted and refined from 3 shipping games (Cricket AI 2026, Football AI 2026, Baseball AI 2026).

![Status](https://img.shields.io/badge/status-production-blue) ![ES6+](https://img.shields.io/badge/javascript-ES6+-yellow) ![Mobile](https://img.shields.io/badge/platform-mobile-green) ![Zero_Deps](https://img.shields.io/badge/dependencies-zero-brightgreen)

---

## Architecture Overview

The framework is organized into **10 core modules**, each independently functional:

```
GameEngine (core loop, entity management)
├── StateManager (screen state machine)
├── InputManager (touch, mouse, virtual joystick)
├── PhysicsEngine (gravity, collision, resolution)
├── AIEngine (4-phase: rules → learning → prediction → Claude API)
├── AudioEngine (Web Audio synthesis, no external files)
├── Renderer (camera, particles, trails, easing)
├── GameState (localStorage + Capacitor persistence)
├── ShopSystem (coins, gems, IAP, VIP)
└── CampaignManager (100-level progression)
```

### Key Features

- **60Hz fixed-step physics** with variable-rate rendering for smooth gameplay
- **DPI-aware canvas** (414×896 default mobile format, configurable)
- **Zero external dependencies** — pure ES6+ JavaScript
- **Zero external audio files** — procedural Web Audio synthesis
- **Mobile-optimized** with iOS AudioContext workaround, passive event listeners
- **4-Phase AI system**: Rule tables → PlayerModel → Bayesian prediction → Claude API (optional)
- **Production-ready error handling** and edge case coverage
- **Budget-aware AI** (max 2ms per frame)
- **Circuit-breaker pattern** for API calls (3 errors → 60s recovery)
- **Responsive design** with coordinate transformation

---

## Module Descriptions

### 1. Core GameEngine (`core/GameEngine.js`)

**Main game loop with fixed-step physics and variable render rate.**

```typescript
class GameEngine {
  // Fixed 60Hz physics, variable rendering
  // Entity registry with lazy add/remove
  // State machine with lifecycle hooks
  // Event system for decoupled communication
}

class Entity {
  // Base class for all game objects
  // Position, velocity, z-index, active/visible flags
  // Interpolation for smooth visuals
  // AABB bounds
}
```

**Usage:**

```javascript
const engine = new GameEngine('canvas-id', 414, 896);

// Add entity
const player = new Entity(100, 100);
player.update = (dt) => { /* called every frame */ };
player.render = (ctx, alpha) => { /* draw at interpolated position */ };
engine.addEntity(player);

// State machine
engine.registerState('game', {
  enter() { /* initialize state */ },
  update(dt) { /* called per frame */ },
  fixedUpdate(dt) { /* called at 60Hz */ },
  render(ctx, alpha) { /* draw state */ },
  exit() { /* cleanup */ }
});
engine.switchState('game');

// Events
engine.on('jump', (data) => console.log('Jump!', data));
engine.emit('jump', { entity: player });

engine.start(); // Begin game loop
```

### 2. StateManager (`core/StateManager.js`)

**Screen-level state machine for menu, game, settings, etc.**

```javascript
const stateManager = new StateManager(engine);

stateManager.register('menu', {
  enter() { /* show menu */ },
  handleInput(event) { /* process input */ },
  render(ctx, alpha) { /* draw menu */ }
});

stateManager.switchTo('menu', { data: 'optional' });
stateManager.goBack(); // From history
```

### 3. PhysicsEngine (`physics/PhysicsEngine.js`)

**Gravity, friction, collision detection and resolution.**

```javascript
class PhysicsBody {
  // gravity = 1400 px/s² (mobile-tuned)
  // maxFallSpeed = 900 px/s
  // friction = 0.85 (ground) / 0.98 (air)
}

const collision = new CollisionSystem(engine);

// Register collider with callback
collision.register(entity, {
  isTrigger: false,
  onCollide(other, overlap) { /* handle collision */ }
});

// AABB detection + resolution, sets grounded flag
collision.update();

// Raycast for hit detection
const entity = collision.raycast(x, y);
```

### 4. AIEngine (`ai/AIEngine.js`) — The Crown Jewel

**4-Phase AI system combining rules, learning, Bayesian prediction, and Claude API.**

```javascript
const aiEngine = new AIEngine({
  sport: 'cricket',
  enablePhase4: true // Claude API
});

// Phase 1: Register weighted decision tables
aiEngine.registerDecisionTable('bouncer|short', {
  'PULL': 0.8,
  'DEFEND': 0.2
});

// Phase 2: Player learning (automatic via playerModel)
aiEngine.playerModel.recordBatting(
  { ball_type: 'bouncer', length: 'short' },
  { action: 'PULL', quality: 'good', runs: 4 }
);

// Phase 3: Bayesian prediction + Adaptive difficulty
const decision = await aiEngine.makeDecision({
  ballType: 'bouncer',
  line: 'off',
  phase: 'normal'
});
// Returns: { action, confidence, source }

// Get AI stats
const stats = aiEngine.getStats();
```

#### 4-Phase Flow

1. **Phase 1 (Rules)**: Weighted lookup tables for deterministic behavior
2. **Phase 2 (Learning)**: PlayerModel tracks behavior patterns (frequency tables, aggression EMA)
3. **Phase 3 (Prediction)**: BayesPredictor + AdaptiveDifficulty
   - Conditional probability: P(action | context)
   - Dynamic difficulty keeps win rate at target (e.g., 45%)
4. **Phase 4 (Claude API)** (optional):
   - Circuit-breaker after 3 errors (60s recovery)
   - LRU cache (50 items, 30s TTL)
   - Rate-limited to 5s minimum between calls

### 5. InputManager (`input/InputManager.js`)

**Touch, mouse, and virtual joystick support.**

```javascript
const inputManager = new InputManager(engine, {
  enableVirtualJoystick: true,
  joystickX: 100,
  joystickY: 700
});

// Register button
inputManager.registerButton(x, y, w, h, (event) => {
  console.log('Button pressed:', event.tag);
}, 'play_button');

// Listen for events
inputManager.on('swipe', (data) => {
  console.log(`Swipe: angle=${data.angle}, distance=${data.distance}`);
});

inputManager.on('tap', (pos) => {
  console.log(`Tap at`, pos);
});

// Get joystick input
const x = inputManager.getAxis('horizontal');
const y = inputManager.getAxis('vertical');

inputManager.render(ctx); // Draw joystick
```

### 6. AudioEngine (`audio/AudioEngine.js`)

**Web Audio API synthesis — zero external audio files.**

```javascript
const audio = new AudioEngine();
audio.initContext(); // Required on mobile (user interaction)

// Play predefined effects
audio.playEffect('hit');      // Hit sound
audio.playEffect('score');    // Score sound
audio.playEffect('miss');     // Miss sound
audio.playEffect('coin');     // Coin pickup
audio.playEffect('levelup');  // Level complete

// Custom tone
audio.playTone({
  freq: 440,
  duration: 0.5,
  type: 'sine',
  adsr: [0.05, 0.1, 0.2, 0.1], // attack, decay, sustain, release
  gain: 0.5
});

// Frequency sweep (pitch slide)
audio.playSweep(440, 880, 0.5);

// Noise (percussion)
audio.playNoise(0.1, 0.3);

// Control
audio.setMasterGain(0.5);
audio.toggleMute();
```

### 7. Renderer (`rendering/Renderer.js`)

**Canvas rendering with camera, particles, trails, easing.**

```javascript
const renderer = new Renderer(ctx, 414, 896);

// Camera system
renderer.camera.shake(10, 0.5); // Shake 10px for 0.5s
renderer.camera.zoom = 1.2;
renderer.camera.update(dt);
renderer.camera.apply(ctx); // Apply transforms

// Particle system
renderer.particles.emit(x, y, 20, {
  vx: 100, vy: -200, spread: 300,
  color: '#0f0', lifetime: 1
});
renderer.particles.update(dt);
renderer.particles.render(ctx);

// Trail rendering
const trail = new TrailRenderer();
trail.addPoint(x, y, '#0f0');
trail.render(ctx);

// Text with shadow/glow
renderer.drawText('Score: 1000', 50, 50, {
  color: '#fff',
  font: 'bold 24px Arial',
  align: 'center',
  shadow: true,
  glow: true
});

// Easing functions
const eased = Easing.lerp(0, 100, 0.5); // 50
const outCubic = Easing.easeOutCubic(t);
const outBack = Easing.easeOutBack(t);
const inOutQuad = Easing.easeInOutQuad(t);
```

### 8. GameState (`state/GameState.js`)

**Persistent game state with localStorage and Capacitor support.**

```javascript
const gameState = new GameState();
await gameState.initialize(); // Load from storage

// Modify state
gameState.coins += 100;
gameState.currentLevel = 5;
gameState.unlockAchievement('first_win');
gameState.markDirty(); // Auto-save (throttled to 500ms)

// Save/load
await gameState.save();
const loaded = await gameState.load();

// Schema versioning + migration
// Handles Capacitor Preferences (native) fallback to localStorage

// Events
gameState.on('achievement_unlocked', (data) => {
  console.log('Achievement unlocked:', data.id);
});

// Export/import
const json = gameState.toJSON();
gameState.fromJSON(json); // Restore
```

### 9. ShopSystem (`monetization/ShopSystem.js`)

**Currency, shop, IAP, daily rewards, VIP.**

```javascript
const shop = new ShopSystem(gameState, {
  coinRewards: {
    levelWin: 100,
    challenge: 200,
    daily: 50
  }
});

// Reward coins
shop.awardCoins(100, 'level_win');

// Purchase with coins
if (shop.purchaseWithCoins('diamond', 'skin')) {
  console.log('Purchased diamond skin');
}

// Purchase with gems
if (shop.purchaseWithGems('legendary', 'skin')) {
  console.log('Purchased legendary skin');
}

// IAP (bridges to native iOS/Android)
await shop.purchaseViaIAP('gems_100');

// Daily reward (7-day streak)
const reward = shop.claimDailyReward(); // Returns coins

// VIP system
shop.activateVip('pro'); // 30-day VIP
if (shop.isVipActive()) {
  const multiplier = 1.5; // 50% coin bonus
}

// Shop items
const skins = shop.getAvailableSkins();
shop.activatePowerup('shield');
```

### 10. CampaignManager (`campaign/CampaignManager.js`)

**100-level campaign with progressive difficulty and boss levels.**

```javascript
const campaign = new CampaignManager(gameState);

// Get level config
const level = campaign.getLevel(1);
// {
//   number: 1,
//   difficulty: 'easy',
//   theme: 'default',
//   isBoss: false,
//   baseReward: 50,
//   timeLimit: 60,
//   targetScore: 1000,
//   modifiers: []
// }

// Complete level and get rewards
const { stars, coinReward } = campaign.completeLevel(
  1,
  score = 950,
  timeTaken = 45
);

// Check unlock
if (campaign.isLevelUnlocked(5)) {
  console.log('Level 5 is available');
}

// Campaign stats
const stats = campaign.getStats();
// {
//   currentLevel,
//   maxLevelUnlocked,
//   progress: 0-100,
//   completion: 0-100,
//   totalStars,
//   maxStars
// }

// Get all levels
const allLevels = campaign.getAllLevelsSummary();
```

---

## Quick Start

### Basic Game Setup

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; overflow: hidden; background: #000; }
        canvas { display: block; }
    </style>
</head>
<body>
    <canvas id="game"></canvas>

    <script type="module">
        import { createGame } from './index.js';

        // Create game instance
        const game = await createGame({
            canvasId: 'game',
            width: 414,
            height: 896,
            sport: 'cricket',
            enableAI: true,
            enableAudio: true,
            enableShop: true
        });

        // Register game state
        game.stateManager.register('game', {
            enter() { console.log('Game started'); },
            update(dt) { /* game logic */ },
            render(ctx, alpha) { /* draw game */ }
        });

        // Start game
        game.stateManager.switchTo('game');
        game.start();

        // Auto-save periodically
        setInterval(() => game.save(), 30000);
    </script>
</body>
</html>
```

### Custom Entity

```javascript
class Player extends Entity {
    constructor(x, y) {
        super(x, y);
        this.width = 40;
        this.height = 60;
        this.color = '#0f0';
        this.speed = 220;
        this.moveDir = 0;
    }

    update(dt) {
        // Handle input
        this.moveDir = inputManager.getAxis('horizontal');
    }

    fixedUpdate(dt) {
        // Physics
        this.vx = this.moveDir * this.speed;
        super.fixedUpdate(dt); // Move entity
    }

    render(ctx, alpha) {
        // Interpolated rendering
        const x = this.lerpX(alpha);
        const y = this.lerpY(alpha);
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, this.width, this.height);
    }
}

const player = new Player(100, 400);
engine.addEntity(player);
```

---

## Configuration Options

### GameEngine

```javascript
new GameEngine(canvasId, width = 414, height = 896);
```

- `canvasId`: DOM element ID
- `width`, `height`: Game viewport size (default 414×896 for mobile)

### StateManager

```javascript
const states = new StateManager(engine);
states.register(name, {
  enter(data) {},
  update(dt) {},
  fixedUpdate(dt) {},
  render(ctx, alpha) {},
  exit() {},
  handleInput(event) {}
});
```

### PhysicsBody

```javascript
new PhysicsBody(entity, {
  gravity: 1400,
  maxFallSpeed: 900,
  friction: 0.85,
  airFriction: 0.98,
  bounce: 0,
  isStatic: false,
  isSolid: true
});
```

### AIEngine

```javascript
new AIEngine({
  budget: 2, // milliseconds per frame
  sport: 'cricket',
  enablePhase4: false // Claude API
});
```

### InputManager

```javascript
new InputManager(engine, {
  enableVirtualJoystick: true,
  joystickX: 100,
  joystickY: 700
});
```

### AudioEngine

```javascript
new AudioEngine({
  masterGain: 0.3 // 0-1
});
```

### GameState

```javascript
const state = new GameState();
await state.initialize();
```

Supports **50+ properties** (coins, gems, level, achievements, settings, etc.)

### ShopSystem

```javascript
new ShopSystem(gameState, {
  coinRewards: {
    levelWin: 100,
    challenge: 200,
    daily: 50
  },
  itemPrices: { /* ... */ }
});
```

### CampaignManager

```javascript
new CampaignManager(gameState, {
  maxLevels: 100,
  enableBossLevels: true
});
```

---

## Performance Guidelines

- **Physics**: Budget 1-2ms per frame for AI decisions
- **Entities**: Keep < 500 active entities for smooth 60 FPS
- **Particles**: Pool-based system, max 250 particles
- **Audio**: Lazy-load Web Audio context on first user interaction
- **Storage**: PlayerModel uses 2-4 KB per player profile
- **Memory**: Framework footprint ~200 KB minified

---

## Mobile Optimization

The framework is production-tested on iOS and Android:

1. **DPI Scaling**: Automatic canvas scaling for Retina displays
2. **Audio**: iOS AudioContext resume workaround (requires user interaction)
3. **Touch Events**: Passive listeners for 60 FPS scrolling
4. **Capacitor**: Native storage fallback for persistent data
5. **Responsive**: Maintains 414×896 aspect ratio with viewport meta tag
6. **WebView Compatibility**: roundRect polyfill for older iOS WebViews

---

## File Structure

```
03_Reusable_Framework/
├── core/
│   ├── GameEngine.js      (376 lines)
│   └── StateManager.js    (183 lines)
├── physics/
│   └── PhysicsEngine.js   (305 lines)
├── ai/
│   ├── AIEngine.js        (285 lines)
│   ├── PlayerModel.js     (520 lines)
│   ├── BayesPredictor.js  (220 lines)
│   └── AdaptiveDifficulty.js (210 lines)
├── input/
│   └── InputManager.js    (425 lines)
├── audio/
│   └── AudioEngine.js     (295 lines)
├── rendering/
│   └── Renderer.js        (380 lines)
├── state/
│   └── GameState.js       (320 lines)
├── monetization/
│   └── ShopSystem.js      (385 lines)
├── campaign/
│   └── CampaignManager.js (340 lines)
├── index.js               (Main entry point)
└── README.md              (This file)
```

**Total: ~4,000 lines of production code, zero external dependencies**

---

## License

Production-grade framework built from battle-tested game code. Use as-is or modify freely.

**Version**: 1.0.0
**Last Updated**: 2026-03-30
**Status**: Production Ready

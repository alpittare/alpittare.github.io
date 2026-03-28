---
name: game-engine-ii
description: >
  Modular AI Game Platform — generates new game modules that plug into an existing HTML5 Canvas
  game engine. Use this skill whenever the user wants to: add a new game type to their multi-game
  platform (e.g., "build a tennis game", "add basketball", "create a fighting game module"),
  extend an existing game module with new features, or generate game-specific AI hooks.
  Also trigger when the user mentions: game module, new game type, game plugin, extend engine,
  add a sport, arcade module, combat module, module generation, multi-game platform, or
  game-specific physics. This skill does NOT rebuild the core engine — it generates only the
  module files needed to add a new game to the platform. If the user wants to build the engine
  itself or a full standalone game from scratch, use the game-engine skill instead.
---

# Modular Game Builder — Plugin Generator for Multi-Game AI Platform

This skill generates new game modules that plug into your existing game engine. The engine (core loop, entity system, physics, AI engine, animation, sport-specific physics) is already built. Your job is to create only the game-specific pieces that extend it.

## Mental Model

Think of the engine as an operating system and each game as an app that runs on it. The OS provides the window manager, file system, and networking — the app just provides its own logic and UI. Similarly:

- **Engine (FIXED)**: Game loop, state machine, entity system, shared physics, 4-phase AI engine, animation system, sport-specific physics modules
- **Game (STANDALONE HTML)**: Self-contained monolithic HTML file with all game-specific rendering, UI, audio, storage, input handling, and gameplay logic
- **Module (NEW)**: Game-specific physics extension + AI integration bridge that connects the engine to a new standalone game

You never touch the engine. You create standalone games and then integrate them with the engine via a bridge pattern.

## Engine Architecture Reference — ACTUAL FILES

The engine lives in `engine/` (flat directory, no `src/` subfolder):

```
engine/
├── core.js              # GameEngine class, Entity, Player, fixed-timestep loop, state machine
├── physics.js           # PhysicsBody, JumpController, CollisionSystem (AABB)
├── animation.js         # SpriteSheet, AnimationController, ProceduralSprites
├── ai-engine.js         # AIEngine (4-phase): Rule AI, PlayerModel, Bayes, Sequence, AdaptiveDifficulty, ClaudeAIAdvisor
├── cricket-physics.js   # CricketConfig, DeliverySystem, CricketBall, BattingSystem, SurgeSystem, InningsManager
├── football-physics.js  # FootballConfig, Football, Goalkeeper, KeeperAI, GoalDetector, MatchManager, AimSystem
```

**IMPORTANT**: There are NO separate `renderer.js`, `input.js`, `audio.js`, `storage.js`, or `utils.js` engine files. Rendering, audio (Web Audio synthesis), storage (Capacitor Preferences + localStorage), input handling (touch, swipe), and utility functions are embedded inside each game's standalone HTML file. Each game is a self-contained monolith.

### Key Interfaces — core.js

**GameEngine class:**
```javascript
class GameEngine {
    constructor(canvasId, width = 414, height = 896)
    start()                              // Begin game loop
    stop()                               // Stop loop
    addEntity(entity)                    // Add entity to game
    removeEntity(entity)                 // Remove entity
    findByTag(tag)                       // Find entities by tag
    findOne(tag)                         // Find first entity by tag
    registerState(name, handlers)        // Register state: { enter(), exit(), update(dt), draw(ctx) }
    switchState(name)                    // Transition to named state (calls exit→enter)
}
```

**Entity class:**
```javascript
class Entity {
    constructor(x = 0, y = 0)           // Note: width/height are separate properties, NOT constructor args
    // Properties: x, y, prevX, prevY, vx, vy, width, height, z, active, visible, tag, engine
    fixedUpdate(dt)                      // Physics step (stores prev pos, applies velocity)
    update(dt)                           // Override in subclass for game logic
    render(ctx, alpha)                   // Override in subclass for rendering
    lerpX(alpha) / lerpY(alpha)          // Interpolated position for smooth rendering
    getBounds()                          // Returns { x, y, w, h } AABB
    destroy()                            // Remove from engine
}

class Player extends Entity {
    constructor(x, y)                    // tag = 'player', adds grounded, moveDir, physics
}
```

### Key Interfaces — physics.js

**PhysicsBody** (component attached to entities):
```javascript
class PhysicsBody {
    constructor(entity)
    // Properties: gravity, maxFallSpeed, friction, airFriction, bounce, isStatic, isSolid
    applyGravity(dt)
    applyFriction(dt)
}
```

**JumpController:**
```javascript
class JumpController {
    constructor(entity)
    // Properties: jumpForce, maxJumps, coyoteTime, jumpCutMultiplier
    requestJump()                        // Initiate jump (checks grounded, coyote time, max jumps)
    releaseJump()                        // Early release for variable height (cuts upward velocity)
}
```

**CollisionSystem:**
```javascript
class CollisionSystem {
    constructor(engine)
    register(entity, options)            // options: { layer, isTrigger, onCollide(other, overlap) }
    unregister(entity)
    update()                             // Run collision detection for all registered entities
}
```

### Key Interfaces — ai-engine.js (4-Phase AI)

**AIEngine class:**
```javascript
class AIEngine {
    constructor(config)                  // config: { difficulty, tickBudgetMs, maxSamples, ... }

    // Lazy getters — sport-specific AI (allocated on first access)
    get cricket()                        // Returns CricketAI instance
    get football()                       // Returns FootballAI instance

    // Shared sub-systems (accessible directly)
    playerModel                          // PlayerModel instance (Phase 2)
    cricketBayes / fbBayes               // BayesPredictor instances (Phase 3)
    cricketSeq / fbSeq                   // SequencePredictor instances (Phase 3)
    difficulty_adaptive                  // AdaptiveDifficulty instance (Phase 3)

    setDifficulty(d)                     // 'easy'|'medium'|'hard'|'legend'
    tick(dt)                             // Per-frame AI update (budget-guarded)
    savePhase3() / loadPhase3(data)      // Persist/restore Phase 3 state
}
```

**CricketAI (via aiEngine.cricket):**
```javascript
selectDelivery(state)                    // state: { runs, wickets, overs, target, maxOvers }
                                         // Returns: { type, line, length, strategy }
recordBattingEvent(delivery, result)     // delivery: { ball_type, length, line }
                                         // result: { action, quality, runs, wasCaught }
selectShot(input)                        // Returns shot selection for AI batter
```

**FootballAI (via aiEngine.football):**
```javascript
decideKeeper(input)                      // input: { direction, power, history? }
                                         // Returns: { action, confidence, reactionMs, diveSpeed, anticipated, shotZone }
recordShot(direction, power, extra)      // direction: 'left'|'center'|'right'
                                         // extra: { round, maxRounds, result }
recordResult(result)                     // 'goal'|'save'|'miss'|'post'|'over'
selectShot(context)                      // AI kicker shot selection
```

**PlayerModel (shared, via aiEngine.playerModel):**
```javascript
recordBatting(delivery, result)          // Feed cricket batting event
recordBowling(delivery, result)          // Feed cricket bowling event
recordFootball(shot)                     // Feed football shot event
predictDirection()                       // Predict next direction
weakness()                              // Get player's weak spots
aggressionScore                         // 0-1 aggression rating
switchAfterSaveProbability()            // Likelihood of direction switch after save
reset()                                 // Clear all learned data
toJSON() / fromJSON(data)              // Serialize/restore
```

**BayesPredictor (Phase 3):**
```javascript
observe(evidenceKey, action)             // Feed observation
predict(evidenceKey)                     // Returns: { predictions: [{action, posterior}], confidence }
totalObservations                        // Count of all observations
```

**SequencePredictor (Phase 3):**
```javascript
observe(action)                          // Feed action to sequence
predict()                                // Returns: { prediction, confidence, pattern? }
historyLength                           // Count of observations
```

**AdaptiveDifficulty (Phase 3):**
```javascript
recordResult(playerWon)                  // Feed game result
getScaling()                             // Returns: { reactionMul, speedMul, aggressionMul }
```

### Key Interfaces — animation.js

```javascript
class SpriteSheet {
    constructor(image, frameWidth, frameHeight)
    drawFrame(ctx, frameIndex, x, y, width, height)
}

class AnimationController {
    constructor()
    define(name, frames, options)        // Convenience: creates AnimationClip from { fps, loop } options
    addClip(clip)                        // Add pre-built AnimationClip instance
    play(name)                           // Switch to named animation
    update(dt)                           // Advance frame timer
    get currentFrame()                   // Property getter: returns current frame index
}

class ProceduralSprites {
    static generateCharacter(config)     // Returns { canvas, spriteSheet } for character rendering
    // No drawPlayer/drawBall static methods — use generateCharacter() to create sprite sheets
}
```

## How Games Actually Work — The Standalone + Bridge Pattern

**CRITICAL UNDERSTANDING**: Each game (CrickBot, GoalBot, SluggerDerby) is a **fully self-contained monolithic HTML file** (5000-12000+ lines) with ALL game code inline — rendering, audio, storage, input, AI, physics, UI, everything. The engine modules are **inlined** directly into the HTML and connected through a **bridge adapter** pattern.

### Architecture Pattern:

```
game-standalone.html        ← Original monolithic game (unmodified, works standalone)
game-engine.html            ← Engine-integrated version:
  ├── <script> (IIFE-wrapped engine code)
  │     ├── core.js (inlined)
  │     ├── <sport>-physics.js (inlined)
  │     ├── ai-engine.js (inlined)
  │     └── window.AIEngine = AIEngine (expose to global)
  ├── <script> (game code)
  │     ├── ENGINE BRIDGE code  ← Adapter layer (50-70 lines)
  │     └── [Original game code] ← 100% preserved, with hook points patched
  └── </script>
```

### CRITICAL: Why Inlining + IIFE Is Required

**Problem 1 — External `<script src>` fails on `file://` protocol:**
Browsers block cross-directory file loading when HTML is opened directly (not via HTTP server). Since games are distributed as single HTML files and opened by double-clicking, `<script src="../../engine/core.js">` will silently fail, causing the game to freeze on the loading screen.

**Problem 2 — Class name collisions between engine and game code:**
Engine modules (e.g., `football-physics.js`) may define classes with the same name as the game code (e.g., both define `class Goalkeeper`). In separate `<script>` tags this works (second declaration shadows the first in global scope), but if inlined into a single script block it causes a `SyntaxError: Identifier 'X' has already been declared`.

**Solution — IIFE wrapping:**
Wrap all engine code in an Immediately Invoked Function Expression (IIFE), then expose ONLY the classes the bridge needs via `window.*`:

```javascript
<script>
(function() {
    // --- core.js (inlined) ---
    class GameEngine { ... }
    class Entity { ... }

    // --- <sport>-physics.js (inlined) ---
    class Goalkeeper { ... }  // Engine version — hidden in IIFE scope

    // --- ai-engine.js (inlined) ---
    class AIEngine { ... }

    // Expose to global scope (only what the bridge needs)
    window.AIEngine = AIEngine;
})();
</script>

<script>
    // Game code starts here — its own Goalkeeper class is safe
    class Goalkeeper { ... }  // Game version — no collision

    // ENGINE BRIDGE uses window.AIEngine
    const _aiEngine = new AIEngine({ difficulty: 'medium' });
    ...
</script>
```

### Bridge Pattern (the KEY integration mechanism):

The ENGINE BRIDGE is a small adapter inserted at the top of the game's inline script, BEFORE the game code. It:

1. **Creates an AIEngine instance** — `const _aiEngine = new AIEngine({ difficulty: 'medium' });`
2. **Defines recording helpers** — Map game-specific event formats → engine format, feed all Phase 1-4 predictors
3. **Defines decision helpers** — Try engine AI first, return null on failure → game falls back to inline AI
4. **Defines difficulty sync** — Map game difficulty levels to engine format
5. **Adds a toggle flag** — `USE_ENGINE_AI = true` for A/B testing

Then the game code gets **minimal patches** at specific hook points:
- **Recording hooks**: After each existing AI recording call, add a `_feedEngine*()` call
- **Decision hooks**: Before existing AI decision, try `_getEngine*()` first with fallback
- **Start/reset hooks**: Sync engine difficulty and reset player model
- **HUD hook**: Small green indicator showing engine Bayes/Seq observation counts

### CrickBot Bridge Example (actual production code):

```javascript
// ENGINE BRIDGE — inserted before game code
const _aiEngine = new AIEngine({ difficulty: 'medium' });
let USE_ENGINE_AI = true;

function _feedEngineEvent(delivery, result) {
    const engineDelivery = {
        ball_type: delivery.typeName || delivery.ballType?.name || 'medium',
        length: delivery.length || 'good',
        line: delivery.line || 'center',
    };
    const engineResult = {
        action: result.shotType || 'DEFEND',
        quality: result.quality || 'miss',
        runs: result.runs || 0,
        wasCaught: result.quality === 'caught' || result.quality === 'bowled',
    };
    _aiEngine.cricket.recordBattingEvent(engineDelivery, engineResult);
}

function _getEngineDelivery(difficulty) {
    if (!USE_ENGINE_AI) return null;
    try {
        const state = { runs, wickets, overs, target, maxOvers };
        return _aiEngine.cricket.selectDelivery(state); // { type, length, line, strategy }
    } catch (e) {
        console.warn('[Engine Bridge] fallback to inline AI:', e.message);
        return null;
    }
}
```

### GoalBot Bridge Example (actual production code):

```javascript
// ENGINE BRIDGE — inserted before game code
const _aiEngine = new AIEngine({ difficulty: 'medium' });
let USE_ENGINE_AI = true;

function _feedEngineShot(angle, power, isGoal, aimX, aimY, difficulty, round, maxRounds) {
    const goalCX = 207;
    let direction = aimX < goalCX - 30 ? 'left' : aimX > goalCX + 30 ? 'right' : 'center';
    _aiEngine.football.recordShot(direction, power, { round, maxRounds, result: isGoal ? 'goal' : 'save' });
    _aiEngine.football.recordResult(isGoal ? 'goal' : 'save');
}

function _getEngineKeeperPrediction(aimX, aimY, shotPower) {
    if (!USE_ENGINE_AI) return null;
    try {
        const goalCX = 207;
        let direction = aimX < goalCX - 30 ? 'left' : aimX > goalCX + 30 ? 'right' : 'center';
        return _aiEngine.football.decideKeeper({ direction, power: shotPower });
    } catch (e) { return null; }
}
```

## Module Generation Flow for NEW Games

When the user requests a new game, follow this sequence:

### Step 1: Identify What's Needed

1. **Game type classification**:
   - Sport (cricket, football, tennis, golf, bowling) → needs a `<sport>-physics.js` engine module
   - Combat (fighting, boxing, wrestling) → needs hit detection, health, combo systems
   - Arcade (runner, shooter, puzzle) → needs level generation, obstacle patterns

2. **Core mechanics** — what are the 2-3 essential interactions?

3. **What the engine already provides** — reuse `PhysicsBody`, `CollisionSystem`, `Entity`, `AIEngine` structure

4. **What's truly new** — only the game-specific rules, physics extensions, and AI decisions

### Step 2: Generate the Files

Create TWO things:

**A. Sport-specific physics module** (if applicable):
```
engine/<sport>-physics.js     # Game-specific physics, configs, entities
```

Follow the pattern of existing modules:
- `cricket-physics.js` (22KB): CricketConfig, DeliverySystem, CricketBall, BattingSystem, SurgeSystem, InningsManager, SwipeDetector
- `football-physics.js` (28KB): FootballConfig, Football, Goalkeeper, KeeperAI, GoalDetector, MatchManager, AimSystem, PowerGauge

Each sport-physics module should define:
- A `Config` object with difficulty tiers (easy/medium/hard/legend)
- Entity classes for game-specific objects (ball, player, opponent)
- Physics calculations specific to the sport
- A scoring/match management system

**B. Standalone game HTML** (the actual playable game):
```
<game-name>/
├── dist/
│   ├── <game>-standalone.html    # Self-contained monolithic game (ALL code inline)
│   ├── <game>-engine.html        # Engine-integrated version (bridge pattern)
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker for offline
│   └── icons/                    # App icons
```

The `standalone.html` must:
- Contain ALL code in a single file (rendering, audio, storage, input, AI, physics, UI)
- Be fully self-contained and playable by opening in any browser
- Include iOS web app meta tags and safe area CSS
- Canvas size: 414x896 (mobile-first)
- Include its own adaptive AI, player profiling, difficulty system (inline)

The `engine.html` must:
- **Inline** all engine scripts (core.js, `<sport>-physics.js`, ai-engine.js) directly into the HTML — do NOT use external `<script src>` tags (they fail on `file://` protocol)
- **Wrap engine code in an IIFE** to prevent class name collisions (e.g., `Goalkeeper` in both football-physics.js and GoalBot). Expose only `window.AIEngine = AIEngine` (and `window.<Sport>Config` if needed by the bridge)
- **Put engine IIFE in its own `<script>` block**, separate from the game code `<script>` block
- Insert ENGINE BRIDGE at the start of the game's `<script>` block (adapter pattern)
- Patch recording hooks to feed engine predictors
- Patch decision hooks to try engine AI first with inline fallback
- Patch startGame() to sync engine difficulty and reset
- Add HUD indicator showing engine AI status
- **100% preserve original game code** — engine is additive only

### Step 3: Add AI Hooks to ai-engine.js

For a new sport, add a new AI class following the existing pattern:

```javascript
class TennisAI {
    constructor(difficulty, playerModel, bayes, sequence, adaptiveDiff) {
        this.difficulty = difficulty;
        this.model = playerModel;
        this.bayes = bayes;
        this.sequence = sequence;
        this.adaptiveDiff = adaptiveDiff;
    }

    // Decision method (equivalent to selectDelivery / decideKeeper)
    decideReturn(input) {
        // Phase 1: Rule-based lookup tables
        // Phase 2: PlayerModel prediction
        // Phase 3: Bayes + Sequence + AdaptiveDifficulty
        return { action, confidence, ... };
    }

    // Recording method
    recordShot(direction, power, extra) {
        // Feed Phase 2 PlayerModel
        // Feed Phase 3 Bayes + Sequence predictors
    }

    recordResult(result) {
        // Feed AdaptiveDifficulty
    }
}
```

Then add to AIEngine:
```javascript
// In AIEngine class:
get tennis() {
    if (!this._tennisAI) {
        this._tennisAI = new TennisAI(this.difficulty, this.playerModel,
            this.tennisBayes, this.tennisSeq, this.difficulty_adaptive);
    }
    return this._tennisAI;
}
```

### Step 4: Create the Theme (embedded in standalone HTML)

Visual theme is defined inline within the standalone HTML, NOT as a separate file:

```javascript
// Inside standalone.html
const COLORS = {
    primary: '#00e5ff',
    background: '#0a1628',
    court: '#2D5016',
    // ... sport-specific palette
};

const DESIGN = {
    width: 414,
    height: 896,
    // ... sport-specific layout constants
};
```

## iOS Web App Requirements

Every game's HTML files must be iOS-ready:

1. **Meta tags**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Game Name">
<meta name="mobile-web-app-capable" content="yes">
<meta name="format-detection" content="telephone=no">
```

2. **Safe area CSS**:
```css
@supports (padding-top: env(safe-area-inset-top)) {
    canvas {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
    }
}
```

3. **Touch handling**: All touch listeners use `{ passive: false }` to prevent iOS scroll bounce

4. **PWA manifest** with icons, `display: standalone`, `orientation: portrait`

5. **Service worker** for offline play

6. **Capacitor config** (when user requests native iOS deployment)

## Rules — What You Must NOT Do

- **DO NOT** use external `<script src="...">` tags to load engine files — they FAIL on `file://` protocol. Always INLINE engine code directly into the HTML
- **DO NOT** inline engine code into the SAME `<script>` block as game code — class name collisions (e.g., `Goalkeeper`) cause `SyntaxError`. Use IIFE wrapping in a SEPARATE `<script>` block
- **DO NOT** expose all engine classes to global scope — only expose what the bridge needs (typically just `window.AIEngine`) from the IIFE
- **DO NOT** create separate `renderer.js`, `audio.js`, `storage.js`, `input.js`, or `utils.js` engine files — these are embedded in each game's standalone HTML
- **DO NOT** assume `engine.particles.emit()`, `engine.audio.play()`, or `engine.storage.save()` exist — they don't
- **DO NOT** assume `engine.setState()` exists — the method is `engine.switchState()`
- **DO NOT** assume `engine.loadModule()` exists — it doesn't; games integrate via bridge pattern
- **DO NOT** assume `Entity(x, y, width, height)` constructor — it's `Entity(x, y)` with width/height as separate properties
- **DO NOT** assume `ai.ruleEngine`, `ai.patternDetector`, or `ai.neural` exist — use `aiEngine.cricket.*`, `aiEngine.football.*`, `aiEngine.playerModel`, `aiEngine.cricketBayes`, etc.
- **DO NOT** modify existing game standalone HTML files — create a separate engine-integrated copy
- **DO NOT** replace or rebuild existing inline AI in games — the engine AI is an additive enhancement with fallback
- **DO NOT** generate a full 12-phase project — that's the game-engine skill's job
- **DO NOT** add systems the game doesn't need

## When to Add Optional Systems

| System | When to Include |
|--------|----------------|
| Sport-physics module | Always for sport games — defines physics config, entities, match rules |
| AI class in ai-engine.js | When there's an opponent/NPC that needs decisions |
| Economy/shop | Only if user requests, or game type implies it (career mode) |
| Power-ups/surge | When the game benefits from temporary boosts |
| Progression | When there are levels, difficulty tiers, or unlockables |
| TensorFlow.js ML | Only for advanced prediction (GoalBot pattern); most games use Phase 1-3 |

## Extending an Existing Module

When the user asks to improve or add features to an existing module:

1. Read the current engine files + game standalone HTML
2. Identify what's missing or needs improvement
3. Edit the existing files — don't create a parallel module
4. Preserve all existing functionality while adding the new feature
5. Validate JS syntax and run bridge contract tests
6. Test that the engine integration still works via the bridge

## Output Checklist

Before delivering the module, verify:

- [ ] Sport-physics module (if applicable) is in `engine/` directory
- [ ] `standalone.html` opens in a browser and the game is playable (self-contained)
- [ ] `engine.html` has engine code INLINED (not external `<script src>`) — must work when opened via `file://`
- [ ] Engine code is wrapped in IIFE with only `window.AIEngine` (and sport Config if needed) exposed
- [ ] Engine IIFE is in a SEPARATE `<script>` block from game code (prevents class name collisions)
- [ ] No class name collisions between engine and game code (check with `grep -oP 'class \K\w+'`)
- [ ] ENGINE BRIDGE is inserted at the start of the game's `<script>` block with proper adapter functions
- [ ] Recording hooks feed all Phase 1-4 predictors
- [ ] Decision hooks try engine AI first with inline fallback on failure
- [ ] `startGame()` syncs engine difficulty and resets player model
- [ ] HUD indicator shows engine AI status (Bayes/Seq observation counts)
- [ ] iOS meta tags and safe area CSS are present
- [ ] Touch input works (with `passive: false`)
- [ ] PWA manifest and service worker are included
- [ ] JS syntax validated per `<script>` block (no errors)
- [ ] Bridge contract tests pass (all engine API calls work)
- [ ] Original game code is 100% preserved in engine version
- [ ] No engine code is duplicated — bridge adapts, doesn't rebuild
- [ ] File opens and loads past loading screen when double-clicked (no HTTP server required)

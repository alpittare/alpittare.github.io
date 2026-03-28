---
name: game-engine-ii
description: "Production game module generator — builds new HTML5 Canvas sport/arcade games that match the quality bar of CrickBot, GoalBot, and BaseHit (three shipped iOS App Store games). Use this skill whenever the user wants to: add a new game to their multi-game platform, build a new sport game module (e.g., tennis, basketball, boxing), extend an existing game with new features (campaign levels, surge system, shop items, achievements), fix game bugs (campaign routing, touch handling, canvas rendering), or generate iOS deployment files. Also trigger when the user mentions: new game module, game plugin, add a sport, arcade module, extend engine, campaign system, level system, surge system, power shots, game shop, game achievements, canvas game bugs, roundRect issues, touch not working, campaign not routing, or iOS game deployment. This skill contains battle-tested patterns extracted from shipping CrickBot (cricket), GoalBot (football/soccer), and BaseHit (baseball) to the iOS App Store — every pattern here solved a real production problem."
---

# Game Module Generator — Production Patterns from 3 Shipped Games

This skill generates new game modules and fixes existing ones. Every pattern here was extracted from shipping CrickBot (~11,100 lines), GoalBot (~13,000 lines), and BaseHit (~9,200 lines) to the iOS App Store. These aren't theoretical — they solved real bugs that blocked real releases.

## Architecture Overview

All three shipped games follow the same architecture:

```
game-name/
├── dist/
│   ├── <game>-engine.html       # Primary file — ALL code in single HTML (~9,000-13,000 lines)
│   ├── <game>-standalone.html   # Copy of engine.html
│   ├── index.html               # Copy of engine.html
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker for offline
│   ├── icon-192.png             # PWA icon
│   ├── icon-512.png             # PWA icon
│   └── AppIcon.appiconset/     # 15 iOS icon sizes + Contents.json
├── capacitor.config.json        # iOS/Android native wrapper config
├── package.json                 # Capacitor dependencies
├── .github/workflows/ios-build.yml  # CI/CD pipeline
└── .gitignore
```

**Key principle**: Single-file monolith HTML. All JS, CSS, and game logic in ONE file. No external `<script src>` — must work via `file://` protocol. After editing the engine file, ALWAYS copy to standalone and index.html.

---

## Canvas & Coordinate System

All games use a fixed design canvas scaled to fit any screen:

```javascript
const W = 414, H = 896;  // Design dimensions (iPhone-optimized portrait)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

// Responsive scaling
let _scale = 1, _offsetX = 0, _offsetY = 0;
function fitCanvas() {
    const r = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = (W * r) + 'px';
    canvas.style.height = (H * r) + 'px';
    _scale = r;
}
window.addEventListener('resize', fitCanvas); fitCanvas();

// Screen-to-game coordinate transform (CRITICAL for touch handling)
function screenToGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) / (rect.width / W),
        y: (clientY - rect.top) / (rect.height / H)
    };
}
```

BaseHit uses 390x844 but the pattern is identical. The coordinate transform is the most common source of "touch not working" bugs — always verify `screenToGame()` matches your canvas scaling approach.

---

## CRITICAL: roundRect Polyfill

`ctx.roundRect()` is a newer Canvas API that crashes on older browsers/WebViews. This caused GoalBot's campaign result screen to silently crash, corrupting game state and making it appear like "clicks don't work."

**Every game MUST include this polyfill before any drawing code:**

```javascript
// MANDATORY — without this, UI rendering crashes on older WebViews
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        const R = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 0);
        this.moveTo(x + R, y);
        this.lineTo(x + w - R, y);
        this.quadraticCurveTo(x + w, y, x + w, y + R);
        this.lineTo(x + w, y + h - R);
        this.quadraticCurveTo(x + w, y + h, x + w - R, y + h);
        this.lineTo(x + R, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - R);
        this.lineTo(x, y + R);
        this.quadraticCurveTo(x, y, x + R, y);
        this.closePath();
        return this;
    };
}
```

**OR** use a wrapper method (GoalBot pattern):
```javascript
_roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
```

**Never use raw `ctx.roundRect()` anywhere.** Search your code for it before shipping.

---

## State Machine Pattern

Every game uses a central state that routes update/draw logic:

```javascript
// CrickBot/BaseHit pattern (function-based)
gameState.screen = 'menu'; // menu | game | levels | shop | gameover | campaign_result | phase_complete | achievements | stats | settings

function update(dt) {
    switch (gameState.screen) {
        case 'menu': updateMenu(dt); break;
        case 'game': updateGame(dt); break;
        case 'campaign_result': updateCampaignResult(dt); break;
        // ...
    }
}

// GoalBot pattern (class-based)
class Game {
    constructor() { this.state = 'menu'; }
    _update() { switch(this.state) { case 'menu': this._updateMenu(); break; /* ... */ } }
    _draw()   { switch(this.state) { case 'menu': this._drawMenu(); break; /* ... */ } }
}
```

Both patterns work. The important thing is: every screen has BOTH an update handler AND a draw handler, and state transitions happen by setting a single property.

---

## 100-Level Campaign System

All three games use an identical campaign architecture. This is the most complex system and the one with the most production bugs.

### Level Generation (Procedural)

```javascript
const GAME_LEVELS = (() => {
    const levels = [];
    const THEMES = ['Arena 1', 'Arena 2', /* ... 10 themes total */];

    for (let i = 0; i < 100; i++) {
        const levelNum = i + 1;
        const isBoss = i % 25 === 0 && i > 0;      // Boss at 25, 50, 75, 100
        const isMilestone = i % 10 === 0 && i > 0;  // Milestone every 10

        levels.push({
            level: levelNum,
            name: isBoss ? `Boss: ${THEMES[i % 10]}` : `Level ${levelNum}`,
            theme: THEMES[i % 10],
            isBoss, isMilestone,

            // Sport-specific difficulty scaling (examples):
            targetScore: Math.floor(8 + i * 0.5 + (isBoss ? 5 : 0)),
            aiDifficulty: Math.min(0.2 + i * 0.008, 1.0),
            speed: Math.min(1.0 + i * 0.012, 2.2),

            // Rewards
            coinReward: 10 + i * 3 + (isBoss ? 50 : 0),
            xpReward: 15 + i * 2 + (isBoss ? 30 : 0),
            starsRequired: isBoss ? 2 : 1,
        });
    }
    return levels;
})();
```

### Difficulty Mapping

Campaign levels map to the 4 difficulty tiers for AI/config lookup:

```javascript
function getCampaignDifficulty(levelNum) {
    if (levelNum <= 10) return 'easy';
    if (levelNum <= 30) return 'medium';
    if (levelNum <= 60) return 'hard';
    return 'legend';
}
```

### Starting a Campaign Level

**Critical lesson**: `startCampaignLevel()` should DELEGATE to `startGame()`, not duplicate initialization. GoalBot's campaign was broken because `_startCampaignLevel` duplicated `startGame()` but missed `_nextRound()`, `_applyEquippedBot()`, and AI reset. The fix:

```javascript
startCampaignLevel(levelNumber) {
    const level = GAME_LEVELS[levelNumber - 1];
    if (!level) return;

    const difficulty = getCampaignDifficulty(levelNumber);

    // Set campaign-specific state BEFORE calling startGame
    this.isCampaignMode = true;
    this.currentCampaignLevel = levelNumber;

    // Delegate to the PROVEN startGame path
    this.startGame(difficulty, level);  // level config passed as optional param
}

startGame(difficulty, campaignLevelCfg) {
    // Reset campaign flags when NOT in campaign mode
    if (!campaignLevelCfg) {
        this.isCampaignMode = false;
        this.currentCampaignLevel = null;
    }

    this.currentLevelConfig = campaignLevelCfg || null;
    this.difficulty = difficulty;
    this.score = 0;
    this.round = 0;
    // ... full initialization ...
    // ... AI reset, equipped items, audio ...
    this._nextRound();  // This was the missing call that broke GoalBot
}
```

### Campaign Result Routing (Bug-Prone Area)

The game-over handler must route to the correct screen. The order of checks matters:

```javascript
function handleGameOver(won) {
    // 1. Phase unlock logic (always runs, doesn't control screen routing for campaign)
    if (won && gameState.currentPhase < PHASES.length) {
        const nextPhase = gameState.currentPhase + 1;
        if (nextPhase < PHASES.length && !gameState.phasesUnlocked[nextPhase]) {
            gameState.phasesUnlocked[nextPhase] = true;
            gameState.phaseJustCompleted = true;
        }
    }

    // 2. Campaign mode: ALWAYS route to campaign_result (has RETRY | NEXT LEVEL | LEVELS)
    if (gameState.isCampaignMode && gameState.currentCampaignLevel) {
        gameState.screen = 'campaign_result';
        gameState.saveToStorage();
        return;
    }

    // 3. Non-campaign: show phase_complete when new phase unlocked
    if (won && gameState.phaseJustCompleted) {
        gameState.screen = 'phase_complete';
        gameState.saveToStorage();
        return;
    }

    // 4. Non-campaign: final phase mastered
    if (won && gameState.currentPhase === PHASES.length - 1) {
        gameState.phaseJustCompleted = true;
        gameState.screen = 'phase_complete';
        gameState.saveToStorage();
        return;
    }

    // 5. Normal game over
    gameState.screen = 'gameover';
    gameState.saveToStorage();
}
```

**The bug we fixed in CrickBot**: Phase completion check ran BEFORE campaign check, so campaign wins that triggered a phase unlock went to `phase_complete` (MENU only) instead of `campaign_result` (RETRY | NEXT LEVEL | LEVELS). Users couldn't progress through campaign levels.

### Campaign Result Screen — Three Buttons

When a campaign level is won and there are more levels:

```
[RETRY]  [NEXT LEVEL >]  [LEVELS]
 (small)    (large/green)   (small)
```

When lost or on level 100:

```
[RETRY]     [LEVELS]
```

The button hit-testing must match the drawing coordinates exactly. Store button bounds during draw, test during update:

```javascript
// During draw:
this._crButtons = [];
this._crButtons.push({ x, y, w, h, action: () => this.startCampaignLevel(levelNum) });     // Retry
this._crButtons.push({ x, y, w, h, action: () => this.startCampaignLevel(levelNum + 1) }); // Next
this._crButtons.push({ x, y, w, h, action: () => { this.state = 'campaign'; } });           // Levels

// During update (tap handling):
for (const btn of this._crButtons) {
    if (tap.x >= btn.x && tap.x <= btn.x + btn.w &&
        tap.y >= btn.y && tap.y <= btn.y + btn.h) {
        btn.action();
        break;  // MUST break after first match
    }
}
```

### Star System

```javascript
// In gameState:
levelStars: {},  // { levelNum: starCount }
campaignLevel: 1,  // Highest unlocked level

// Star calculation after winning:
let stars = 1;  // Base star for beating target
if (score >= target * 1.5) stars++;   // Bonus for exceeding target
if (wickets === 0) stars++;           // Sport-specific bonus condition
gameState.levelStars[levelNum] = Math.max(gameState.levelStars[levelNum] || 0, stars);

// Level unlock: next level unlocks if current level has >= starsRequired
if (stars >= level.starsRequired && levelNum === gameState.campaignLevel) {
    gameState.campaignLevel = Math.min(levelNum + 1, 100);
}
```

---

## 4-Phase Difficulty System

```javascript
const PHASES = [
    { name: 'Rookie',   difficulty: 'easy',   levels: '1-10' },
    { name: 'Pro',      difficulty: 'medium', levels: '11-30' },
    { name: 'Champion', difficulty: 'hard',   levels: '31-60' },
    { name: 'Legend',   difficulty: 'legend', levels: '61-100' },
];

// In gameState:
phasesUnlocked: [true, false, false, false],
currentPhase: 0,
```

Phases unlock by winning games at the corresponding difficulty OR progressing through campaign levels.

---

## Surge / Power System

Fills on good actions, activatable at tier thresholds. GoalBot's surge had a bug where L1 threshold (25%) was unreachable because the first goal only gave 20 charge. Fix: lower L1 to 20%.

```javascript
// Surge state
surge: { charge: 0, active: false, level: 0, timer: 0 },

// Charge on good actions
addSurgeCharge(amount) {
    this.surge.charge = Math.min(100, this.surge.charge + amount);
}
// Base amounts: +20 per goal/hit, +10 combo bonus per streak

// Tier thresholds (GoalBot production values)
getAvailableSurgeLevel() {
    const c = this.surge.charge;
    if (c >= 100) return 4;
    if (c >= 75)  return 3;
    if (c >= 50)  return 2;
    if (c >= 20)  return 1;  // NOT 25 — first action must be able to reach L1
    return 0;
}

// Activation tap zone — must be GENEROUS on mobile
// GoalBot: x < 90px (not 65), y between 240-500 (not 280-468)
if (surge.availableLevel >= 1 && !surge.active &&
    tap.x < 90 && tap.y > 240 && tap.y < 500) {
    activateSurge();
}
```

---

## Touch Input System

All three games use the same dual-input pattern (touch + mouse):

```javascript
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const pos = screenToGame(e.touches[0].clientX, e.touches[0].clientY);
    handleStart(pos.x, pos.y);
}, { passive: false });  // passive: false is REQUIRED for preventDefault on iOS

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const pos = screenToGame(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    handleEnd(pos.x, pos.y);
}, { passive: false });

// Mouse fallback for desktop testing
canvas.addEventListener('mousedown', (e) => {
    const pos = screenToGame(e.clientX, e.clientY);
    handleStart(pos.x, pos.y);
});
canvas.addEventListener('mouseup', (e) => {
    const pos = screenToGame(e.clientX, e.clientY);
    handleEnd(pos.x, pos.y);
});
```

**Tap consumption pattern** (GoalBot — prevents double-processing):

```javascript
// TouchManager stores taps in a queue
consumeTap() {
    if (this._taps.length === 0) return null;
    return this._taps.shift();
}

// Update loop processes ALL taps per frame
let tap = this.touch.consumeTap();
while (tap) {
    // Process tap against buttons...
    tap = this.touch.consumeTap();
}
```

**Button hit-testing**: Use `for` loop with `break` (not `forEach`) so you stop after the first match:

```javascript
for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    if (tap.x >= btn.x && tap.x <= btn.x + btn.w &&
        tap.y >= btn.y && tap.y <= btn.y + btn.h) {
        btn.action();
        break;  // Critical — forEach can't break
    }
}
```

---

## Web Audio Synthesizer (Zero External Files)

All sound generated via Web Audio API — no audio file dependencies:

```javascript
const audio = {
    _ctx: null, muted: false,
    _getCtx() {
        if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        return this._ctx;
    },
    _tone(freq, type, dur, vol, freqEnd) {
        if (this.muted) return;
        try {
            const ac = this._getCtx();
            if (ac.state === 'suspended') ac.resume();
            const o = ac.createOscillator(), g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            const t = ac.currentTime;
            o.type = type;
            o.frequency.setValueAtTime(freq, t);
            if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            o.start(t); o.stop(t + dur);
        } catch(e) {}
    },
    play(event) {
        switch(event) {
            case 'click':   this._tone(400, 'sine', 0.05, 0.1); break;
            case 'whistle': this._tone(800, 'sine', 0.3, 0.3, 1200); break;
            case 'goal':    this._chord([523,659,784], 'triangle', 0.4, 0.3); break;
            case 'miss':    this._tone(300, 'sawtooth', 0.3, 0.15, 100); break;
            case 'levelUp': this._chord([523,659,784,1047], 'triangle', 0.6, 0.25); break;
            // Add 10+ events per game
        }
    }
};
```

---

## Storage & Persistence

```javascript
const STORAGE_KEY = 'GAME_NAME_v2';

saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            v: 2,
            coins: this.coins, xp: this.xp, level: this.level,
            settings: this.settings, levelStars: this.levelStars,
            campaignLevel: this.campaignLevel, phasesUnlocked: this.phasesUnlocked,
            achievements: this.achievements, matchHistory: this.matchHistory,
            dailyReward: this.dailyReward,
        }));
    } catch(e) { /* Storage unavailable — game still works, just doesn't persist */ }
}

loadFromStorage() {
    try {
        const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (!d.v) return;
        if (d.v < 2) this._migrate(d);  // Forward-migrate old saves
        Object.assign(this, d);
    } catch(e) {}
}
```

Always include a version number (`v: 2`) and a migration path. Users lose progress if you change the schema without migration.

---

## Particle System (Object Pool)

```javascript
class ParticlePool {
    constructor(max = 250) {
        this._pool = Array.from({ length: max }, () => ({ active: false }));
    }
    spawn(x, y, cfg = {}) {
        const p = this._pool.find(p => !p.active);
        if (!p) return;  // Pool exhausted — never allocate new
        Object.assign(p, {
            active: true, x, y,
            vx: Math.cos(cfg.angle || Math.random() * Math.PI * 2) * (cfg.speed || 100),
            vy: Math.sin(cfg.angle || Math.random() * Math.PI * 2) * (cfg.speed || 100),
            life: cfg.life || 0.8, maxLife: cfg.life || 0.8,
            size: cfg.size || 3, color: cfg.color || '#FFF',
            gravity: cfg.gravity ?? 300, shrink: cfg.shrink ?? true,
        });
    }
    update(dt) {
        for (const p of this._pool) {
            if (!p.active) continue;
            p.vy += p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            p.life -= dt; if (p.life <= 0) p.active = false;
        }
    }
    draw(ctx) {
        for (const p of this._pool) {
            if (!p.active) continue;
            const a = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = a; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.shrink ? p.size * a : p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}
```

Never `new Particle()` in the game loop. Always pool.

---

## Error Handling in Game Loop

GoalBot's campaign crash was invisible because errors in the draw loop silently corrupted state. Add a try-catch with visible error display:

```javascript
_loop() {
    try {
        this._update();
        this._draw();
    } catch(e) {
        // Compact error display — bottom-right, doesn't cover gameplay
        const ctx = this.renderer.ctx;
        ctx.fillStyle = 'rgba(255,0,0,0.8)';
        ctx.fillRect(W - 200, H - 60, 200, 60);
        ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
        ctx.fillText(e.message.substring(0, 30), W - 195, H - 40);
        console.error('[GAME LOOP]', e);
    }
    requestAnimationFrame(() => this._loop());
}
```

---

## Required Game Screens (Minimum 10)

| Screen | Purpose | Key Elements |
|--------|---------|-------------|
| `menu` | Main hub | Title, 4 difficulty buttons, Play button, Campaign/Shop/Stats/Achievements nav, daily reward popup |
| `game` / `playing` | Active gameplay | Full HUD (score, round, level/XP, coins, streak, surge bar, commentary, pause button) |
| `levels` / `campaign` | Level select grid | 100 levels in scrollable grid, star display, lock/unlock states, phase headers |
| `campaign_result` | After campaign level | Score, stars earned, rewards, RETRY / NEXT LEVEL / LEVELS buttons |
| `phase_complete` | Phase milestone | Phase name, unlock animation, NEXT PHASE / MENU buttons |
| `gameover` | Non-campaign end | Full stats, high score, coins/XP earned, Play Again / Menu |
| `shop` | Cosmetics store | Skins + Themes tabs, scrollable grid, lock/buy/equipped states |
| `achievements` | Trophy case | Grid of achievements, lock/unlock, progress bars, coin rewards |
| `stats` | Career data | Total games, win rate, best scores, last 10 match history |
| `settings` | Options | Audio toggle, haptics toggle, difficulty selector |

---

## iOS Deployment Files

Every game needs these files for App Store release:

### AppIcon.appiconset (15 sizes)

```
icon-20.png (20x20), icon-20@2x.png (40x40), icon-20@3x.png (60x60)
icon-29.png (29x29), icon-29@2x.png (58x58), icon-29@3x.png (87x87)
icon-40.png (40x40), icon-40@2x.png (80x80), icon-40@3x.png (120x120)
icon-60@2x.png (120x120), icon-60@3x.png (180x180)
icon-76.png (76x76), icon-76@2x.png (152x152)
icon-83.5@2x.png (167x167)
icon-1024.png (1024x1024)
```

Plus `Contents.json` mapping each file to its Xcode idiom/scale.

### capacitor.config.json

```json
{
  "appId": "com.yourapp.game",
  "appName": "Game Name",
  "webDir": "dist",
  "server": { "androidScheme": "https" },
  "plugins": {
    "SplashScreen": { "launchAutoHide": true, "launchShowDuration": 2000 },
    "StatusBar": { "style": "DARK", "backgroundColor": "#000000" },
    "Haptics": { "enabled": true }
  },
  "ios": {
    "scheme": "GameName",
    "contentInset": "always"
  }
}
```

### package.json dependencies

```json
{
  "dependencies": {
    "@capacitor/core": "^5.0.0",
    "@capacitor/ios": "^5.0.0",
    "@capacitor/preferences": "^5.0.0",
    "@capacitor/haptics": "^5.0.0",
    "@capacitor/status-bar": "^5.0.0",
    "@capacitor/splash-screen": "^5.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^5.0.0"
  }
}
```

**Do not forget `@capacitor/ios`** — CrickBot shipped without it and had to be patched.

### HTML meta tags (PWA + iOS)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="GameName">
<meta name="mobile-web-app-capable" content="yes">
<meta name="format-detection" content="telephone=no">
```

---

## Common Systems Checklist

Every game module should include ALL of these:

1. **GameState class** — Central state, save/load with versioned schema
2. **Level & XP** — Earn XP per match, level-up curve: `xpToNextLevel *= (level < 10 ? 1.4 : 1.2)`
3. **Coin economy** — addCoins/spendCoins, hard cap 999,999,999
4. **Shop** — Skins tab + Themes tab, level-gated items, equipped badge
5. **Surge/Power system** — Fill on actions, tier thresholds, drain on use
6. **Daily reward** — 7-day streak, coin rewards [25, 50, 75, 100, 150, 200, 350]
7. **Missions** — 4 trackable objectives with progress bars and coin rewards
8. **Achievements** — 7+ with toasts, progress tracking, coin + XP rewards
9. **Match history** — Last 10 matches, career stats
10. **Tutorial** — 4-step overlay on first launch, dismissed on tap
11. **Commentary** — Event-driven text, 5+ variants per event, no-repeat logic
12. **Crowd system** — Excitement/mood, wave animation on streaks
13. **Haptics** — `navigator.vibrate()` patterns: light/medium/heavy/success/error
14. **Camera** — Shake on impacts, zoom on special moments
15. **Particle pool** — 250 max, object pool pattern
16. **Confetti + Fireworks** — On wins and celebrations
17. **Web Audio** — Synthesized sounds, 10+ events, mute toggle
18. **UI utilities** — Glass cards, neon rects, pill buttons, vignette
19. **Pause system** — Button always visible, overlay with Resume/Menu
20. **Settings** — Audio, haptics, difficulty toggles
21. **Stats screen** — Career + match history
22. **Full HUD** — Score, round, level/XP, coins, streak, surge, commentary, pause
23. **Adaptive AI** — Pattern tracking, difficulty scaling based on win rate
24. **ML data store** — Event logging for AI training (500 event cap)
25. **Responsive canvas** — roundRect polyfill, coordinate transform, safe-area CSS
26. **100-level campaign** — Procedural levels, boss/milestone markers, star system
27. **Campaign result screen** — RETRY / NEXT LEVEL / LEVELS buttons
28. **Phase system** — 4 phases, unlock progression, phase_complete screen

---

## Hard-Won Rules (From Production Bugs)

1. **NEVER use `ctx.roundRect()` directly** — always use the polyfill/wrapper
2. **NEVER duplicate `startGame()` initialization** in `startCampaignLevel()` — delegate to `startGame()`
3. **ALWAYS check campaign routing BEFORE phase routing** in game-over handler
4. **ALWAYS reset `isCampaignMode = false`** in `startGame()` when not passed a campaign config
5. **ALWAYS use `for` with `break`** for button hit-testing (not `forEach`)
6. **ALWAYS copy engine.html to standalone.html AND index.html** after changes
7. **ALWAYS include `@capacitor/ios`** in package.json dependencies
8. **ALWAYS use `{ passive: false }`** on touch listeners that call `preventDefault()`
9. **NEVER use external `<script src>`** — everything inline, must work via `file://`
10. **ALWAYS add try-catch** in the game loop to prevent silent state corruption
11. **Make surge L1 threshold reachable** by a single action (20%, not 25%)
12. **Make touch targets generous** on mobile — minimum 44px, prefer 60px+

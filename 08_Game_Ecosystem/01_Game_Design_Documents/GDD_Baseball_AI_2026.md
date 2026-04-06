# Game Design Document: BaseHit AI

**Version:** 1.0
**Date:** March 2026
**Platform:** iOS (Expo), Progressive Web App (PWA)
**Genre:** Sports Simulator / Mobile Arcade
**Target Audience:** Casual gamers, baseball enthusiasts, mobile players (all ages)

---

## Executive Summary

**BaseHit** is a skill-based baseball hitting simulator that combines arcade-style gameplay with strategic depth. Players compete in a 100-level campaign against progressively advanced AI opponents, perfecting their swing timing while managing power-ups, combo multipliers, and a dynamic "Surge" system. The game employs accessible design principles, ethical monetization through cosmetics and premium subscriptions, and employs real-time multiplayer leaderboards to foster community engagement.

**Key Pillars:**
- Timing-based core mechanic with instant feedback
- Progressive AI difficulty with player adaptation
- Accessible design for diverse player abilities
- Fair monetization (cosmetics + optional VIP pass)
- Competitive multiplayer integration

---

## 1. Game Concept

### 1.1 Overview
BaseHit is a single-screen baseball batting game where players face pitches from an AI pitcher and attempt to hit them for runs. Success depends on timing—matching the pitcher's release point with an optimal swing window. The game progressively escalates difficulty across 100 levels, introduces environmental challenges, and rewards skillful play through combo multipliers and power-ups.

### 1.2 Core Fantasy
*"Master the perfect swing and become a legendary hitter."*

Players assume the role of an aspiring baseball player attempting to break through a gauntlet of increasingly skilled AI opponents. Each swing tests reflexes, pattern recognition, and strategic adaptation.

### 1.3 Unique Selling Points (USPs)
1. **Pure Timing Skill:** No dice rolls or RNG—all outcomes determined by player precision
2. **AI Adaptation:** Pitcher learns from player bias (early/late swings) and adjusts
3. **Surge Mechanic:** Dynamic difficulty adjustment that rewards momentum, creating "flow state"
4. **Accessible Canvas:** Colorblind modes, motion reduction, high contrast, screen reader support
5. **No P2W Model:** Cosmetics only; gameplay advantages time-limited (power-ups)

---

## 2. Game Concept & Setting

### 2.1 Visual Theme
- **Minimalist Sports Stadium:** Clean, bright UI with emphasis on the batter's box
- **Dynamic Field:** Animated spotlights, dust effects, heat shimmer (legend difficulty)
- **Particle Effects:** Dust clouds on contact, home run explosions, strike zone visualizers
- **Color Palette:** Primary (stadium green), accent (gold for achievements), secondary (team colors in skins)

### 2.2 Audio Identity
- **Synthetic Soundscape:** Web Audio API synthesis using ADSR envelopes
- **Feedback Tones:** Pitch alert (659Hz), swing impact (400-600Hz range), home run chime (C-E-G chord)
- **Ambient:** Stadium ambience, crowd reactions (synthesized)

### 2.3 Narrative Context
*Minimal narrative; player progression is the story.* Levels represent successive opponents: minor league → majors → legend tier. Boss levels (every 25 levels) feature "signature pitchers" with unique challenge patterns.

---

## 3. Core Gameplay Loop

### 3.1 Turn Structure (Single At-Bat)
1. **Pitch Display (≈1.5s):** AI pitcher winds up, releases
2. **Flight Phase (0.6-2.5s):** Ball travels from mound to plate (speed-dependent)
3. **Decision Window (30-225ms):** Player must swipe to swing within timing window
4. **Result Calculation:** Impact analysis determines outcome (HR, HIT, FOUL, STRIKE)
5. **Feedback & Combo:** Score updates, particles, combo counter, surge meter
6. **Next Pitch:** Immediate re-engagement or level complete

### 3.2 Win/Lose Conditions
- **Win (Level Complete):** Accumulate target runs within at-bat limit
  - Standard: 5 at-bats
  - Boss: 7 at-bats
- **Lose:** Strike out (3 strikes) before reaching target
- **Target Runs:** Difficulty-scaled (easy: 2 runs, legend: 5+ runs)

### 3.3 Feedback Loop
| Outcome | Coins | XP | Combo | Surge |
|---------|-------|----|----|-------|
| HOME RUN | 3 | 50 | +1 | +0.30 |
| BASE HIT | 2 | 20 | +1 | +0.18 |
| FOUL | 0 | 5 | Reset | +0.08 |
| STRIKE | 0 | 0 | Reset | -0.05 |
| WALK | 1 | 10 | +1 | N/A |

---

## 4. Pitch & Swing Mechanics

### 4.1 Pitch Types (4 variants)
The pitcher randomly selects pitch types with probability-weighted distribution:

| Pitch Type | Motion | Speed Range | Difficulty | AI Chance |
|-----------|--------|-------------|------------|-----------|
| **Fastball** | Straight trajectory | Baseline | Easiest to predict | 40-60% |
| **Curveball** | ±0.7 lateral drift | -2% vs baseline | Moderate prediction | 20-35% |
| **Changeup** | Straight, reduced speed | -35% vs baseline | Deceptive timing | 15-25% |
| **Slider** | Heavy curve (≥1.0 drift) | Baseline | Hardest to judge | 10-20% |

### 4.2 Speed Scaling
- **Baseline Speed:** 260-645 px/s across difficulty tiers
  - Easy: 260 px/s
  - Medium: 400 px/s
  - Hard: 520 px/s
  - Legend: 645 px/s
- **Speed Variance:** ±pitchSpeedVar (randomized per pitch, ±10-20 px/s)

### 4.3 Timing Windows (Milliseconds from Contact Point)
| Swing Quality | Timing Window | Success Threshold |
|-------------|--------------|------------------|
| PERFECT | 30-130ms | ±50ms from ideal contact |
| GOOD | 65-225ms | ±80ms from ideal contact |
| FOUL | <65ms (early) | Early swing during approach |
| STRIKE | >225ms (late) | Late swing (ball passed zone) |

**Key Mechanic:** Swipe detection requires:
- Distance traveled: >28px (prevents accidental touches)
- Swipe duration: <550ms (quick, decisive motion)
- Timing: Swipe must complete within active pitch window

### 4.4 Contact Zone Visualization
- **Sweet Spot:** Animated ellipse at optimal contact point (20px radius)
- **Arrival Ring:** Expanding circle showing ball approach (visual feedback)
- **Hit Zone Visualizer:** Overlaid on pitcher display; expands under power-ups

### 4.5 Outcome Determination
```
if (timing in PERFECT window) → HOME RUN
else if (timing in GOOD window) → BASE HIT
else if (timing EARLY) → FOUL
else if (timing LATE) → STRIKE
```

---

## 5. AI System & Difficulty

### 5.1 Pitch Generation Algorithm
```
1. Select pitch type: random() weighted by [fastballChance, curveChance, changeChance, sliderChance]
2. Apply speed: pitchSpeed ± random(-pitchSpeedVar, +pitchSpeedVar)
3. Apply curve offset (if applicable): ±random(0, maxCurveAmount)
4. Apply AI aggression modifier (affects strike zone targeting)
```

### 5.2 Player Adaptation
The AI tracks the player's last **5 swing timings** to detect bias:
- **Early Bias:** Player consistently swings before contact point
- **Late Bias:** Player consistently swings after contact point
- **Balanced:** Mix of early, on-time, and late swings

**Adaptive Response:**
- If early bias detected → Increase changeup/curveball frequency (slower pitches)
- If late bias detected → Increase slider/fastball frequency (faster pitches)
- If balanced → Maintain base distribution

### 5.3 Difficulty Tiers & AI Aggression
| Level Range | Difficulty | AI Aggression | Pitcher Archetype |
|-----------|-----------|-------------|------------------|
| 1-10 | Easy | 0.15 | Rookie (high strikes) |
| 11-30 | Medium | 0.40 | Semi-Pro (balanced) |
| 31-60 | Hard | 0.70 | Professional (crafty) |
| 61-100 | Legend | 1.0 | Master (elite) |

**Aggression Effect:** Higher values increase strike zone size and reduce "hitter's pitches," forcing players to be more selective.

### 5.4 Boss Encounters (Levels 25, 50, 75, 100)
- **At-Bats:** 7 (vs. 5 standard)
- **Target Runs:** +1 difficulty multiplier
- **Signature Pitching Pattern:** Boss pitchers favor specific sequences
  - Level 25: Alternating fastball/curveball
  - Level 50: Heavy slider usage
  - Level 75: Change-of-pace emphasis
  - Level 100: Full randomization (unpredictable)
- **Narrative:** Each boss represents a "signature pitcher" tier

---

## 6. Progression & Economy

### 6.1 Campaign Structure
- **Total Levels:** 100 (linear progression)
- **Unlocking:** Sequential; complete level N to unlock level N+1
- **Milestone Bonuses:** Every 10 levels (10, 20, 30…) awards +5 bonus coins
- **Boss Levels:** 25, 50, 75, 100 (7 at-bat challenge)

### 6.2 Star System
Levels award 1-3 stars based on performance:
- **1 Star:** Win with ≤1 home run
- **2 Stars:** Win with 2 home runs
- **3 Stars:** Win with 3+ home runs

**Purpose:** Encourages replay for mastery; stars track progress toward cosmetic unlocks.

### 6.3 Experience Points (XP) & Leveling
| Action | XP |
|--------|-----|
| Home Run | 50 |
| Base Hit | 20 |
| Foul | 5 |
| Walk | 10 |
| Strike | 0 |

**XP Curve:** Exponential
```
XP_Required(level) = 100 × 1.15^(level-1)

Level 1: 100 XP
Level 10: 405 XP
Level 50: 29,000+ XP (cumulative)
```

**Level Cap:** 999 (cosmetic prestige)

### 6.4 Coins & Currency
- **Coin Drops:** Per outcome (see section 3.3)
- **Multipliers Applied:**
  - Combo multiplier: 1.0x → 2.0x (at 7+ combo, +0.15 per additional hit)
  - Surge multiplier: 1.0x → 5.0x (LEGENDARY tier)
  - Power-up multiplier: 2X COINS power-up
  - VIP multiplier: 2x (with VIP pass)
- **Total Reward:** Coins × (Combo) × (Surge) × (Power-up) × (VIP)
- **Daily Cap:** None (unlimited earning)

---

## 7. Power-ups & Surge System

### 7.1 Power-up Mechanics (2-Pitch Duration Each)
| Power-up | Effect | Strategy |
|---------|--------|----------|
| **SLOW-MO** | Pitch speed halved | Practice timing on fast pitches |
| **BIG BAT** | Timing windows +50% (PERFECT: ±75ms, GOOD: ±120ms) | Safe mode for building combo |
| **2X COINS** | Double coin rewards for 2 pitches | Maximize earnings on good streaks |
| **BALL MAGNET** | Late swings become fouls (no strike-out) | Risk mitigation; enable aggressive play |

**Availability:**
- Shop unlocks at Level 5
- Cost: 50 coins per power-up (purchasable with in-game currency)
- Queue: Up to 3 power-ups can be queued for future use

### 7.2 Surge System (5 Tiers)

The Surge meter fills with successful plays and creates escalating difficulty/reward bonuses:

| Tier | Surge Value | Timing Bonus | Reward Multiplier | Activation |
|------|-------------|--------------|------------------|------------|
| NONE | <0.2 | — | 1.0x | N/A |
| HOT | 0.2-0.49 | +40% window | 1.3x | Button appears |
| FIRE | 0.5-0.79 | +60% window | 1.6x | Automatic if ≥0.5 |
| INFERNO | 0.8-0.99 | +80% window | 2.0x | Automatic if ≥0.8 |
| SURGE MAX | 1.0 | Good swings become HRs | 3.0x | 1 free swing at 1.0 |
| LEGENDARY | 1.2+ | Easter egg: all swings are HRs | 5.0x | Rare; requires consecutive Surge MAX |

**Fill Rate:**
- Home Run: +0.30
- Base Hit: +0.18
- Foul: +0.08
- Strike: -0.05

**Activation Logic:**
- When Surge ≥0.2, an activation button appears
- Player can tap to consume Surge meter for current swing (provides bonus timing window)
- SURGE MAX (1.0) automatically triggers, guaranteeing a home run on successful contact

**Design Philosophy:** Surge creates momentum cycles—skilled play builds power, rewarding player consistency and creating "flow state."

---

## 8. Monetization Model

### 8.1 Revenue Streams

#### Free-to-Play Core
- **No Pay-to-Win:** All gameplay advantages are cosmetic or time-limited (power-ups)
- **No Ad Walls:** No interstitial ads or forced video views
- **Earn-to-Play:** All cosmetics unlockable through gameplay

#### In-Game Currency (Coins)
- **Earned:** HR=3, Hit=2, Walk=1 (multiplied by combo/surge/power-ups)
- **Use:** Power-up purchases, cosmetic unlocks
- **Soft Currency:** Abundant, no hard cap

#### Premium Currency (Superwall Packs)
One-time purchases for players who want cosmetics faster:
- **Starter Pack:** $0.49 → 500 Superwall Coins
- **Value Pack:** $0.99 → 1,200 Superwall Coins
- **Super Pack:** $1.99 → 2,500 Superwall Coins
- **No Gameplay Advantage:** Pure cosmetics

#### VIP Pass Subscription ($0.99/year)
- **Benefits:**
  - 2x coin multiplier (stacks with other multipliers)
  - Free cosmetics (monthly new skin/theme)
  - Exclusive VIP emote in multiplayer
  - Ad-free (no ads present anyway, but reinforces value)
- **Optional:** Players can earn all cosmetics for free via grinding

### 8.2 Cosmetics & Customization

#### Skins (18 total)
Customizable bat/player appearance:
1. Classic Wooden Bat
2. Silver Aluminum
3. Gold Limited Edition
4. Neon Green (Glow-in-Dark effect)
5. Carbon Fiber
6. Vintage Leather Grip
7. Holographic (legend unlock, 75 stars)
8. Diamond Encrusted (200 stars, rare)
... (10 more, mixed unlock methods: level requirements, star thresholds, special events)

**Unlock Methods:**
- Coins (50-200 per skin)
- Stars (3-star threshold: 10+ stars for rare skins)
- Superwall Coins (premium)
- Event rewards (seasonal)

#### Themes (8 total)
Stadium environmental skins:
1. Classic Green Field
2. Night Game (stadium lights)
3. Retro 1980s
4. Neon Cyberpunk
5. Desert Sunset
6. Arctic Winter
7. Volcanic Inferno (legend unlock)
8. Cosmic Space (ultimate prestige)

**Requirements:** Level gating (5, 15, 25, 50, 75, 100, 125, 150)

### 8.3 Pricing Philosophy
- **Low Barrier to Entry:** $0.99 cosmetic packs accessible to broad audience
- **No Loot Boxes:** All cosmetics listed with drop rates/costs transparent
- **Cosmetics-First:** Only visual/convenience benefits monetized
- **Respect Player Time:** Everything earnable through gameplay

---

## 9. Accessibility & Inclusive Design

### 9.1 Visual Accessibility
- **Colorblind Modes (3 variants):**
  - Protanopia (red-blind): Shift reds → yellows, greens → blues
  - Deuteranopia (green-blind): Shift greens → reds, blues → grays
  - Tritanopia (blue-blind): Shift blues → reds, yellows → grays
- **High Contrast Mode:** Increase UI text contrast to WCAG AAA (7:1 minimum)
- **UI Scaling:** Adjustable font sizes (100%-150%)
- **Enlarged Hit Zones:** Touch targets ≥48px × 48px (WCAG guideline)

### 9.2 Motor Accessibility
- **Adjustable Swipe Sensitivity:** Distance threshold 10-50px (default 28px)
- **Reduced Motion Mode:** Disable camera shake, particle effects, animations
- **Alternative Input:** Keyboard (arrow keys to swing left/right) for players with limited fine motor control
- **Hold-to-Swing:** Toggle option to hold button instead of swipe

### 9.3 Auditory Accessibility
- **Sound Captions:** Visual indicators for all audio cues (pitch alert, impact, home run chime)
- **Haptic Feedback:** Vibration on contact (optional toggle)
- **Mute Option:** All audio silenceable without losing gameplay cues

### 9.4 Cognitive Accessibility
- **Simplified UI Toggle:** Hide advanced stats, show only essential feedback
- **Pause & Resume:** Mid-pitch pause permitted (no score penalty)
- **Clear Feedback:** Immediate visual/textual explanation of outcomes

### 9.5 Screen Reader Support (Partial)
- **Aria Labels:** Button labels and game state descriptions
- **Descriptive Text:** Level intro screens provide context
- **Limitations:** Real-time swipe timing not fully screen-reader accessible (fundamental mechanic limitation)

---

## 10. Technical Specifications

### 10.1 Platform & Architecture
- **Platform:** iOS (Expo), Progressive Web App (PWA)
- **Core Engine:** Single HTML5 Canvas (390×844px, iPhone viewport)
- **Codebase:** 12,006 lines vanilla JavaScript (~444KB)
- **Libraries:** None (zero external dependencies)
- **Runtime:** Browser (Edge 90+, Chrome 90+, Safari 14+)

### 10.2 Rendering Pipeline
- **Canvas Context:** 2D
- **Resolution:** 390×844px (target), scales to device dimensions
- **Frame Rate:** 60 FPS (requestAnimationFrame)
- **Rendering Order:**
  1. Background (field with theme effects)
  2. Pitcher & ball flight
  3. Hit zone visualizer (ellipse + arrival ring)
  4. Particles (dust, hit effects)
  5. UI overlays (score, combo, surge meter)
  6. Power-up indicators

### 10.3 Camera System
- **Base Position:** Centered on batter's box
- **Shake Effect:** On contact (5-15px random offset, damped)
- **Zoom:** No zoom (fixed viewport)
- **Motion:** Smooth pan between camera focus points

### 10.4 Particle System
- **Pool Size:** 250 max particles (object pooling)
- **Particle Types:**
  - Dust clouds (contact)
  - Home run explosion (gold/orange spray)
  - Strike/foul indicators (red X)
  - Combo popup text (floating numbers)
- **Lifetime:** 0.3-2.0 seconds per particle
- **Culling:** Off-screen particles recycled

### 10.5 Field Effects
- **Spotlights:** Animated stage lighting (2-4 moving spotlights on legend)
- **Heat Shimmer:** Wavy distortion on hard/legend difficulty
- **Dust Motes:** Floating particles in air (legend only)
- **Motion Blur:** 8-position blur trail on fast pitches (legend)

### 10.6 Ball Physics Visualization
- **Trajectory:** Bezier curve calculation for pitch path
- **Smoke Trail:** Rendered path showing pitch curve
- **Spin Indicator:** Visual indicator of ball spin (legend mode shows rotation)
- **Impact Feedback:** Collision detection triggers particle burst

### 10.7 Performance Targets
- **Load Time:** <2s (PWA cache)
- **Memory:** <50MB runtime (typical)
- **Battery Impact:** Minimal (60 FPS, no location/sensors)
- **Network:** Offline capable (cosmetics cached locally)

### 10.8 Data Persistence
- **LocalStorage:** Player progress, settings, cosmetics unlocked
- **SessionStorage:** Current game state
- **IndexedDB:** Backup for large datasets (achievements, missions)
- **Cloud Sync:** Convex REST API (leaderboards, profile)

---

## 11. User Experience & UI Design

### 11.1 Screen Flow
```
Main Menu
├─ Play Campaign (Level Select)
├─ Multiplayer (Leaderboards/Queue)
├─ Shop (Cosmetics/Power-ups)
├─ Achievements
├─ Missions
└─ Settings (Accessibility, Audio, Video)

In-Game HUD
├─ Score (top-left)
├─ Combo Counter (top-right)
├─ Surge Meter (bottom-center)
├─ Power-up Queue (left side)
└─ Pitch/Outcome Display (center)
```

### 11.2 Visual Hierarchy
1. **Primary Focus:** Ball flight & hit zone (center 40% of screen)
2. **Secondary:** Score, combo, surge (corners)
3. **Tertiary:** Power-up indicators, level progress (margins)

### 11.3 Feedback Loops
| Event | Visual | Audio | Haptic |
|-------|--------|-------|--------|
| Perfect HR | Gold explosion + particles | C-E-G chord (120ms) | 3× vibration pulse |
| Base Hit | Green impact + text popup | 523Hz sine (100ms) | Single vibration |
| Foul | Red X + spark | 300Hz square wave | Light buzz |
| Strike | Gray overlay + ✗ | 200Hz sine (200ms) | Long vibration |
| Surge Activation | Meter flash + glow | 659Hz alert tone | Double pulse |
| Level Complete | Confetti + trophy | Victory fanfare | Celebration vibration |

### 11.4 Button/Control Layout
- **Pitch Screen:** Centered, swipe detection active across entire canvas
- **Menu Buttons:** Thumb-friendly (bottom-right quadrant)
- **Power-up Activation:** Large button appears when Surge ≥0.2 (150px radius)
- **Settings:** 3-dot menu (top-left, persistent)

### 11.5 Onboarding
1. **Tutorial (Levels 1-3):** Guided pitch explanation, swing mechanics
2. **Tool Tips:** First encounter with each pitch type, power-ups, surge
3. **Difficulty Scaling:** Campaign ramps gradually; hard spike at Level 31+
4. **Pause Menu:** Available mid-game; no penalty for pausing

---

## 12. Audio Design

### 12.1 Web Audio API Synthesis
All sound effects generated real-time using ADSR envelopes:

| Sound | Frequency | Type | Duration | ADSR |
|-------|-----------|------|----------|------|
| Pitch Alert | 659Hz | Sine | 200ms | A: 0ms, D: 50ms, S: 100ms, R: 50ms |
| Swing Impact | 400-600Hz | Sawtooth (sweep) | 150ms | A: 10ms, D: 60ms, S: 0ms, R: 80ms |
| Home Run Chime | C-E-G chord (262/330/392Hz) | Sine | 800ms | A: 50ms, D: 200ms, S: 400ms, R: 150ms |
| Base Hit | 523Hz | Sine | 100ms | A: 0ms, D: 80ms, S: 0ms, R: 20ms |
| Foul | 300Hz | Square | 150ms | A: 5ms, D: 100ms, S: 0ms, R: 45ms |
| Strike | 200Hz | Sine | 200ms | A: 0ms, D: 100ms, S: 50ms, R: 50ms |
| Curveball (pitch indicator) | 659Hz | Sine | 150ms | A: 10ms, D: 60ms, S: 50ms, R: 30ms |
| Ambient | Pink noise filtered | Low-pass filter | Looping | Fade in/out |

### 12.2 Audio Settings
- **Master Volume:** 0-100%
- **SFX Toggle:** On/Off
- **Ambient Toggle:** On/Off
- **Voice Lines:** Disabled (design decision for simplicity)

### 12.3 Accessibility
- **Sound Captions:** Text labels for all audio cues (always visible)
- **Haptic Alternatives:** Vibration replaces audio if muted
- **No Critical Audio:** Gameplay fully playable muted

---

## 13. Multiplayer & Social Features

### 13.1 Architecture
- **Backend:** Convex REST API (serverless, real-time)
- **Authentication:** OAuth via device ID (simplified, no passwords)
- **Latency:** <200ms assumed for leaderboard updates

### 13.2 Leaderboard System
- **Global Top 10:** Highest XP leaders (updated hourly)
- **Player Rank:** Player's own rank among all players (e.g., #1,234)
- **Monthly Reset:** Option for monthly leaderboards (seasonal competition)
- **Display:** Player name, XP, level, win rate

### 13.3 Multiplayer Modes

#### Bot Matching (Queue-Based)
- **Queue Polling:** 2-second check for match availability
- **Matchmaking:** Opponent selected within 5 level bands (e.g., level 25-30 matched with 20-35 players)
- **Match Structure:** Head-to-head; each player faces same pitch sequence, higher score wins
- **Duration:** 5 innings (5 pitches each)
- **Rewards:** ×1.5 coin multiplier for multiplayer wins

#### Private Rooms
- **Room Code:** 6-character alphanumeric (e.g., "ABC123")
- **Invite:** Share code with friends via clipboard
- **Settings:** Host can set difficulty (easy/medium/hard/legend)
- **Turnbased:** Players take turns; scoreboard tracked in real-time

#### Spectator Mode (Future)
- **Replay Watch:** View replayed pitch sequences from top players
- **Learning Tool:** Analyze swing timing of skilled players

### 13.4 Social Integration
- **Emotes:** Post-match taunt/praise (optional, gated behind cosmetics)
- **Friend List:** Add players; cross-play invites
- **Replay Sharing:** Export GIF of best home runs (generated client-side)
- **No Chat:** Avoid moderation/toxicity overhead

---

## 14. Missions & Achievements

### 14.1 Repeatable Missions (Daily Refresh)
Reset every 24 hours; players can complete multiple times for incremental rewards.

| Mission | Objective | Reward | Difficulty |
|---------|-----------|--------|------------|
| First HR | Hit 1 home run in any level | 10 coins | Trivial |
| Hot Streak | Win 3 consecutive levels without losing | 15 coins | Easy |
| Slugger | Hit 5 home runs in a single session | 20 coins | Medium |
| Legend Slayer | Win a legend difficulty level (61-100) | 25 coins | Hard |

**Tracking:** Client-side counter; resets if any objective fails (e.g., Hot Streak breaks on loss)

### 14.2 Permanent Achievements (10 total)
One-time unlocks with progress bars; rewards coin bonuses:

| Achievement | Objective | Progress | Reward |
|-------------|-----------|----------|--------|
| Rookie | Reach Level 10 | 10 | 15 coins |
| Rising Star | Reach Level 25 | 25 | 25 coins |
| Pro Player | Reach Level 50 | 50 | 35 coins |
| Master Hitter | Reach Level 75 | 75 | 50 coins |
| Legend Status | Reach Level 100 | 100 | 75 coins |
| Perfect Timing | Hit 50 perfect swings (HRs) | 50 | 30 coins |
| Combo King | Build a 10+ combo streak | 1 | 20 coins |
| Surge Master | Activate Surge 20 times | 20 | 25 coins |
| All-Star | Equip all cosmetics (18 skins + 8 themes) | 26 | 40 coins |
| Leaderboard Top 100 | Reach top 100 global XP | 1 | 50 coins |

**Display:** Progress bar visible on achievement card; completed achievements show checkmark

---

## 15. Analytics & Progression Tracking

### 15.1 Tracked Metrics
| Metric | Purpose | Update Frequency |
|--------|---------|------------------|
| Sessions | Daily active users | Per session start |
| Session Duration | Engagement | Per session end |
| Level Completion Rate | Difficulty balance | Per level |
| Average Coins/Session | Monetization health | Per session |
| Power-up Usage | Feature adoption | Per purchase |
| Cosmetic Unlock Rate | Item appeal | Per unlock |
| Multiplayer Matches | Social feature health | Per match |
| Churn Rate | Long-term retention | Weekly |

### 15.2 Funnels to Monitor
1. **Install → Tutorial Complete → Level 5:** Onboarding health
2. **Level 25 → Level 30:** Medium difficulty spike retention
3. **Level 60 → Level 65:** Legend difficulty adoption
4. **Free Player → VIP Conversion:** Monetization funnel

### 15.3 Heatmap Data
- **Swipe Timing Distribution:** Histogram of player swings relative to contact point (detect early/late bias)
- **Power-up Trigger Points:** Levels where players most frequently purchase/use power-ups
- **Multiplayer Queue Wait Time:** Average time to match

### 15.4 Server Events (Convex Logging)
- Level start/complete (with time, stars, coins earned)
- Multiplayer match result
- Shop purchase
- Cosmetic unlock
- Achievement progress
- Error/crash logs

---

## 16. Game Balance & Tuning

### 16.1 Difficulty Curve
| Level Range | Difficulty | Pitch Speed | AI Aggression | Target Runs | At-Bats |
|-----------|-----------|------------|-------------|------------|---------|
| 1-10 | Easy | 260-300 px/s | 0.15 | 2 | 5 |
| 11-30 | Medium | 350-450 px/s | 0.40 | 3 | 5 |
| 31-60 | Hard | 500-580 px/s | 0.70 | 4 | 5 |
| 61-100 | Legend | 620-645 px/s | 1.0 | 5 | 5 |
| Boss (25, 50, 75, 100) | +1 Tier | +50 px/s | +0.2 | +1 run | 7 |

### 16.2 Tuning Levers
**If Players Too Successful:**
- Decrease timing window widths (-10ms to PERFECT/GOOD)
- Increase pitch speed variance
- Reduce power-up frequency
- Increase AI aggression value

**If Players Too Frustrated:**
- Expand timing windows (+15ms)
- Decrease pitch speed for easy/medium
- Increase power-up drop rate
- Add tutorial levels 1-5

### 16.3 Live Balance Updates
- **A/B Testing:** Patch notes document balance changes (e.g., "Reduced Surge HOT tier window bonus 40% → 35%")
- **Telemetry-Driven:** Analytics guide changes (e.g., if level 31 completion rate <30%, reduce difficulty)
- **Player Feedback:** Community survey on difficulty every quarter

---

## 17. Content & Feature Roadmap

### Phase 1 (Launch)
- Core 100-level campaign
- 4 pitch types + AI system
- Combo & Surge mechanics
- 18 skins + 8 themes
- Leaderboards & multiplayer queue
- Accessibility suite

### Phase 2 (Month 3)
- Seasonal cosmetics (Spring skins, Summer themes)
- Private multiplayer rooms (friend invitation)
- Challenge mode (5-wave gauntlet)
- Expanded achievements (15 total)

### Phase 3 (Month 6)
- Tournament system (bracket-based multiplayer)
- Stat tracking dashboard (personal bests, heat maps)
- Replay system (save and share at-bats)
- New pitch type: Knuckleball (unpredictable)

### Phase 4 (Month 12)
- Cross-platform progression (iOS ↔ PWA sync)
- Battle Pass system (optional, cosmetics-only)
- Guild system (player teams, crew challenges)
- 3D pitch visualization option

---

## 18. Post-Launch Support

### 18.1 Bug Fixes & Stability
- Weekly patch review (Tuesdays)
- Critical bugs hotfixed same-day
- Telemetry-flagged crashes prioritized

### 18.2 Community Engagement
- Monthly Dev Blog (balance changes, upcoming features)
- Discord community hub (fan art, strategy guides)
- Monthly leaderboard reset with cosmetic reward
- Quarterly AMA (Ask Me Anything) sessions

### 18.3 Seasonal Content
- Quarterly cosmetic releases (Spring/Summer/Fall/Winter themes)
- Holiday events (7 days limited-time cosmetics)
- Anniversary celebration (in-game free cosmetics)

---

## 19. Legal & Compliance

### 19.1 Data Privacy
- GDPR compliant (no personal data collected beyond username/device ID)
- CCPA opt-out support (disable analytics)
- Privacy policy published in-game

### 19.2 Ratings & Content
- **Target Rating:** ESRB E (Everyone) / PEGI 3
- **Content:** Sports simulation, no violence/profanity
- **No Ads:** Family-friendly marketing

### 19.3 Fair Play
- **Anti-Cheat:** Client-side validation (cheat-resistant timing)
- **Account Security:** Device ID + session tokens
- **RNG Transparency:** Pitch selection probabilities published

---

## 20. Conclusion

**BaseHit** combines accessible arcade mechanics with strategic depth, creating a skill-rewarding experience that appeals to casual gamers and baseball enthusiasts alike. The dynamic Surge system and AI adaptation foster replayability, while the ethical monetization model (cosmetics + optional VIP) ensures long-term player trust. With 100 levels, multiplayer integration, and a clear post-launch roadmap, BaseHit is positioned to establish a loyal player community in the sports gaming space.

**Success Metrics:**
- DAU (Daily Active Users): 50K+ in Month 1
- Retention: 40%+ Day 7, 25%+ Day 30
- VIP Conversion: 5-8% of active players
- Average Session Length: 12-15 minutes
- Community Engagement: 15%+ multiplayer participation

---

**Document Version History**
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | March 2026 | Initial GDD from reverse engineering analysis |

---

*This Game Design Document is confidential and proprietary. Unauthorized reproduction or distribution is prohibited.*

# GAME DESIGN DOCUMENT
## CrickBot AI

**Document Version:** 2.0
**Last Updated:** March 30, 2026
**Status:** Production-Ready
**Target Platform:** iOS (Capacitor/Expo), Progressive Web App (PWA)

---

## TABLE OF CONTENTS
1. Executive Summary
2. Game Concept
3. Core Gameplay Mechanics
4. AI System Architecture
5. Progression & Economy
6. Monetization Strategy
7. Technical Specifications
8. UX/UI Design
9. Audio Design
10. Multiplayer System
11. Analytics & Metrics
12. Development Roadmap

---

## 1. EXECUTIVE SUMMARY

**Project Title:** CrickBot AI
**Genre:** Sports / Cricket Simulator
**Target Audience:** Casual cricket fans aged 16-45, mobile gamers, esports enthusiasts
**Platforms:** iOS (native via Capacitor), Android PWA, Web PWA
**Estimated Session Length:** 2-5 minutes per match

### Vision
CrickBot delivers an immersive, AI-driven cricket batting experience on mobile devices. Using gesture-based controls, intelligent opponent modeling, and progressive difficulty, the game bridges casual gameplay with competitive depth, accessible to new players while offering mastery curves for enthusiasts.

### Key Differentiators
- **Gesture Recognition System:** Intuitive swipe-based shot selection with physics-informed power calculation
- **Adaptive AI Opponent:** 4-phase intelligence system that learns player behavior and maintains dynamic challenge
- **Rich Progression:** 100-level campaign across 10 stadium themes with escalating difficulty
- **Monetization Balance:** Optional cosmetics and power-ups without pay-to-win mechanics
- **Offline-First Architecture:** Full gameplay without internet; optional cloud sync via Convex backend

---

## 2. GAME CONCEPT

### Pitch
A single-player and multiplayer cricket batting simulator where players face procedurally-varied bowling attacks. Success depends on reading the bowler's intent, timing the shot execution, and matching shot selection to ball characteristics. Progression spans 100 levels across iconic cricket venues, with difficulty scaling from Rookie to Legend tier.

### Game Loop
1. **Preparation Phase:** Bowler selects delivery type; UI displays indicator
2. **Delivery Phase:** Ball animates toward batsman; player executes swipe gesture
3. **Execution Phase:** Timing and shot type mapped against ball characteristics
4. **Resolution Phase:** Runs calculated; wicket resolved or safe play awarded
5. **Progression Phase:** XP and coins awarded; next delivery queued

### Setting & Atmosphere
- **Venues:** 10 distinct cricket stadiums (MCG, Lord's, Eden Gardens, WACA, Wankhede, etc.)
- **Atmosphere:** Dynamic crowd reactions, weather effects, ambient audio
- **Time-of-Day Variations:** Day matches, twilight, floodlit
- **Visual Style:** Clean, modern UI layered over stadium environments; particle-driven effects

### Core Fantasy
"Master the art of cricket batting through timing, reading, and adaptation—face an intelligent opponent that learns your patterns and evolves to stay competitive."

---

## 3. CORE GAMEPLAY MECHANICS

### 3.1 Shot System

#### Shot Types (6 Primary)
| Shot Type | Angle Range | Typical Use | Skill Ceiling |
|-----------|------------|------------|---------------|
| **LOFT** | 45-75° | Over-the-top boundaries, aggressive risk | Medium |
| **DRIVE** | 10-35° | Down-the-ground aggressive | Medium |
| **CUT** | 75-110° | Lateral short balls | High |
| **PULL** | 130-155° | Short-pitched deliveries | High |
| **SWEEP** | 155-180° | Spinner/yorker defense | Very High |
| **DEFEND** | 350-10° (straight) | Defensive play, singles | Low |

#### Swing Detection Algorithm
```
angle = atan2(endY - startY, endX - startX)
mappedAngle = (angle + π) % 2π
shotType = ANGLE_TO_SHOT[floor(mappedAngle / 45°)]

distance = sqrt((endX - startX)² + (endY - startY)²)
power = min(distance / 80px, 1.0)  // Normalized at 80px, min 25px
```

### 3.2 Ball System

#### Ball Types (6 Variants)
| Ball Type | Speed | Characteristic | AI Frequency | Counter |
|-----------|-------|-----------------|--------------|---------|
| **Fast** | 140-145 km/h | Direct, predictable | 35% | Drive, Defend |
| **Medium** | 120-135 km/h | Balanced threat | 25% | Cut, Drive |
| **Spin** | 80-100 km/h | Turn/bounce variance | 20% | Sweep, Defend |
| **Yorker** | 135-145 km/h | Unpredictable length | 12% | Defend, Sweep |
| **Bouncer** | 140+ km/h | Short-pitched, evasive | 5% | Pull, Sway |
| **Slower** | 90-110 km/h | Deceptive pace | 3% | Loft, Cut |

#### Ball Attributes
- **Length:** Short (0-7ft from crease), Good (7-15ft), Yorker (0-1ft)
- **Line:** Left (off-stump), Center, Right (leg-stump)
- **Seam Position:** Defines trajectory and break
- **Flight Path:** Animated with physics-based arc

### 3.3 Timing System

#### Timing Windows (Relative to Ball Impact at Home)
| Timing Zone | Pixel Range | Multiplier | Difficulty |
|-------------|------------|-----------|-----------|
| **Perfect** | 690-745px | 1.3x | ±3 frames |
| **Good** | 655-690px, 745-775px | 1.0x | ±6 frames |
| **Edge** | 620-655px, 775-810px | 0.7x | ±9 frames |
| **Miss** | Outside Edge | 0.0x | Wicket risk |

**Timing Calculation:**
```
ballPixelPosition = bowlStartY + (currentFrame / totalFrames) * (homeY - bowlStartY)
timingZone = evaluateRange(ballPixelPosition)
timingMultiplier = getMultiplier(timingZone)
```

### 3.4 Run Scoring

#### Score Calculation Algorithm
```
baseRuns = BAT_EFFECTIVENESS[ballType][shotType][length]
variance = random(0.8, 1.2)  // Luck factor
luck = (random() > 0.7) ? 1.5 : 1.0  // Luck bonus 30%
finalScore = baseRuns × timingMultiplier × luck × variance × surgeMultiplier
```

#### Run Distribution Table (BAT_EFFECTIVENESS)
Exemplar excerpt:
```
FAST + DRIVE + GOOD = 4 (potential boundary)
FAST + DEFEND + GOOD = 1 (safety run)
SPIN + SWEEP + SHORT = 2 (accumulation)
YORKER + DEFEND + YORKER = 0 (dot ball)
BOUNCER + PULL + SHORT = 6 (boundary)
```

**Wicket Conditions:**
- Timing = Miss (outside all zones)
- Shot type fundamentally mismatches ball (e.g., Sweep vs. Fast Short-pitched)
- Random "edges" reduced by Perfect timing
- Bowler's luck factor (AI modifier, 5-15%)

### 3.5 Surge System

#### 4-Tier Momentum Mechanic
| Tier | Multiplier | Activation | Decay |
|------|-----------|-----------|-------|
| **BOOST** | 1.3x | 3 consecutive good hits | 1 miss → reset |
| **HYPER** | 1.6x | 5 consecutive good hits | 1 miss → BOOST |
| **ULTRA** | 2.0x | 8 consecutive good hits | 1 miss → HYPER |
| **LEGEND** | 2.5x | 12 consecutive good hits | 1 wicket → BOOST |

**Visual Feedback:**
- Screen border glow (blue → cyan → gold → rainbow)
- Crowd intensity escalates
- Bat trail particle intensity increases
- Audio cadence accelerates

### 3.6 Difficulty Scaling

#### Per-Level Scaling Parameters
```javascript
level = currentLevel  // 1-100
difficultySeed = level * 1.15  // Exponential growth

ballVariance = 8 + (difficultySeed * 0.5)  // Delivery unpredictability
bowlerAggression = 0.3 + (level / 100) * 0.6  // 30% → 90%
aiPredictionAccuracy = 0.4 + (level / 100) * 0.4  // 40% → 80%
targetWinRate = 0.45  // Adaptive to maintain 45% win rate
```

---

## 4. AI SYSTEM ARCHITECTURE

### 4.1 Overview
A 4-phase progression system that evolves from deterministic rule-based play to learning-based adaptation to API-driven commentary.

### 4.2 Phase 1: Rule-Based Lookup Tables

**Bowler Strategy Selection:**
```javascript
const BAT_EFFECTIVENESS = {
  [ballType]: {
    [length]: {
      [line]: effectivenessScore
    }
  }
};

// Weighted random selection
selectedBall = weightedRandomSelect(
  BAT_EFFECTIVENESS[bowlerStrength] × currentAggressionLevel
);
```

**Characteristics:**
- Immediate, deterministic
- 4KB lookup table footprint
- Baseline: 40% win rate vs. random player

### 4.3 Phase 2: Player Behavior Modeling

**Tracked Metrics (2-4KB per player):**
```javascript
playerModel = {
  shotFrequency: {
    [shotType]: count,  // How often player uses each shot
    ...
  },
  shotSuccessRate: {
    [shotType]: winRate,
    ...
  },
  aggression: {
    current: 0.0-1.0,
    trend: +0.05 per good shot,
    decay: -0.02 per miss
  },
  ballTypeVulnerability: {
    [ballType]: weaknessScore,
    ...
  },
  lengthPreference: {
    [length]: preference,
    ...
  }
};
```

**Bowler Adaptation:**
```javascript
// Increase ball selection if player struggles vs. it
for (let ball of ballTypes) {
  if (playerModel.ballTypeVulnerability[ball] > 0.6) {
    bowlerFrequency[ball] += 0.05;  // Exploit weakness
  }
}

// Counter aggression with variation
if (playerModel.aggression.current > 0.7) {
  bowlerVariation += 0.2;  // More unpredictable deliveries
}
```

**Characteristics:**
- Builds over 5-10 matches
- 2-4KB memory footprint
- Baseline: 55% win rate vs. adaptive player

### 4.4 Phase 3: Bayesian Prediction + Sequence Learning

**Prediction Models:**

1. **Bayesian Shot Probability:**
```javascript
P(shotType | ballType, length, line, playerState) =
  (P(ballType | shotType) × P(shotType | playerModel)) / P(ballType)

predictedShot = argmax(P(shotType | ...))
```

2. **Sequence Prediction:**
```javascript
// Markov chain: (prevShot, prevTiming) → nextShot
transitionMatrix = {
  [prevShot + prevTiming]: {
    [nextShot]: probability,
    ...
  }
};

predictedShot = sampleFromDistribution(transitionMatrix[last]);
```

3. **Timing Prediction:**
```javascript
// Gaussian distribution of player's timing variance
timingModel = {
  mean: playerAvgTiming,
  stdDev: playerTimingVariance,
  outlierRatio: playerWildcardRate
};

expectedTiming = sample(N(mean, stdDev));
```

**Bowler Decision Logic:**
```javascript
if (predictionConfidence > 0.75) {
  // Exploit predicted shot
  selectedBall = COUNTER_BALLS[predictedShot];
} else {
  // Maintain pressure with variation
  selectedBall = selectByAggression(bowlerStrength);
}

adaptiveWinTarget = 0.45;  // Maintain 45% win rate
if (recentWinRate > adaptiveWinTarget) {
  bowlerAggression += 0.05;  // Increase challenge
} else if (recentWinRate < adaptiveWinTarget - 0.1) {
  bowlerAggression -= 0.05;  // Decrease challenge
}
```

**Characteristics:**
- Activates after 20+ matches
- Dynamic difficulty maintenance
- Baseline: 65% win rate vs. predictive AI
- CPU cost: ~10ms per decision

### 4.5 Phase 4: Claude API Commentary (Optional, Advanced)

**Activation:**
- Opt-in via settings
- 6 calls/hour rate limit (caching between matches)
- Circuit-breaker fallback if API unavailable

**Cached Commentary Triggers:**
```javascript
const commentaryTriggers = [
  { event: 'WICKET_FALL', cache: true, ttl: 7200 },
  { event: 'CENTURY', cache: true, ttl: 7200 },
  { event: 'CONSECUTIVE_SIXES', cache: true, ttl: 3600 },
  { event: 'MAIDEN_OVER', cache: false },
  { event: 'MATCH_RESULT', cache: true, ttl: 86400 },
];
```

**API Call Format:**
```javascript
const prompt = `
Cricket match context:
- Player score: ${playerScore}
- Wickets: ${wicketsDown}
- Overs: ${oversCount}
- Last event: ${eventType}
- Player streak: ${currentStreak}

Generate a single-sentence cricket commentary (max 150 chars) for this moment.
Focus on ${eventType}. Keep enthusiasm appropriate to the event severity.
`;

commentary = await cachedClaudeCall(prompt, cacheKey, 1800);  // 30min cache
```

**Fallback System:**
```javascript
try {
  commentary = await claude.call(prompt);
} catch (error) {
  if (circuitBreaker.isOpen()) {
    commentary = FALLBACK_COMMENTARY[eventType];  // Use pre-written fallbacks
  }
}
```

**Characteristics:**
- Enhanced immersion and narrative
- Minimal performance impact (cached, async)
- Graceful degradation if API unavailable
- Optional for players without API key

### 4.6 AI Subsystem Summary

| Phase | Complexity | Memory | Win Rate | Activation |
|-------|-----------|--------|----------|-----------|
| 1 (Rule-Based) | O(1) | 4KB | 40% | Level 1+ |
| 2 (Behavioral) | O(n) | 2-4KB | 55% | After 5 matches |
| 3 (Predictive) | O(n²) | 8KB | 65% | Level 20+ |
| 4 (API) | O(1) cached | 0KB (cache external) | N/A | Opt-in, Level 50+ |

---

## 5. PROGRESSION & ECONOMY

### 5.1 Campaign Structure

#### 100-Level Campaign
**Distribution Across 10 Stadium Themes:**
- Levels 1-10: MCG (Melbourne Cricket Ground) — Rookie
- Levels 11-20: Lord's Cricket Ground — Rookie+
- Levels 21-30: Eden Gardens — Intermediate
- Levels 31-40: WACA (Perth) — Intermediate+
- Levels 41-50: Wankhede Stadium — Pro
- Levels 51-60: Trent Bridge — Pro+
- Levels 61-70: Feroz Shah Kotla — Champion
- Levels 71-80: Bellerive Oval — Champion+
- Levels 81-90: Basin Reserve — Legend
- Levels 91-100: Galle International — Legend+

#### Boss Levels
Critical checkpoints with heightened challenge:
- **Level 25 (MCG Finals):** Bowler aggression 70%, prediction accuracy 60%
- **Level 50 (Wankhede Challenge):** Bowler aggression 80%, prediction accuracy 75%
- **Level 75 (Feroz Shah Kotla Masters):** Bowler aggression 85%, prediction accuracy 85%
- **Level 100 (Galle International World Cup):** Bowler aggression 90%, prediction accuracy 90%

**Boss Rewards:**
- 2x XP multiplier
- Unique cosmetic avatar or bat skin (one-time unlock)
- Certificate/badge in profile

### 5.2 XP & Leveling System

#### Experience Progression
```javascript
// Exponential XP requirements
xpToNextLevel[n] = 100 × (1.4 ^ (n - 1))

xpToNextLevel[1] = 100
xpToNextLevel[2] = 140
xpToNextLevel[3] = 196
xpToNextLevel[10] = 9,633
xpToNextLevel[50] = 10,245,835
xpToNextLevel[100] = 439,804,651,110
```

#### XP Acquisition
```javascript
baseXP = 50 + (level × 5)  // Level 1: 55 XP, Level 100: 555 XP

// Multipliers
matchDuration = matchLength / averageLength
difficultyMultiplier = (playerWinRate <= 0.45) ? 1.2 : 1.0  // Bonus if close match
surgeBonus = surgeLevel × 0.1  // BOOST: +0.3x, LEGEND: +0.4x
scoreMultiplier = playerScore / 100  // Up to 1.5x for high scores

finalXP = baseXP × matchDuration × difficultyMultiplier × surgeBonus × scoreMultiplier
```

#### XP Milestones
- Level 10: "Rookie Mastered" badge + 50 coins
- Level 25: "Stadium Legend" badge + 100 coins + exclusive bat skin
- Level 50: "Master Batsman" title + 250 coins
- Level 100: "Immortal Legend" title + platinum badge + 500 coins + lifetime prestige

### 5.3 Currency System

#### Coins (In-Game Soft Currency)
**Acquisition:**
```javascript
levelCompletionCoins = 3 + level × 1
// Level 1: 4 coins, Level 50: 53 coins, Level 100: 103 coins

surgeBonus = surgeLevel × 2  // Max +8 coins
scoreMultiplier = (playerScore >= 100) ? 1.5 : 1.0

totalCoins = levelCompletionCoins × surgeBonus × scoreMultiplier
```

**Sinks:**
- Cosmetic shop (ball skins, stadium themes, bat designs)
- Power-up purchases (consumable boost items)
- Optional: cosmetic avatar customization

#### Gems (Hard Currency, Optional)
- Purchased via IAP ($0.99 = 50 gems)
- Guaranteed VIP pass conversion
- 1:5 exchange rate to coins (50 gems → 250 coins)
- Cosmetic-only purchases to maintain fairness

### 5.4 Reward Structure

#### Daily/Streak Rewards
```javascript
dailyReward = {
  day1: 10coins,
  day2: 15coins,
  day3: 20coins,
  day4: 25coins,
  day5: 30coins,
  day6: 40coins,
  day7: 100coins,  // Weekly bonus
};

// Reset on miss; streak multiplier
currentStreak = lastLoginDay === yesterday ? previousStreak + 1 : 1;
multiplier = min(currentStreak / 7, 2.0);  // Cap at 2x
rewardWithStreak = dailyReward[dayOfWeek] × multiplier;
```

#### Match Completion Bonuses
- **First Match Today:** +25 bonus coins
- **3 Matches Today:** +50 bonus coins
- **5 Matches Today:** +100 bonus coins
- **Win-Streak (5+):** +200 bonus coins + special banner

---

## 6. MONETIZATION STRATEGY

### 6.1 Monetization Model: Cosmetics + Optional Power-ups

**Philosophy:** Non-intrusive, optional purchases that enhance UX without creating pay-to-win dynamics. Core gameplay is 100% free; monetization funds live ops and server costs.

### 6.2 Shop Categories

#### 1. Cosmetics (Permanent, Non-Consumable)
```javascript
const cosmetics = {
  ballSkins: {
    "Gold Leather": { price: 150coins, rarity: "rare" },
    "Holographic": { price: 200coins, rarity: "epic" },
    "Neon Glow": { price: 250coins, rarity: "legendary" },
  },
  stadiumThemes: {
    "Night Match": { price: 100coins, rarity: "common" },
    "Rainy Pitch": { price: 150coins, rarity: "rare" },
    "Sunset Golden Hour": { price: 200coins, rarity: "epic" },
  },
  batSkins: {
    "Carbon Fiber": { price: 120coins, rarity: "rare" },
    "Diamond Encrusted": { price: 300coins, rarity: "legendary" },
  },
  avatarFrames: {
    "Gold Champion": { price: 100coins, rarity: "rare" },
    "Platinum Legend": { price: 250coins, rarity: "legendary" },
  },
};
```

#### 2. Power-ups (Consumable, Single-Use)
```javascript
const powerUps = {
  scoreBoost: {
    name: "2x Score Multiplier",
    price: 50coins,
    duration: "Next Match",
    effect: "All runs × 2 for this match",
    effect_icon: "⚡",
  },
  extraLife: {
    name: "+1 Wicket Buffer",
    price: 75coins,
    duration: "Next Match",
    effect: "Converts first wicket to dot ball",
    effect_icon: "❤️",
  },
  easyMode: {
    name: "Wide Sweet Spot",
    price: 60coins,
    duration: "Next Match",
    effect: "Increase perfect timing window by 30%",
    effect_icon: "✓",
  },
  coinMagnet: {
    name: "+50% Coins",
    price: 80coins,
    duration: "Next Match",
    effect: "All coin rewards × 1.5 this match",
    effect_icon: "💰",
  },
  xpBoost: {
    name: "2x XP Bonus",
    price: 70coins,
    duration: "Next Match",
    effect: "All XP earned × 2 this match",
    effect_icon: "⭐",
  },
};
```

### 6.3 IAP Paywalls (Superwall Integration)

**Superwall Configuration:**

#### Starter Pack ($0.49)
```
500 Coins
└─ ~5 cosmetic items or 10 power-ups
└─ Recommended for new players
└─ First-purchase discount: -10%
```

#### Value Pack ($0.99)
```
1,200 Coins
└─ ~12 cosmetic items or 25 power-ups
└─ 15% discount vs. Starter Pack
└─ Bundle includes: Gold bat skin + 100 bonus coins
```

#### Super Pack ($1.99)
```
2,500 Coins
└─ ~25 cosmetic items or 50 power-ups
└─ 25% discount vs. Starter Pack
└─ Bundle includes: Platinum avatar frame + 200 bonus coins + exclusive themed bat
```

**Paywall Triggers:**
```javascript
const paywallTriggers = [
  { event: 'FIRST_SHOP_OPEN', afterLevel: 5 },
  { event: 'FIRST_LOSS', afterLevel: 10 },
  { event: 'BOSS_LOSS', afterLevel: 25, showsuperpack: true },
  { event: 'SEASONAL_PROMOTION', interval: '14days' },
  { event: 'STREAK_MILESTONE', when: 'wins >= 10' },
];
```

### 6.4 VIP Membership (Optional Annual Pass)

**Annual VIP Pass: $0.99/year**
```javascript
const vipBenefits = {
  dailyBonusCoins: 5,            // Extra 5 coins per daily reward
  xpMultiplier: 1.1,             // 10% XP boost on all matches
  exclusiveCosmeticAccess: true, // Monthly exclusive skins
  adFree: false,                 // Still shows optional ads
  earlyAccessNewFeatures: true,  // Beta test new content
  monthlyVipCrate: true,         // Random cosmetic crate
};

// Implementation
if (user.vipActive) {
  dailyReward = dailyReward + 5;
  xp = xp × 1.1;
  showMonthlyVipCrate();
}
```

### 6.5 Monetization Integrity Safeguards

**Pay-to-Win Prevention:**
- No power-ups affect AI difficulty
- All cosmetics are visual-only, zero gameplay impact
- Coins cannot be converted to XP (one-way exchange only)
- No "instant level-up" purchases

**Engagement Metrics:**
```javascript
const monetizationMetrics = {
  dau: dailyActiveUsers,
  arppu: totalRevenue / payingUsers,  // Target: $0.50-1.50
  arpu: totalRevenue / allUsers,      // Target: $0.05-0.10
  conversionRate: payingUsers / totalUsers,  // Target: 2-5%
  retention: d1Retention,  // Target: >50%
  churn: monthlyChurn,     // Target: <25%
};
```

---

## 7. TECHNICAL SPECIFICATIONS

### 7.1 Platform & Architecture

#### Target Platforms
- **iOS:** Native app via Capacitor wrapper, deployment via App Store
- **Android:** PWA, optional Capacitor build
- **Web:** Progressive Web App, responsive design, installable

#### Technology Stack
```javascript
{
  "runtime": "HTML5 + JavaScript (ES6+)",
  "rendering": "Canvas 2D (414×896px, DPI-aware)",
  "audio": "Web Audio API (synthesis, no external files)",
  "state": "localStorage (JSON) + Capacitor Preferences (native)",
  "backend": "Optional Convex real-time sync",
  "build": "Expo/Capacitor, iOS App Store + Android Play Store",
}
```

#### Performance Targets
- **Canvas FPS:** 60 FPS (iPhone 11 baseline)
- **Frame Time:** < 16.67ms per frame
- **Bundle Size:** < 750KB (gzipped < 200KB)
- **Cold Start:** < 2 seconds
- **Memory Usage:** < 150MB (iOS), < 200MB (Android)

### 7.2 Rendering Engine

#### Canvas Specifications
```javascript
const canvas = {
  width: 414,         // iPhone base width
  height: 896,        // iPhone base height
  pixelRatio: devicePixelRatio,  // DPI awareness
  clearColor: "#1a1a1a",
  renderTarget: "2D context",
};

// High-DPI scaling
ctx.scale(devicePixelRatio, devicePixelRatio);
```

#### Entity Hierarchy
```
Stadium (Background)
├─ Pitch (Grass, Crease Lines, Markings)
├─ Crowd (Particle System)
├─ Bowler (Sprite Animation)
├─ Ball (Physics-based trajectory)
│  └─ Ball Trail (Particle System)
├─ Fielders (6 x Sprites, Dynamic Positioning)
├─ Batsman (Sprite Animation + Hit Detection)
├─ Stumps (Static Geometry + Collision)
├─ Keeper (Sprite Animation)
└─ UI Layer
   ├─ Score Display
   ├─ Wickets Counter
   ├─ Timing Indicator
   └─ Power Meter
```

### 7.3 Particle System

#### Pool-Based Architecture
```javascript
const particlePool = {
  maxParticles: 200,
  activeParticles: new Set(),
  inactivePool: new Array(200),

  emit(x, y, type, count) {
    for (let i = 0; i < count; i++) {
      let particle = this.inactivePool.pop() || new Particle();
      particle.init(x, y, type);
      this.activeParticles.add(particle);
    }
  },

  update(dt) {
    for (let p of this.activeParticles) {
      p.update(dt);
      if (p.isDead) {
        this.activeParticles.delete(p);
        this.inactivePool.push(p);
      }
    }
  }
};
```

#### Particle Types
| Type | Use Case | Count | Lifetime | Effect |
|------|----------|-------|----------|--------|
| **Confetti** | 6-hit boundary | 50 | 3s | Rainbow particles, gravity |
| **Fireworks** | Wicket fall | 30 | 2s | Radial explosion, fade |
| **Crowd Wave** | Surge activation | 20 | 2.5s | Upward float, brightness |
| **Hit Spark** | Bat contact | 15 | 0.8s | Impact velocity transfer |
| **Dust Trail** | Ball delivery | 10 | 1.2s | Linear fade |

### 7.4 State Management

#### localStorage Structure
```javascript
const cricketGameState = {
  version: 2,
  playerProfile: {
    id: "uuid",
    name: "Player Name",
    level: 42,
    totalXP: 1250000,
    coins: 3500,
  },
  gameProgress: {
    currentLevel: 42,
    currentStadium: "MCG",
    matchesWon: 187,
    matchesLost: 213,
    winRate: 0.468,
  },
  inventory: {
    ownedCosmetics: ["Gold Leather", "Night Match", ...],
    activeBallSkin: "Gold Leather",
    activeStadiumTheme: "Night Match",
  },
  stats: {
    totalRuns: 45000,
    totalBoundaries: 2340,
    totalSixes: 156,
    totalWickets: 213,
    consecutiveWins: 8,
    highestScore: 287,
  },
  dailyRewards: {
    lastClaimedDate: "2026-03-30",
    currentStreak: 14,
    nextRewardTime: 1711814400000,
  },
  powerUps: [
    { id: "scoreBoost", quantity: 2, expiryDate: null },
    { id: "extraLife", quantity: 1, expiryDate: null },
  ],
  vipStatus: {
    active: true,
    purchaseDate: 1709078400000,
    expiryDate: 1740614400000,
  },
};

// Migration on load
if (cricketGameState.version < 2) {
  cricketGameState = migrateV1toV2(cricketGameState);
  cricketGameState.version = 2;
  localStorage.setItem('cricketGameState', JSON.stringify(cricketGameState));
}
```

#### Capacitor Preferences (Native Storage)
```javascript
// For sensitive or frequently-accessed data
const preferences = {
  'lastSessionTime': Date.now(),
  'deviceId': uuid(),
  'locale': navigator.language,
  'soundEnabled': true,
  'vibrationEnabled': true,
};

// Save
await Preferences.set({ key: 'userPrefs', value: JSON.stringify(preferences) });

// Load
const { value } = await Preferences.get({ key: 'userPrefs' });
const preferences = JSON.parse(value);
```

#### Optional Backend Sync (Convex)
```javascript
// Sync player profile every 5 minutes or on app suspend
setInterval(async () => {
  const localState = localStorage.getItem('cricketGameState');
  await convex.mutation('syncGameState', { state: localState });
}, 300000);

// Conflict resolution: server-version wins (server is source of truth)
```

### 7.5 Input System

#### Touch & Gesture Recognition
```javascript
class GestureRecognizer {
  constructor(canvas) {
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.canvas = canvas;
  }

  onTouchStart(e) {
    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = Date.now();
  }

  onTouchEnd(e) {
    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const duration = Date.now() - this.startTime;

    // Validate gesture (not just a tap)
    const distance = Math.hypot(endX - this.startX, endY - this.startY);
    if (distance < 25) return;  // Minimum swipe distance
    if (duration > 1000) return;  // Maximum swipe time

    this.handleSwipe(this.startX, this.startY, endX, endY);
  }

  handleSwipe(sx, sy, ex, ey) {
    const angle = Math.atan2(ey - sy, ex - sx);
    const distance = Math.hypot(ex - sx, ey - sy);

    const shot = this.mapAngleToShot(angle);
    const power = Math.min(distance / 80, 1.0);

    return { shot, power };
  }

  mapAngleToShot(radians) {
    const degrees = (radians + Math.PI) % (2 * Math.PI);
    const octant = Math.floor(degrees / (Math.PI / 4));
    return ['DEFEND', 'CUT', 'LOFT', 'PULL', 'SWEEP', 'PULL', 'CUT', 'LOFT'][octant];
  }
}
```

### 7.6 Physics Engine (Simplified)

#### Ball Trajectory
```javascript
class Ball {
  constructor(x, y, type, length, line) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.length = length;
    this.line = line;
    this.frameCount = 0;
    this.totalFrames = 60;  // Animation over 1 second at 60 FPS
    this.isActive = true;
  }

  update() {
    // Linear interpolation along trajectory
    this.frameCount++;
    const progress = this.frameCount / this.totalFrames;

    // Trajectory: bowler → batter
    const trajectoryY = this.getTrajectoryY(progress);
    const trajectoryX = this.getTrajectoryX(progress);

    // Bounce/drift based on ball type
    if (this.type === 'SPIN') {
      trajectoryX += Math.sin(progress * Math.PI * 4) * 15;  // Drift
    }

    if (this.frameCount >= this.totalFrames) {
      this.isActive = false;
    }

    return { x: trajectoryX, y: trajectoryY };
  }

  getTrajectoryY(progress) {
    // Parabolic arc
    const startY = 50;  // Bowler release
    const endY = 750;   // Batter reach
    return startY + (endY - startY) * progress;
  }

  getTrajectoryX(progress) {
    // Line offset
    const lineOffsets = { 'LEFT': -50, 'CENTER': 0, 'RIGHT': 50 };
    return 207 + lineOffsets[this.line];  // Center = 207px
  }
}
```

### 7.7 Audio Synthesis

#### Web Audio API Implementation
```javascript
class SoundManager {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterVolume = this.audioContext.createGain();
    this.masterVolume.connect(this.audioContext.destination);
  }

  playBowlSound() {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.masterVolume);

    gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0, this.audioContext.currentTime + 0.5);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.5);
  }

  playBatHitSound() {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    // Dual-frequency for "thwack"
    const osc2 = this.audioContext.createOscillator();

    osc.frequency.value = 150;
    osc2.frequency.value = 800;

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterVolume);

    gain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0, this.audioContext.currentTime + 0.2);

    osc.start();
    osc2.start();
    osc.stop(this.audioContext.currentTime + 0.2);
    osc2.stop(this.audioContext.currentTime + 0.2);
  }

  playSixSound() {
    // Ascending chord: C5, E5, G5
    const frequencies = [523.25, 659.25, 783.99];

    for (let freq of frequencies) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(this.masterVolume);

      gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0, this.audioContext.currentTime + 1);

      osc.start();
      osc.stop(this.audioContext.currentTime + 1);
    }
  }

  playWicketSound() {
    // Descending notes: G3, D3, G2
    const notes = [196, 146.83, 98];

    for (let i = 0; i < notes.length; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.frequency.value = notes[i];
      osc.connect(gain);
      gain.connect(this.masterVolume);

      const time = this.audioContext.currentTime + (i * 0.15);
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0, time + 0.4);

      osc.start(time);
      osc.stop(time + 0.4);
    }
  }
}
```

#### Audio Configuration
```javascript
const audioConfig = {
  enabled: true,
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  soundEffects: {
    'bowl': { gain: 0.3, duration: 0.5 },
    'bat_hit': { gain: 0.4, duration: 0.2 },
    'four': { gain: 0.25, duration: 1.0 },
    'six': { gain: 0.3, duration: 1.0 },
    'wicket': { gain: 0.35, duration: 1.2 },
    'crowd_cheer': { gain: 0.4, duration: 2.0 },
  },
};
```

---

## 8. UX/UI DESIGN

### 8.1 Information Architecture

#### Screen Hierarchy
```
Root
├─ Home Screen (Main Menu)
│  ├─ Start Match Button
│  ├─ Profile Summary
│  ├─ Daily Reward Claim
│  ├─ Shop Access
│  ├─ Leaderboard
│  └─ Settings
├─ Match Screen (Gameplay)
│  ├─ Score Display (Top)
│  ├─ Wickets Counter
│  ├─ Ball Indicator
│  ├─ Timing Indicator
│  ├─ Power Meter
│  └─ Canvas (Main Gameplay Area)
├─ Match Result Screen
│  ├─ Final Score
│  ├─ XP Earned
│  ├─ Coins Earned
│  ├─ Stats Summary
│  └─ Next Match / Main Menu
├─ Shop Screen
│  ├─ Cosmetics Tab
│  ├─ Power-ups Tab
│  ├─ VIP Tab
│  └─ Coin Purchase (Superwall)
├─ Profile / Stats Screen
│  ├─ Level & XP Progress
│  ├─ Career Stats
│  ├─ Achievements
│  └─ Inventory
└─ Settings
   ├─ Sound & Vibration
   ├─ Difficulty
   ├─ Claude API Key (optional)
   └─ Privacy & Account
```

### 8.2 Visual Design System

#### Color Palette
```javascript
const colors = {
  primary: "#2ECC71",      // Cricket green
  secondary: "#3498DB",    // Sky blue
  accent: "#F39C12",       // Gold (achievements)
  danger: "#E74C3C",       // Red (wickets)
  background: "#1A1A1A",   // Dark background
  text: "#FFFFFF",         // White text
  textSecondary: "#B8B8B8",// Light gray

  // Surge tiers
  surge: {
    BOOST: "#00D4FF",      // Cyan
    HYPER: "#FF00FF",      // Magenta
    ULTRA: "#FFD700",      // Gold
    LEGEND: "#FF6B6B",     // Red
  },

  // UI States
  disabled: "#666666",
  hover: "#34495E",
  active: "#2ECC71",
};
```

#### Typography
```javascript
const fonts = {
  primary: "Arial, sans-serif",
  monospace: "Courier New, monospace",

  sizes: {
    h1: 36,
    h2: 28,
    h3: 24,
    body: 16,
    small: 14,
    xs: 12,
  },

  weights: {
    light: 300,
    regular: 400,
    bold: 700,
  },
};
```

### 8.3 Key Screens

#### Home Screen
```
┌─────────────────────────────┐
│         CrickBot 2026       │
│         Level 42            │
├─────────────────────────────┤
│  [START MATCH] [PROFILE]    │
├─────────────────────────────┤
│  Daily Reward               │
│  ▸ Claim 87 Coins (12h)    │
├─────────────────────────────┤
│  Latest Stats               │
│  W/L: 187/213 | Streak: 8   │
│  Best Score: 287            │
├─────────────────────────────┤
│  [SHOP] [LEADERBOARD]       │
│  [SETTINGS] [ACHIEVEMENTS]  │
└─────────────────────────────┘
```

#### Match Screen (In-Game)
```
┌─────────────────────────────┐
│  Score: 87 | Wickets: 2/3   │
├─────────────────────────────┤
│                             │
│         [Canvas]            │
│       Stadium View          │
│      Ball + Bowler          │
│                             │
├─────────────────────────────┤
│  Delivery: Fast, Good, Ctr  │
│  [━━━━━━━━] Power Meter     │
│  Timing: [Good (700px)]     │
├─────────────────────────────┤
│  Swipe to bat               │
│  (Angle = Shot, Length = Pw)│
└─────────────────────────────┘
```

#### Match Result Screen
```
┌─────────────────────────────┐
│      MATCH RESULT           │
│      Victory!               │
├─────────────────────────────┤
│  Final Score: 127           │
│  Runs: 6 × 4s, 2 × 6s       │
│  Wickets: 1                 │
├─────────────────────────────┤
│  XP Earned: 485 (1.2x Bonus)│
│  Coins Earned: 56           │
│  Surge Bonus: +20 coins     │
├─────────────────────────────┤
│  New Level: 43              │
│  Progress: ████░ (60%)      │
├─────────────────────────────┤
│  [NEXT MATCH] [HOME]        │
└─────────────────────────────┘
```

### 8.4 Gesture & Interaction Feedback

#### Touch Feedback
- **Swipe Start:** Subtle haptic pulse + visual indicator on bat
- **Swipe Progress:** Trail visualization of swipe path
- **Shot Execution:** Screen flash + particle effects based on result
- **Timing Perfect:** Golden glow overlay + celebratory particle burst
- **Wicket:** Red flash + desaturated screen momentarily

#### Visual Feedback Timing
```javascript
const feedback = {
  perfectTiming: {
    duration: 0.4,
    effects: ['goldGlow', 'confetti', 'screenFlash'],
    sfx: 'success_chime',
  },
  goodTiming: {
    duration: 0.2,
    effects: ['greenBorder'],
    sfx: 'tick',
  },
  badTiming: {
    duration: 0.3,
    effects: ['redBorder', 'shake'],
    sfx: 'miss',
  },
  wicket: {
    duration: 0.6,
    effects: ['redFlash', 'stumpsBreak', 'desaturate'],
    sfx: 'wicket_sound',
  },
};
```

### 8.5 Accessibility

#### Accessibility Features
- **Color Contrast:** WCAG AA compliance (4.5:1 for text)
- **Touch Targets:** Minimum 44×44px for buttons
- **Motion:** Respects prefers-reduced-motion setting
- **Haptics:** Disabled if device doesn't support
- **Screen Reader:** Basic semantic HTML, ARIA labels for critical UI
- **Text Sizing:** Respects system font size (up to 1.5x)

---

## 9. AUDIO DESIGN

### 9.1 Audio Philosophy
Immersive, atmospheric soundscape with synthesized effects (no external files). Adaptive audio responds to gameplay state and surge levels.

### 9.2 Sound Effects Library

#### Synthesis Parameters
```javascript
const soundLibrary = {

  // DELIVERY SOUNDS
  bowl: {
    oscillator: 'sine',
    frequency: [200, 600],  // Sweep upward
    duration: 0.5,
    gain: 0.3,
    envelope: 'linear_up',
  },

  // IMPACT SOUNDS
  batHit: {
    oscillators: [
      { freq: 150, duration: 0.1, gain: 0.3 },
      { freq: 800, duration: 0.1, gain: 0.2 },
    ],
    envelope: 'exponential_down',
  },

  // BOUNDARY SOUNDS
  four: {
    notes: [523.25, 659.25, 783.99],  // C5, E5, G5
    duration: 0.3,
    spacing: 0.1,
    gain: 0.25,
  },

  six: {
    notes: [523.25, 659.25, 783.99, 1046.50],  // C5, E5, G5, C6
    duration: 0.4,
    spacing: 0.15,
    gain: 0.3,
  },

  // DISMISSAL SOUNDS
  wicket: {
    notes: [196, 146.83, 98],  // G3, D3, G2
    duration: 0.4,
    spacing: 0.15,
    gain: 0.35,
    envelope: 'exponential_down',
  },

  // CROWD SOUNDS
  crowdCheer: {
    oscillator: 'sine',
    frequency: [300, 400, 500],  // Upward pitch sweep
    duration: 2,
    gain: 0.4,
    lfo: { freq: 5, depth: 50 },  // Modulation for crowd effect
  },

  // UI SOUNDS
  uiTap: {
    oscillator: 'sine',
    frequency: 1000,
    duration: 0.15,
    gain: 0.2,
  },

  levelUp: {
    notes: [523.25, 659.25, 783.99, 1046.50],
    duration: 0.3,
    spacing: 0.1,
    gain: 0.3,
  },
};
```

### 9.3 Adaptive Audio

#### Surge-Based Audio Changes
```javascript
class AdaptiveAudioManager extends SoundManager {

  updateForSurge(surgeLevel) {
    // Increase pitch of hit sounds with surge
    this.hitPitchMultiplier = 1.0 + (surgeLevel * 0.1);

    // Add echo/reverb effect for ULTRA+ surges
    if (surgeLevel >= 3) {
      this.enableReverb(0.3);
    } else {
      this.disableReverb();
    }

    // Crowd intensity increases with surge
    this.crowdVolume = 0.2 + (surgeLevel * 0.15);
  }

  playHitSound(quality) {
    const freq = 150 * this.hitPitchMultiplier;
    const duration = quality === 'perfect' ? 0.3 : 0.2;
    this.playOscillator(freq, duration, 0.4);
  }
}
```

### 9.4 Audio Settings & Customization

#### User Audio Preferences
```javascript
const audioPreferences = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  vibrationEnabled: true,
  adaptiveAudio: true,  // Enable surge-based pitch shifts
  commentaryEnabled: false,  // Optional Claude API audio
  crowdIntensity: 'high',  // low, medium, high
};
```

---

## 10. MULTIPLAYER SYSTEM

### 10.1 Architecture

#### Convex Backend Integration
```javascript
// Real-time multiplayer via Convex
const multiplayerConfig = {
  backend: 'Convex',
  matchType: 'setter_vs_chaser',
  roomLifetime: 3600,  // 1 hour
  latencyTarget: 100,  // 100ms RTT
  timeoutThreshold: 5000,  // Disconnect after 5s inactivity
};
```

### 10.2 Match Format: Setter vs. Chaser

#### Phase 1: Setter Inning
```
1. Player A (Setter) faces 12 deliveries
2. Score recorded (target for Chaser)
3. Match stats snapshot
```

#### Phase 2: Chaser Inning
```
1. Player B (Chaser) faces 12 deliveries
2. Attempts to meet/exceed Setter's score
3. Victory determined by final score comparison
```

### 10.3 Matchmaking

#### Room-Based Queue
```javascript
class MatchmakingQueue {

  async findMatch(player) {
    const compatibleRooms = this.rooms.filter(room =>
      room.playerCount < 2 &&
      Math.abs(room.avgLevel - player.level) <= 5
    );

    if (compatibleRooms.length > 0) {
      const room = compatibleRooms[0];
      room.addPlayer(player);
      if (room.playerCount === 2) {
        room.startMatch();
      }
      return room;
    } else {
      // Create new room
      const newRoom = new Room(player);
      this.rooms.push(newRoom);
      return newRoom;
    }
  }

  timeoutWaitingPlayers() {
    // After 30 seconds, start match vs. AI
    for (let room of this.rooms) {
      if (room.playerCount === 1 &&
          Date.now() - room.createdAt > 30000) {
        room.addAIOpponent();
        room.startMatch();
      }
    }
  }
}
```

### 10.4 Leaderboards

#### Global Leaderboard
```javascript
const leaderboardConfig = {
  updateFrequency: 3600,  // 1 hour
  topPlayers: 100,
  scoringMetric: 'elo',

  eloCalculation: {
    k: 32,
    ratingChange(playerElo, opponentElo, result) {
      const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
      return this.k * (result - expected);
    },
  },
};
```

#### Leaderboard Queries
```
1. Global Leaderboard (all players)
2. Friend Leaderboard (connected players)
3. Stadium Leaderboard (per-venue high scores)
4. Weekly Challenge (seasonal events)
```

### 10.5 Social Features

#### Friend Integration
```javascript
const socialFeatures = {
  addFriend: async (userId, friendId) => {
    await convex.mutation('friends/add', { userId, friendId });
  },

  viewFriendStats: async (friendId) => {
    return await convex.query('friends/getStats', { friendId });
  },

  challengeFriend: async (challengerId, friendId) => {
    const match = await convex.mutation('matches/createChallenge', {
      challenger: challengerId,
      opponent: friendId,
      expiryTime: Date.now() + 86400000,  // 24h timeout
    });
    return match;
  },

  viewMatchHistory: async (userId, limit = 10) => {
    return await convex.query('matches/getHistory', { userId, limit });
  },
};
```

---

## 11. ANALYTICS & METRICS

### 11.1 Key Performance Indicators (KPIs)

#### User Acquisition & Retention
```javascript
const acquisitionMetrics = {
  totalInstalls: 0,
  dau: 0,  // Daily Active Users
  mau: 0,  // Monthly Active Users
  wau: 0,  // Weekly Active Users
  d1Retention: 0.65,  // Target: >50%
  d7Retention: 0.35,  // Target: >25%
  d30Retention: 0.20,  // Target: >15%
  averageSessionLength: 180,  // seconds, Target: >120s
  sessionsPerDay: 2.5,  // Target: >2
};
```

#### Progression Metrics
```javascript
const progressionMetrics = {
  averageLevelReached: 25,  // Cohort average
  levelCompletionRate: {
    level_10: 0.80,
    level_25: 0.60,
    level_50: 0.30,
    level_100: 0.05,
  },
  averagePlaytimeToLevel: {
    10: 45,  // minutes
    25: 180,
    50: 600,
    100: 2400,
  },
  abandonmentPoints: [
    { level: 25, rate: 0.20 },  // 20% quit at boss level
    { level: 50, rate: 0.30 },
    { level: 75, rate: 0.40 },
  ],
};
```

#### Monetization Metrics
```javascript
const monetizationMetrics = {
  dau_payers: 0,
  conversionRate: 0.03,  // Target: 2-5%
  arpu: 0.08,  // Average Revenue Per User (Target: $0.05-0.10)
  arppu: 0.60,  // Average Revenue Per Paying User (Target: $0.50-1.50)
  ltv: 0.50,  // Lifetime Value

  purchaseFrequency: {
    starterPack: 0.40,  // % of paying users
    valuePack: 0.35,
    superPack: 0.15,
    vipPass: 0.10,
    powerUps: 0.50,
  },

  cohortRetentionByPaymentStatus: {
    payers_d1: 0.85,
    nonPayers_d1: 0.60,
    payers_d30: 0.40,
    nonPayers_d30: 0.15,
  },
};
```

#### Engagement Metrics
```javascript
const engagementMetrics = {
  matchCompletionRate: 0.95,  // % of matches finished
  avgMatchDuration: 240,  // seconds
  surgeActivationRate: 0.65,  // % of matches reach BOOST+
  averageSurgeLevel: 1.8,  // 1-4 scale
  powerUpUsageRate: 0.25,  // % of players who buy power-ups
  cosmetics_owned: 3.2,  // Average per player

  dailyChallengeTakeRate: 0.40,
  multiplayerEngagement: 0.15,  // % of players who play multiplayer
};
```

### 11.2 Tracking Implementation

#### Event Schema
```javascript
const eventSchema = {
  eventType: 'match_completed',
  userId: 'uuid',
  timestamp: 1711814400000,
  sessionId: 'uuid',

  // Match-specific
  level: 42,
  stadium: 'MCG',
  difficulty: 'Pro',

  // Result
  playerScore: 127,
  aiScore: 95,
  result: 'win',  // 'win' | 'loss'

  // Engagement
  surgeLevel: 2,  // Final surge tier reached
  consecutiveGoodHits: 8,
  wicketsLost: 1,
  shotsMade: 12,

  // Progression
  xpEarned: 485,
  coinsEarned: 56,
  leveledUp: true,
  newLevel: 43,

  // Monetization
  powerUpUsed: 'scoreBoost',
  cosmetic: 'Gold Leather',

  // Duration
  matchDuration: 240,  // seconds
};

// Send to analytics backend
analytics.track(eventSchema);
```

#### Cohort Analysis
```
Cohort A (Day 0-7): Focus on onboarding metrics
├─ Tutorial completion rate
├─ First match result
└─ Initial level reached

Cohort B (Day 8-30): Focus on retention & engagement
├─ Average level progression
├─ Daily match count
└─ Power-up adoption

Cohort C (Day 31+): Focus on monetization
├─ Conversion rate
├─ Average spend
└─ Long-term retention
```

### 11.3 A/B Testing Framework

#### Testable Variables
```javascript
const abTestConfig = {

  // Difficulty balance testing
  test_1: {
    name: 'AI Aggression Level',
    variant_a: { aggression: 0.5 },
    variant_b: { aggression: 0.6 },
    metric: 'd7Retention',
    sampleSize: 1000,
  },

  // Monetization testing
  test_2: {
    name: 'VIP Pass Price',
    variant_a: { price: '$0.99/yr' },
    variant_b: { price: '$1.99/yr' },
    metric: 'conversionRate',
    sampleSize: 5000,
  },

  // Progression testing
  test_3: {
    name: 'XP Multiplier at Level 50',
    variant_a: { multiplier: 1.0 },
    variant_b: { multiplier: 1.2 },
    metric: 'levelCompletionRate',
    sampleSize: 2000,
  },
};
```

---

## 12. DEVELOPMENT ROADMAP

### 12.1 Phase 1: MVP (Months 1-2)
- Core gameplay loop (swipe detection, ball system, scoring)
- Single-player campaign (Levels 1-25)
- Basic AI (Phase 1 rule-based)
- Shop system (cosmetics only)
- iOS/PWA build

### 12.2 Phase 2: Expansion (Months 3-4)
- Full campaign (100 levels)
- AI Phase 2 (behavior modeling)
- Multiplayer backend (Convex integration)
- Power-ups system
- Advanced audio (synthesized effects)

### 12.3 Phase 3: Monetization & Optimization (Months 5-6)
- Superwall IAP integration
- VIP pass system
- AI Phase 3 (Bayesian prediction)
- Performance optimization (target 60 FPS)
- Analytics dashboard

### 12.4 Phase 4: Live Ops & Polish (Months 7+)
- AI Phase 4 (Claude API commentary)
- Seasonal events & challenges
- Leaderboard polish
- Community features (friends, replays)
- Continuous balance updates

---

## APPENDIX

### A. Glossary
- **Bowler:** AI opponent who delivers the ball
- **Batsman:** Player character
- **Wicket:** Loss condition; dismissal
- **Dot Ball:** 0 runs scored
- **Boundary:** 4 or 6 runs (hit to edge of field)
- **Surge:** Momentum system that multiplies runs (BOOST → LEGEND)
- **Convex:** Real-time backend for multiplayer sync
- **DPI-Aware:** Canvas scaling for high-resolution displays

### B. References
- Cricket rules: ICC Laws of Cricket
- UI/UX: Material Design 3, iOS HIG
- Performance: MDN Web Performance Guide
- Audio: Web Audio API Spec

### C. Future Enhancements (Post-Launch)
- IPL-licensed teams & players
- Broadcast-style replays (slow-motion review)
- Voice commentary via TTS
- VR/AR cricket batting experience
- Cross-platform cloud saves (Google Play Games, iCloud)
- Esports tournament mode
- Spectator mode for multiplayer matches

---

**Document Status:** Production-Ready for Development Team
**Next Review Date:** June 30, 2026
**Document Owner:** Product Analyst Team

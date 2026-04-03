# Game Deployment Playbook

## Overview
This playbook guides you through launching any game from concept to App Store in 7 days. It's designed to be executed sequentially, with each phase building on the previous one. Estimated timeline is realistic and achievable with minimal scope creep.

**Total Timeline: 7 Days**
- Phase 1: Game Development (Days 1-3)
- Phase 2: Backend Setup (Day 4)
- Phase 3: Native Wrapping (Day 5)
- Phase 4: Pre-Launch (Day 6)
- Phase 5: Deployment (Day 7)
- Phase 6: Post-Launch (Ongoing)

---

## Prerequisites (Before Day 1)

Before starting, ensure you have:

```bash
# Required Accounts
- Apple Developer Account ($99/year, needed for iOS builds)
- Google Play Developer Account ($25/year, needed for Android)
- Expo Account (free at expo.dev)
- Superwall Account (free for development)
- Convex Account (free tier available)
- GitHub Account (for CI/CD)

# Required Software
- Node.js 18+ (https://nodejs.org)
- Expo CLI: npm install -g expo-cli
- EAS CLI: npm install -g eas-cli
- Xcode 14+ (macOS only, for iOS builds)
- Android Studio (for Android emulator)
- Git

# Verification Commands
node --version          # Should be 18+
npm --version
expo --version
eas --version
git --version
```

---

## Phase 1: Game Development (Days 1-3)

### Day 1: Create Game Using AI + Framework

**Goal:** Generate complete, working game HTML using the reusable framework

#### Step 1.1: Fill Game Creation Prompt Template
```bash
# Open the template
cat /sessions/eager-zen-mccarthy/mnt/07_Cluade_Code_folder/08_Game_Ecosystem/10_Templates/GAME_CREATION_PROMPT.md

# Copy the entire template and fill in all [FILL] sections with your game specs
# Reference the Tennis example section to see how to fill it properly
```

**What to Fill:**
- Game Title, Concept, and 1-sentence pitch
- Sport rules and win/lose conditions
- Core mechanics (3-5 mechanics, 1-2 special moves)
- Physics parameters (gravity, friction, bounce, speeds)
- AI difficulty levels (Easy, Medium, Hard with specific values)
- Progression design (unlocks, cosmetics, challenges)
- Monetization (IAP catalog with exact product IDs)
- UI theme (colors, fonts, sounds)

**Expected Time:** 2-3 hours

#### Step 1.2: Generate Game HTML with Claude

```
# Once filled, paste entire prompt to Claude with this preamble:

You are an expert game developer. Using the Reusable Game Framework,
create a production-ready HTML5 Canvas game based on the specification below.

The game must:
1. Run immediately in any modern browser at 60 FPS
2. Work on mobile (414×896) and desktop
3. Include all requested features: AI, progression, monetization
4. Export game state to localStorage
5. Export game events to Convex backend (HTTP client)
6. Include proper error handling and logging

Generate a complete game.html file (~700 lines) that imports framework modules
and implements all mechanics. Include a // TODO marker for any section
that requires sport-specific customization.

[PASTE YOUR FILLED TEMPLATE HERE]

Expected output:
- Complete game.html file (ready to run)
- Integration checklist (what modules are used)
- List of required Superwall product IDs (for payments.js)
- Instructions for Expo wrapper integration
```

**Expected Output from Claude:**
- Complete, commented game.html (~700 lines)
- Setup checklist
- Superwall product ID mapping
- Expo wrapper configuration notes

**Time:** 1-2 hours for Claude to generate + 30 min review

#### Step 1.3: Save Generated Game

```bash
# Create game directory
mkdir -p ~/myGame
cd ~/myGame

# Save the Claude-generated game.html
# Copy and paste into: ~/myGame/game.html

# Verify it loads in browser
python3 -m http.server 8000
# Open http://localhost:8000/game.html in browser
```

**Verification Checklist:**
- [ ] Game loads without errors
- [ ] 60 FPS stable (check debug panel: press 'D')
- [ ] Menu screen renders correctly
- [ ] Start Game button works
- [ ] Game loop runs
- [ ] Game Over screen appears
- [ ] Replay button functional
- [ ] Return to Menu works

**Time:** 30 min

---

### Day 2: Customize & Test Game

**Goal:** Implement sport-specific logic, test gameplay, balance difficulty

#### Step 2.1: Implement Sport-Specific Physics

The generated game.html has placeholders marked with `// TODO`. Implement these:

```javascript
// In game-template.html, find and fill these sections:

// TODO: Sport-specific object initialization
// Example for tennis:
const ball = {
    x: canvasWidth / 2,
    y: canvasHeight / 2,
    vx: 0,
    vy: 0,
    radius: 8,
    color: '#ffeb3b',
};

// TODO: Ball physics update (in fixedUpdate)
function updateBallPhysics(dt) {
    // Apply gravity
    ball.vy += physicsConfig.gravity;

    // Update position
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Court boundaries
    if (ball.x < physicsConfig.courtX || ball.x > physicsConfig.courtX + physicsConfig.courtWidth) {
        ball.vx *= -1; // Bounce left/right
    }
    if (ball.y < physicsConfig.courtY) {
        ball.vy *= -1; // Bounce top
        opponentScores();
    }
}

// TODO: Sport-specific collision detection
function checkCollisions() {
    // Ball vs. player paddle
    if (distance(ball, gameState.player) < ball.radius + 20) {
        ball.vy *= -1;
        ball.vx = (ball.x - gameState.player.x) * 0.1;
    }

    // Ball vs. opponent
    if (distance(ball, gameState.opponent) < ball.radius + 20) {
        ball.vy *= -1;
        ball.vx = (ball.x - gameState.opponent.x) * 0.1;
        gameState.score++;
    }
}

// TODO: AI opponent behavior
function aiStep() {
    // Predict ball trajectory
    const predictedX = predictBallX();

    // Move AI towards predicted position
    if (gameState.opponent.x < predictedX - 5) {
        gameState.opponent.x += physicsConfig.playerSpeed;
    } else if (gameState.opponent.x > predictedX + 5) {
        gameState.opponent.x -= physicsConfig.playerSpeed;
    }

    // Apply accuracy modifier based on difficulty
    if (Math.random() > aiConfig.accuracy) {
        gameState.opponent.x += (Math.random() - 0.5) * 20;
    }
}
```

**Time:** 2-3 hours

#### Step 2.2: Implement Input Handlers

Fill in the input handler placeholders:

```javascript
// TODO: Implement sport-specific input handlers

function handleGameInput(input) {
    // Called when touch/mouse starts
    // For tennis: show power meter
    console.log(`Swing prepared at power ${Math.round(Date.now() % 100)}%`);
}

function handleGameInputRelease(input) {
    // Called when touch/mouse releases
    // For tennis: execute shot
    const power = Math.min(1.0, input.touchDuration / 500);
    const angle = (input.dragDeltaY / 100) * Math.PI * 0.5; // -45 to +45 degrees

    executeShot(power, angle);
}

function executeShot(power, angle) {
    // Calculate ball velocity based on power and angle
    const maxSpeed = physicsConfig.maxSpeed * power;
    ball.vx = Math.sin(angle) * maxSpeed;
    ball.vy = -Math.cos(angle) * maxSpeed;
}
```

**Time:** 1 hour

#### Step 2.3: Test Gameplay

```bash
# Run local server
python3 -m http.server 8000

# Open game in browser
# http://localhost:8000/game.html

# Test checklist:
# [ ] Play 10 rounds, check win/loss logic
# [ ] Test AI on Easy, Medium, Hard difficulties
# [ ] Verify score increments correctly
# [ ] Check game timer (should end at max time)
# [ ] Verify difficulty adapts after wins/losses
# [ ] Test cosmetics switching (colors, themes)
# [ ] Check localStorage persistence (reload page, stats persist)
# [ ] Test performance on mobile browser (use Chrome DevTools phone emulation)
```

**Performance Targets:**
- [ ] Consistent 60 FPS (check with Debug Panel: press 'D')
- [ ] Game loop update time < 16ms
- [ ] No memory leaks (check DevTools Memory)
- [ ] Smooth animations (no jank)

**Time:** 2 hours

#### Step 2.4: Balance Difficulty

Adjust these values until gameplay feels good:

```javascript
const aiConfig = {
    // Tweak these based on testing
    difficulty: 'medium',
    reactionTime: 300,    // Lower = faster AI
    accuracy: 0.75,       // Higher = better accuracy
    positioningSkill: 0.7, // Predictive movement
};

const physicsConfig = {
    gravity: 0.6,         // Adjust ball fall speed
    bounce: 0.85,         // Adjust ball bounciness
    maxSpeed: 12,         // Adjust max ball speed
    playerSpeed: 6,       // Adjust player movement speed
};
```

**Testing Framework:**
- Easy Mode: Should win 80-90% of games
- Medium Mode: Should win 40-60% of games
- Hard Mode: Should win 10-30% of games

If not achieving these ratios, adjust AI accuracy and reaction time.

**Time:** 1 hour

**Day 2 Total: ~6 hours**

---

### Day 3: Polish & Analytics Setup

**Goal:** Add sound effects, animations, analytics tracking, final testing

#### Step 3.1: Add Web Audio

```javascript
// In game-template.html, implement Web Audio in audio.js import section

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Sound effect generator
function playSound(frequency, duration, volume = 0.3) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duration);
}

// Sound event handlers
document.addEventListener('shot', () => playSound(440, 0.1)); // Tennis shot
document.addEventListener('score', () => playSound(523, 0.2)); // Point scored
document.addEventListener('win', () => playSound(800, 0.5));  // Game won
```

**Time:** 1 hour

#### Step 3.2: Implement Analytics

```javascript
// Track game events

function trackGameStart() {
    // Send to Convex or analytics service
    analytics.track('game_started', {
        difficulty: gameState.stats.currentDifficulty,
        timestamp: new Date().toISOString(),
    });
}

function trackGameEnd() {
    analytics.track('game_ended', {
        score: gameState.score,
        opponentScore: gameState.opponentScore,
        duration: gameState.gameTime,
        result: gameState.score > gameState.opponentScore ? 'win' : 'loss',
        difficulty: gameState.stats.currentDifficulty,
    });
}

function trackAchievement(achievementId) {
    analytics.track('achievement_unlocked', {
        achievementId: achievementId,
        timestamp: new Date().toISOString(),
    });
}

function trackPurchase(productId) {
    analytics.track('product_purchased', {
        productId: productId,
        price: getProduct(productId).price,
        currency: 'USD',
    });
}
```

**Time:** 30 min

#### Step 3.3: Integration Testing

```bash
# Full integration test checklist:

# [ ] Game loads correctly
# [ ] All game screens functional (menu, game, shop, gameover)
# [ ] AI difficulty adapts based on performance
# [ ] Stats persist across sessions (localStorage)
# [ ] Cosmetics apply correctly
# [ ] Sound effects play on events
# [ ] No console errors
# [ ] Touch input responsive on phone
# [ ] Game works on iOS Safari (test with iPhone)
# [ ] Game works on Android Chrome
# [ ] Works on desktop browsers (Chrome, Firefox, Safari)

# Performance check
# [ ] Average FPS: 58-60 on mobile
# [ ] No frame drops during gameplay
# [ ] Memory usage stable (no leaks)
```

**Time:** 2 hours

#### Step 3.4: Final Code Review

```bash
# Verify all TODO sections are filled in:
grep -n "TODO:" game.html | head -20

# Should show zero remaining TODOs (or only optional ones)

# Run ESLint if available:
npx eslint game.html --no-eslintrc --parser-options=ecmaVersion:2020

# Fix any linting errors
```

**Time:** 30 min

**Day 3 Total: ~4 hours**

**Phase 1 Total: 3 days, ~14 hours**

---

## Phase 2: Backend Setup (Day 4)

**Goal:** Deploy Convex schema, configure multiplayer (if needed), set up leaderboards

### Day 4: Backend Initialization

#### Step 4.1: Initialize Convex Project

```bash
# In your project directory
npm install convex

# Initialize Convex
npx convex dev

# This will:
# 1. Create convex/ folder
# 2. Create convex.json
# 3. Set up local development
# 4. Output your deployment URL
```

**Expected Output:**
```
Convex is running at http://127.0.0.1:3210
```

#### Step 4.2: Create Game Results Schema

Create `convex/gameResults.js`:

```javascript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Submit a game result
export const submitGameResult = mutation({
  args: {
    userId: v.string(),
    score: v.number(),
    opponentScore: v.number(),
    duration: v.number(),
    difficulty: v.string(),
  },
  handler: async (ctx, args) => {
    const resultId = await ctx.db.insert("gameResults", {
      userId: args.userId,
      score: args.score,
      opponentScore: args.opponentScore,
      duration: args.duration,
      difficulty: args.difficulty,
      won: args.score > args.opponentScore,
      timestamp: Date.now(),
    });

    // Update leaderboard
    await updateLeaderboard(ctx, args.userId, args.score);

    return resultId;
  },
});

// Get user's game history
export const getUserHistory = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gameResults")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .order("timestamp", "desc")
      .take(100);
  },
});

// Get global leaderboard
export const getLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leaderboard")
      .order("score", "desc")
      .take(args.limit || 100);
  },
});

// Helper function
async function updateLeaderboard(ctx, userId, score) {
  const existing = await ctx.db
    .query("leaderboard")
    .filter((q) => q.eq(q.field("userId"), userId))
    .first();

  if (existing) {
    if (score > existing.score) {
      await ctx.db.patch(existing._id, {
        score: score,
        gamesPlayed: existing.gamesPlayed + 1,
      });
    }
  } else {
    await ctx.db.insert("leaderboard", {
      userId: userId,
      score: score,
      gamesPlayed: 1,
    });
  }
}
```

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  gameResults: defineTable({
    userId: v.string(),
    score: v.number(),
    opponentScore: v.number(),
    duration: v.number(),
    difficulty: v.string(),
    won: v.boolean(),
    timestamp: v.number(),
  }).index("by_user", ["userId"]),

  leaderboard: defineTable({
    userId: v.string(),
    score: v.number(),
    gamesPlayed: v.number(),
  }).index("by_score", ["score"]),

  users: defineTable({
    externalId: v.string(),
    coins: v.number(),
    gems: v.number(),
    purchasedProducts: v.array(v.string()),
  }).index("by_external_id", ["externalId"]),
});
```

**Time:** 1 hour

#### Step 4.3: Deploy to Convex Cloud

```bash
# Authenticate with Convex
npx convex auth

# Deploy
npx convex deploy

# This will output your production URL:
# https://your-project.convex.cloud
```

**Time:** 30 min

#### Step 4.4: Update Game to Use Backend

In `game-template.html`, update the backend integration section:

```javascript
// SECTION 13: Backend Integration (Convex)

const convexUrl = 'https://your-project.convex.cloud';

async function sendGameResultToBackend(userId) {
    const result = {
        userId: userId,
        score: gameState.score,
        opponentScore: gameState.opponentScore,
        duration: gameState.gameTime,
        difficulty: gameState.stats.currentDifficulty,
    };

    try {
        const response = await fetch(`${convexUrl}/submitGameResult`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
        });

        const data = await response.json();
        console.log('Game result submitted:', data);
        return data;
    } catch (error) {
        console.error('Error submitting game result:', error);
    }
}

// Call this in endGame():
// sendGameResultToBackend(getUserId());
```

**Time:** 30 min

#### Step 4.5: Test Backend

```bash
# Start Convex dev server
npx convex dev

# Test with curl
curl -X POST http://127.0.0.1:3210/submitGameResult \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-1",
    "score": 11,
    "opponentScore": 8,
    "duration": 45,
    "difficulty": "medium"
  }'

# Should return: { "success": true }

# Query results
curl http://127.0.0.1:3210/getUserHistory?userId=test-user-1

# Query leaderboard
curl http://127.0.0.1:3210/getLeaderboard?limit=10
```

**Time:** 30 min

**Phase 2 Total: 1 day, ~3 hours**

---

## Phase 3: Native Wrapping (Day 5)

**Goal:** Wrap game in Expo, configure for iOS/Android, test in simulator

### Day 5: Native Build Setup

#### Step 5.1: Initialize Expo Project

```bash
# Create Expo project
npx create-expo-app MyGame

cd MyGame

# Install dependencies from template
npm install react-native-webview
npm install expo-splash-screen expo-font
npm install @superwall/react-native-superwall  # Optional: for payments

# Copy Expo wrapper template
cp -r /path/to/expo-wrapper-template/* .
```

**Expected Structure:**
```
MyGame/
├── App.js                 (Wrapper - copy from template)
├── app.json               (Config - customize with your app name)
├── package.json           (Dependencies)
├── assets/
│   ├── icon.png           (App icon, 1024x1024)
│   ├── splash.png         (Splash screen, 1024x1024)
│   └── adaptive-icon.png  (Android adaptive icon)
├── src/
│   └── payments.js        (Superwall config - copy from template)
└── game.html              (Your generated game)
```

**Time:** 30 min

#### Step 5.2: Configure app.json

Edit `app.json` and replace all {{PLACEHOLDERS}}:

```json
{
  "expo": {
    "name": "Tennis Ace",
    "slug": "tennis-ace",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourcompany.tennisace"
    },
    "android": {
      "package": "com.yourcompany.tennisace"
    }
  }
}
```

**Required IDs:**
- Bundle ID (iOS): `com.yourcompany.gamename`
- Package name (Android): `com.yourcompany.gamename`
- Expo Project ID: Get from `expo.dev` (free tier)

**Time:** 30 min

#### Step 5.3: Configure Payment Products

Edit `src/payments.js` and replace Superwall product IDs:

```javascript
// Get your product IDs from Superwall dashboard:
// https://dashboard.superwall.com/products

export const PaymentProducts = {
    COSMETICS: {
        PADDLE_GOLD: {
            id: 'com.yourcompany.tennisace.paddle_gold',  // From Superwall
            // ... rest of config
        },
        // ... more products
    },
};
```

**Time:** 1 hour

#### Step 5.4: Add App Icons

Create app icons and place in `assets/`:

```bash
# Option A: Generate online
# https://appicon.co/
# Upload 1024x1024 PNG, download all sizes

# Option B: Use your own
# Required sizes:
# - icon.png: 1024x1024 (app icon)
# - splash.png: 1024x1024 (splash screen)
# - adaptive-icon.png: 1024x1024 (Android)

# Verify they exist
ls -la assets/
# icon.png, splash.png, adaptive-icon.png should all exist
```

**Time:** 30 min

#### Step 5.5: Test in iOS Simulator (macOS only)

```bash
# Start Expo dev server
npm start

# Press 'i' for iOS simulator (requires Xcode)
# Or open the iOS build in Xcode:
npx expo run:ios

# Check that:
# [ ] App loads in simulator
# [ ] Game HTML renders
# [ ] Touch input works
# [ ] No console errors
```

**Time:** 1 hour

#### Step 5.6: Test in Android Emulator

```bash
# Start Expo dev server
npm start

# Press 'a' for Android
# Or run:
npx expo run:android

# Check that:
# [ ] App loads in emulator
# [ ] Game HTML renders
# [ ] Touch input works
# [ ] No console errors
```

**Time:** 1 hour

#### Step 5.7: Build for Physical Device

```bash
# Build for iOS
npm run build:ios

# Build for Android
npm run build:android

# These will use EAS Build (Expo's CI/CD)
# Builds will be available at expo.dev dashboard
# Download .ipa (iOS) or .apk (Android) and test on real device
```

**Time:** 2-3 hours (builds take time)

**Phase 3 Total: 1 day, ~6 hours**

---

## Phase 4: Pre-Launch (Day 6)

**Goal:** Create app store listings, privacy policy, test suite, performance benchmarks

### Day 4: Pre-Launch Preparation

#### Step 6.1: Create Privacy Policy

Template location: `/docs/PRIVACY_POLICY.md`

```markdown
# Privacy Policy

Last Updated: [TODAY'S DATE]

## Information We Collect

We collect the following information:
- Game progress and scores (stored locally)
- Analytics data (plays, purchases)
- Device identifiers (for analytics)

## Data Storage

- Game data: Stored locally on device (localStorage)
- Analytics: Sent to [CONVEX_URL]
- Purchases: Handled by Apple/Google

## Third-Party Services

We use:
- Superwall (payments)
- Convex (game data)
- [Analytics provider]

## Your Rights

You can:
- Delete local game data by clearing app data
- Opt-out of analytics in settings
- Contact us at support@example.com

## Contact

support@example.com
```

**Time:** 30 min

#### Step 6.2: Prepare App Store Screenshots

Required:
- 2-5 screenshots showing gameplay
- 1 feature graphic (1024×500)
- Description (up to 170 characters)
- Keywords (up to 100 characters)

```bash
# Recommended dimensions:
# iPhone: 1170×2532 (portrait)
# iPad: 2048×2732 (portrait)
```

**Suggested Approach:**
1. Play game on simulator
2. Take screenshots at key moments (menu, gameplay, win screen)
3. Use design tool (Figma, Canva) to add text/arrows
4. Export as required dimensions

**Time:** 2-3 hours

#### Step 6.3: Create App Store Listing

**iOS (App Store Connect):**

```
App Name: Tennis Ace
Subtitle: Tap to play, swipe to aim
Description:
  Challenge yourself in fast-paced tennis matches.
  Compete against AI opponents at multiple difficulty levels.
  Unlock cosmetics, climb the leaderboard, and become a tennis champion!

Keywords: tennis, sports, casual, game, multiplayer

Category: Games > Sports
```

**Android (Google Play Console):**
- Same info as iOS
- Add feature graphic (1024×500)
- Add 2-8 screenshots

**Time:** 2 hours

#### Step 6.4: Run QA Test Suite

```bash
# Comprehensive testing checklist:

# FUNCTIONALITY
# [ ] Game starts from menu
# [ ] All menu buttons work (play, shop, settings)
# [ ] Game loop runs at 60 FPS
# [ ] AI opponent responds correctly
# [ ] Score increments on point win
# [ ] Difficulty adapts based on performance
# [ ] Game over screen appears at max time
# [ ] Replay button works
# [ ] Return to menu works
# [ ] Stats persist across sessions

# UI/UX
# [ ] All text readable on small screens
# [ ] Buttons are easy to tap (min 44x44 points)
# [ ] No horizontal scrolling needed
# [ ] Safe area respected (notch/home indicator)
# [ ] Colors accessible (WCAG AA)

# PAYMENTS
# [ ] Shop displays all products
# [ ] Purchase flow initiates correctly
# [ ] Purchase confirmation shows
# [ ] Purchased items unlock

# PERFORMANCE
# [ ] Average FPS: 58-60 on iPhone 13
# [ ] Average FPS: 55-60 on mid-range Android
# [ ] Memory usage: < 100MB
# [ ] No crashes during 1 hour of gameplay
# [ ] Cold start time: < 2 seconds

# COMPATIBILITY
# [ ] iOS 14+ compatibility
# [ ] Android 10+ compatibility
# [ ] Works on iPhone SE (small screen)
# [ ] Works on large phones (Max models)

# LOCALIZATION (if applicable)
# [ ] Text fits in all languages
# [ ] RTL languages supported (Arabic, Hebrew)

# ACCESSIBILITY
# [ ] Game is playable with voice control
# [ ] Text has sufficient contrast
# [ ] No flashing that could trigger seizures
```

**Time:** 4-6 hours

#### Step 6.5: Performance Benchmarking

```bash
# Measure on representative devices:

# iPhone 13 (good device for testing)
# - FPS: Should average 58-60
# - Memory: Should be < 100MB
# - Battery drain: Acceptable during 1-hour play
# - Temperature: Should not overheat

# iPhone SE (smallest/oldest device)
# - FPS: Should maintain 55+
# - Memory: May use more (< 120MB)
# - Ensure all UI fits on screen

# Android (e.g., Pixel 6)
# - FPS: Should average 55-60
# - Memory: < 100MB
# - Battery drain: Acceptable

# Measurement tools:
# iOS: Xcode Instruments (Profile your app)
# Android: Android Studio Profiler
# Web: Chrome DevTools (Performance tab)

# Key metrics to track:
const metrics = {
    avgFPS: 0,        // Target: 58-60
    maxMemoryMB: 0,   // Target: < 100
    p95FrameTimeMs: 0, // Target: < 18
    coldStartTimeMs: 0, // Target: < 2000
};
```

**Time:** 2-3 hours

#### Step 6.6: Staging Build

```bash
# Create a staging/beta version to test everything end-to-end

# For iOS:
npx eas build --platform ios --profile staging

# For Android:
npx eas build --platform android --profile staging

# Download builds and test on real devices
# Make sure everything works:
# [ ] App downloads from store (or testflight)
# [ ] First launch works
# [ ] Game loads correctly
# [ ] Payments work
# [ ] Analytics tracking works
```

**Time:** 2-3 hours

**Phase 4 Total: 1 day, ~14-18 hours**

---

## Phase 5: Deployment (Day 7)

**Goal:** Submit to App Stores, deploy web version

### Day 7: Launch

#### Step 7.1: Final Checks

```bash
# 24 hours before launch, do final verification:

# [ ] All bugs from QA are fixed
# [ ] No console errors or warnings
# [ ] All analytics events fire correctly
# [ ] Payments work in staging
# [ ] Privacy policy is posted
# [ ] App store listings are complete
# [ ] All required screenshots uploaded
# [ ] Version number is correct (1.0.0)
# [ ] Build numbers are sequential
# [ ] Git commit is clean
# [ ] All secrets are in environment variables (not hardcoded)
```

**Time:** 1 hour

#### Step 7.2: iOS Submission

```bash
# Build production iOS app
npm run build:ios

# In App Store Connect:
# 1. Go to My Apps > [Your App] > App Store
# 2. Click "+ Version" or "+ Build"
# 3. Upload build (will appear in Builds section)
# 4. Fill in app information:
#    - Description
#    - Keywords
#    - Support URL
#    - Privacy Policy URL
# 5. Set rating
# 6. Upload screenshots
# 7. Click "Submit for Review"

# Review time: Usually 24-48 hours

# After approval:
# 1. App Store Connect > Version
# 2. Click "Release"
# 3. Select "Release This Version"
# 4. Confirm

eas submit --platform ios
```

**Time:** 30 min (submission), 24-48 hours (review)

#### Step 7.3: Android Submission

```bash
# Build production Android app
npm run build:android

# In Google Play Console:
# 1. Go to My apps > [Your App]
# 2. Click "Create new release" in Production section
# 3. Upload .aab file
# 4. Add release notes
# 5. Review app content rating
# 6. Click "Review"
# 7. Click "Release to production"

# Review time: Usually 2-3 hours

eas submit --platform android
```

**Time:** 30 min (submission), 2-3 hours (review)

#### Step 7.4: Web Deployment (Optional)

```bash
# Deploy web version to Vercel for browser play

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# This will give you a URL like:
# https://myapp.vercel.app

# Share this URL for browser-based play
```

**Time:** 15 min

#### Step 7.5: Post-Submission Monitoring

Once submitted, monitor these channels:

```bash
# App Store Connect notifications
# - Check for rejections
# - Expected: 24-48 hours

# Google Play Console
# - Check for rejections
# - Expected: 2-3 hours

# Sentry/Crash Reporting (if configured)
# - Monitor for crashes
# - Should have 0 crashes in first 24h

# Analytics
# - Monitor daily active users
# - Track game sessions
# - Check revenue if monetized

# Social Media
# - Post launch announcement
# - Gather user feedback
```

**Time:** Ongoing, 30 min daily for first week

**Phase 5 Total: 1 day, ~2-3 hours active work**

---

## Phase 6: Post-Launch (Ongoing)

### Week 1: Launch Monitoring

```bash
# Daily checks:
# [ ] Zero crashes (monitor crash reports)
# [ ] Positive user reviews (respond to feedback)
# [ ] Daily active users trending up
# [ ] Revenue healthy (if applicable)

# Weekly tasks:
# [ ] Analyze gameplay data
# [ ] Review crash logs
# [ ] Collect user feedback
# [ ] Plan first content update

# Red flags to watch:
# - Crash rate > 1%
# - 1-star reviews (investigate bugs)
# - Player drop-off after 30 min
# - Low conversion on payments
```

### Week 2+: Iteration

```bash
# Based on data, make improvements:

# If high drop-off (> 40% after 10 min):
# - Check difficulty balance
# - Review tutorial
# - Analyze user sessions
# - Implement difficulty scaling

# If low payment conversion (< 2%):
# - Review product placement
# - Lower prices
# - Offer free trial
# - Improve shop UI

# If specific crash:
# - Fix and release hotfix
# - Update version to 1.0.1
# - Resubmit to stores

# Content updates:
# - New opponent skins (cosmetics)
# - New challenge modes
# - Seasonal events
# - Leaderboard seasonal reset
```

---

## Environment Variables

Create `.env` file in project root:

```bash
# Convex
CONVEX_URL=https://your-project.convex.cloud
CONVEX_API_KEY=your_api_key_here

# Superwall
SUPERWALL_API_KEY=sk_live_your_key_here
SUPERWALL_ACCOUNT_ID=your_account_id

# Analytics
ANALYTICS_API_KEY=your_analytics_key

# App URLs
APP_STORE_URL=https://apps.apple.com/app/your-app
PLAY_STORE_URL=https://play.google.com/store/apps/details?id=your.app
WEB_URL=https://myapp.vercel.app
```

---

## Troubleshooting

### Build Failures

```bash
# Expo build fails
# Check: npm install (missing dependencies)
# Check: app.json (invalid config)
# Check: eas.json (build profile)

# EAS build logs:
eas build:view

# Clear cache:
eas build:cache:delete
```

### App Store Rejection

**Common reasons:**
1. **Incomplete app functionality** - Make sure game is fully playable
2. **Crash on launch** - Test on physical device
3. **Missing privacy policy** - Must be linked in app settings
4. **Misleading metadata** - Description must match app
5. **Guideline violation** - Review Apple/Google guidelines

**Response:**
- App Store provides detailed rejection reason
- Fix issue and resubmit
- Most resubmissions approved within 24h

### Crashes After Launch

```bash
# Monitor crash reports in:
# - App Store Connect > Crashes
# - Google Play Console > Crashes
# - Sentry (if configured)

# Common causes:
# - JavaScript error (check console logs)
# - Memory leak (check memory profile)
# - Platform-specific issue (test on that device)

# Fix and release hotfix:
npm run build:ios  # Creates v1.0.1
npm run build:android
eas submit --platform ios,android
```

### Performance Issues

```bash
# If FPS drops below 55:
# 1. Check canvas resolution (should be 414x896)
# 2. Reduce object count (fewer particles, etc)
# 3. Optimize render calls (batch where possible)
# 4. Profile with DevTools

# If memory grows > 150MB:
# 1. Check for memory leaks (DevTools)
# 2. Clear old objects
# 3. Reduce texture sizes
# 4. Profile with Android Studio Profiler
```

---

## Success Metrics

### Launch Day Targets

- [ ] App approved and live on both stores
- [ ] Zero crashes in first 24 hours
- [ ] 100+ downloads on day 1
- [ ] 4+ star average rating
- [ ] Positive user feedback

### Week 1 Targets

- [ ] 1,000+ downloads
- [ ] 20%+ return rate (users playing again next day)
- [ ] < 0.5% crash rate
- [ ] 4.5+ star rating
- [ ] First content update planned

### Month 1 Targets

- [ ] 10,000+ downloads
- [ ] 50%+ retention (users still playing)
- [ ] First content update shipped
- [ ] Second update in progress
- [ ] Analytics showing clear usage patterns

---

## Checklist for Day 7

```bash
# Morning (before submission)
# [ ] Final build passes QA
# [ ] Version number correct
# [ ] All assets included
# [ ] No debug code left
# [ ] Privacy policy linked

# Afternoon (submission)
# [ ] iOS build submitted
# [ ] Android build submitted
# [ ] Web version deployed
# [ ] Monitoring setup in place
# [ ] Launch announcement scheduled

# Evening
# [ ] Monitoring for rejections
# [ ] Team notified of submission
# [ ] Social media post scheduled
# [ ] Celebrate! (you launched a game)
```

---

## Quick Reference: Essential Commands

```bash
# Development
expo start                   # Start dev server
npx convex dev             # Start backend dev server

# Building
npm run build:ios          # iOS build
npm run build:android      # Android build
eas submit --platform ios  # Submit to App Store

# Testing
npm test                   # Run tests
npm run lint              # Check code quality

# Deployment
npx convex deploy         # Deploy backend
vercel --prod            # Deploy web version

# Monitoring
eas build:view            # Check build status
npx convex logs          # View backend logs
```

---

## Support & Contact

If you encounter issues:

1. Check this playbook for solutions
2. Review framework documentation: `../README.md`
3. Check game logs: Press 'D' in game for debug panel
4. Check browser console: DevTools > Console tab
5. Check backend logs: `npx convex logs`

---

This playbook is designed to be straightforward and actionable. Follow it sequentially for best results. Good luck launching your game!

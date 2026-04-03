# Game Development Ecosystem

A production-ready framework for creating, deploying, and monetizing mobile games using HTML5 Canvas, React Native, and cloud services. Launch a complete game from concept to App Store in 7 days.

**Built by:** Alpit Tare, Game Developer

---

## Quick Start

### Create a Game in 7 Days

```bash
# Day 1-3: Generate & Customize Game
1. Fill GAME_CREATION_PROMPT.md with your game specs
2. Submit to Claude AI to generate complete game.html
3. Test in browser and customize mechanics

# Day 4: Backend Setup
1. Initialize Convex (npm install convex)
2. Deploy game results schema
3. Wire backend to game HTML

# Day 5: Native Wrapping
1. Copy Expo wrapper template
2. Configure app.json (bundle ID, icons)
3. Test in iOS/Android simulator

# Day 6: Pre-Launch
1. Create app store listings
2. Generate privacy policy
3. Run comprehensive QA test suite

# Day 7: Submit & Launch
1. Build for iOS and Android
2. Submit to App Store and Google Play
3. Deploy web version to Vercel
```

**Estimated timeline: 7 days (40-60 hours)**

---

## What Is This?

This is a complete **game development framework** including:

### 🎮 Core Components

1. **Reusable Framework Modules** - Pre-built game systems (physics, AI, audio, analytics, payments)
2. **Game Creation Template** - AI-powered prompt to generate games automatically
3. **Skeleton HTML Game** - 700-line template with all hooks pre-wired
4. **Expo Wrapper** - React Native wrapper for iOS/Android distribution
5. **Deployment Playbook** - Step-by-step guide to App Store launch
6. **Integration Guide** - Exact code snippets for wiring components

### ✨ Features

- **60 FPS Canvas Rendering** - Smooth gameplay on mobile devices
- **Adaptive AI** - AI opponents that match player skill level
- **Progression System** - Unlocks, cosmetics, achievements, leaderboards
- **Monetization Ready** - Integrated with Superwall for IAP + ads
- **Backend Ready** - Convex integration for multiplayer, leaderboards, analytics
- **iOS/Android/Web** - One codebase, three platforms
- **CI/CD Pipeline** - Automated builds and App Store submissions

---

## Folder Structure

```
08_Game_Ecosystem/
├── 00_Framework_Modules/          # Reusable game systems
│   ├── core.js                    # Game loop, state management
│   ├── audio.js                   # Web Audio API wrapper
│   ├── input.js                   # Touch/mouse/keyboard handling
│   ├── physics.js                 # Physics engine
│   ├── ai.js                      # AI opponent logic
│   ├── analytics.js               # Game event tracking
│   ├── backend.js                 # Convex HTTP client
│   ├── payments.js                # Superwall bridge
│   └── storage.js                 # localStorage wrapper
│
├── 01_Reference_Games/            # Example games (Tennis, Basketball, etc.)
│   ├── 01_Tennis/
│   │   ├── game.html              # Tennis-specific game
│   │   └── physics_config.js      # Tennis physics
│   ├── 02_Basketball/
│   │   ├── game.html
│   │   └── ai_config.js
│   └── ...
│
├── 06_Integration/                # Integration documentation
│   └── INTEGRATION_GUIDE.md       # Wiring all components together
│
├── 10_Templates/                  # Templates for building new games
│   ├── GAME_CREATION_PROMPT.md    # AI prompt template for game generation
│   ├── game-template.html         # 700-line game skeleton
│   └── expo-wrapper-template/     # React Native wrapper template
│       ├── App.js                 # Main Expo component
│       ├── app.json               # App configuration
│       ├── package.json           # Dependencies
│       └── src/
│           └── payments.js        # Superwall products catalog
│
├── 11_Deployment_Playbook/        # Step-by-step launch guide
│   └── DEPLOYMENT_PLAYBOOK.md     # 7-day deployment timeline
│
└── README.md                       # This file
```

---

## Architecture

### How It All Works Together

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLAYER (User)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   ┌─────────┐    ┌─────────┐    ┌────────────┐
   │   iOS   │    │ Android │    │   Web      │
   │ App     │    │ App     │    │ Browser    │
   └──┬──────┘    └──┬──────┘    └────┬───────┘
      │              │                │
      └──────────────┼────────────────┘
                     │
            ┌────────▼────────┐
            │  Expo WebView   │
            │  (React Native) │
            └────────┬────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌─────────┐
   │ Game     │ │Framework │ │Messaging│
   │ HTML5    │ │ Modules  │ │Bridge   │
   │ Canvas   │ │ (JS)     │ │         │
   └────┬─────┘ └──────────┘ └────┬────┘
        │                          │
   ┌────┴──────────┬───────────────┴────┐
   ▼               ▼                     ▼
┌──────────┐ ┌──────────┐         ┌────────────┐
│localStorage│ │Web Audio │      │Native Code │
│(Persistence)││(SFX)     │      │(Payments)  │
└────────────┘ └──────────┘      └──┬─────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
   ┌──────────┐         ┌────────────────┐         ┌────────────────┐
   │ Convex   │         │ Superwall      │         │Analytics (GA)  │
   │ Backend  │         │ (Payments)     │         │(Tracking)      │
   │ (Leaderboards│     │ (IAP + Ads)    │         │                │
   │Game data)   │      └────────────────┘         └────────────────┘
   └──────────┘
```

### Data Flow Example: A Game Round

```
1. Player taps screen
   ↓
2. Input captured by game.html (touch event)
   ↓
3. Game physics update (ball trajectory)
   ↓
4. AI opponent moves (ai.js)
   ↓
5. Canvas render (60 FPS)
   ↓
6. Audio plays (Web Audio API)
   ↓
7. Game ends, result calculated
   ↓
8. Result sent to Convex (backend.js)
   ↓
9. Leaderboard updated
   ↓
10. Analytics event tracked
   ↓
11. Stats saved to localStorage
   ↓
12. Game over screen renders
```

---

## Technology Stack

### Frontend (Game)
- **HTML5 Canvas** - Rendering engine
- **JavaScript (ES2020)** - Game logic
- **Web Audio API** - Sound effects and music
- **localStorage** - Persistent game state

### Mobile
- **React Native** - Native app framework
- **Expo** - Managed React Native service
- **EAS Build** - Cloud build service
- **react-native-webview** - WebView component

### Backend
- **Convex** - Backend-as-a-service (multiplayer, databases)
- **Superwall** - In-app purchases and paywalls
- **Google Analytics** - Game analytics

### DevOps
- **GitHub Actions** - CI/CD pipeline
- **EAS** - Automated app builds
- **Vercel** - Web deployment
- **App Store Connect** - iOS distribution
- **Google Play Console** - Android distribution

### Supported Platforms
- iOS 14+
- Android 10+ (API 29+)
- Chrome, Firefox, Safari, Edge (desktop)

---

## Module Overview

### Framework Modules (in `00_Framework_Modules/`)

#### core.js
Game loop, screen management, state handling
```javascript
CoreGame.setScreen('game')        // Switch screens
CoreGame.gameLoop(callback)       // Main update loop
CoreGame.getState()               // Access game state
```

#### audio.js
Web Audio API wrapper, sound effects, music
```javascript
Audio.playSound(frequency, duration)
Audio.playEffect('win')           // Preset sounds
Audio.setVolume(0.5)
```

#### input.js
Touch, mouse, keyboard handling
```javascript
inputState.isPressed              // Is touching?
inputState.dragDeltaX             // Swipe distance
inputState.touchDuration          // How long held
```

#### physics.js
Physics calculations, collision detection
```javascript
Physics.update(objects, dt)
Physics.checkCollision(a, b)
Physics.applyForce(object, fx, fy)
```

#### ai.js
AI opponent behavior
```javascript
AI.predictTrajectory(ball)        // Ball prediction
AI.evaluateGameState(state)       // AI decision
```

#### analytics.js
Game event tracking
```javascript
Analytics.track('game_ended', { score: 10 })
Analytics.trackScreen('menu')
```

#### backend.js
Convex integration
```javascript
Backend.call('submitGameResult', result)
Backend.getLeaderboard()
```

#### payments.js
Superwall IAP and ads
```javascript
Payments.purchaseProduct(productId)
Payments.restorePurchases()
```

#### storage.js
Persistent data storage
```javascript
Storage.save('scores', data)
Storage.load('scores')
```

---

## Quick Reference: Key Files

### For Game Designers
1. **GAME_CREATION_PROMPT.md** - Fill this to define your game
2. **game-template.html** - Skeleton to customize
3. **DEPLOYMENT_PLAYBOOK.md** - Timeline and checklist

### For Developers
1. **INTEGRATION_GUIDE.md** - Exact code integration points
2. **00_Framework_Modules/** - Framework source code
3. **expo-wrapper-template/** - React Native setup

### For Publishing
1. **DEPLOYMENT_PLAYBOOK.md** - Step-by-step launch guide
2. **app.json** - App store configuration
3. **eas.json** - EAS build configuration

---

## Getting Started

### Option 1: Use AI to Generate Game (Recommended)

```bash
# 1. Fill the template
cat 10_Templates/GAME_CREATION_PROMPT.md

# 2. Copy and fill all [FILL] sections with your game specs
# 3. Paste the entire prompt to Claude AI
# 4. Claude responds with complete game.html
# 5. Save the output and follow DEPLOYMENT_PLAYBOOK.md
```

**Pros:** Fastest, AI handles complexity
**Cons:** Requires Claude access
**Time:** 1-2 hours to launch

### Option 2: Customize Template

```bash
# 1. Copy skeleton
cp 10_Templates/game-template.html my-game.html

# 2. Edit all TODO sections with your sport/game logic
# 3. Test in browser
# 4. Wrap in Expo and launch
```

**Pros:** Full control, customizable
**Cons:** More code to write
**Time:** 2-3 days to launch

### Option 3: Fork Reference Game

```bash
# 1. Copy a reference game
cp -r 01_Reference_Games/Tennis ~/my-game

# 2. Modify game.html for your rules/mechanics
# 3. Change cosmetics and themes
# 4. Wrap in Expo and launch
```

**Pros:** Fastest, proven structure
**Cons:** Limited to similar sports
**Time:** 1 day to launch

---

## Step-by-Step: Launch Your First Game

### Step 1: Create Game (Day 1-3)
```bash
# Option A: Use AI prompt template
open 10_Templates/GAME_CREATION_PROMPT.md  # Fill and send to Claude
# Claude generates game.html

# Option B: Customize template
cp 10_Templates/game-template.html game.html
# Edit TODO sections

# Option C: Fork reference game
cp -r 01_Reference_Games/Tennis my-game

# Test in browser
python3 -m http.server 8000
# Open http://localhost:8000/game.html
```

### Step 2: Setup Backend (Day 4)
```bash
# Initialize Convex
npm install convex
npx convex dev

# Create schema (see DEPLOYMENT_PLAYBOOK.md)
# Update game.html with Convex URL
```

### Step 3: Build Native (Day 5)
```bash
# Setup Expo
npx create-expo-app MyGame
cd MyGame

# Copy templates
cp -r ../expo-wrapper-template/* .

# Configure app.json (bundle ID, app name, icons)
# Install dependencies
npm install

# Test in simulator
npm start
# Press 'i' for iOS or 'a' for Android
```

### Step 4: Pre-Launch (Day 6)
```bash
# Run QA test suite (see DEPLOYMENT_PLAYBOOK.md)
# Create app store listings
# Generate privacy policy
# Take app store screenshots
```

### Step 5: Submit (Day 7)
```bash
# Build for App Store
npm run build:ios
eas submit --platform ios

# Build for Google Play
npm run build:android
eas submit --platform android

# Deploy web version (optional)
vercel --prod
```

---

## Agent System Overview

This ecosystem uses an agent-based architecture with specialized agents for each phase:

### Agent 1: Game Designer Agent
**Role:** Interprets game concept and creates specifications
**Input:** Game concept, mechanics, sport rules
**Output:** Filled GAME_CREATION_PROMPT.md
**Time:** ~1 hour

### Agent 2: Game Generation Agent (Claude AI)
**Role:** Generates complete game HTML from specifications
**Input:** Filled GAME_CREATION_PROMPT.md
**Output:** Complete game.html (~700 lines), ready to run
**Time:** ~30 minutes

### Agent 3: Backend Deployment Agent
**Role:** Sets up Convex, database schema, backend functions
**Input:** Game specifications, data requirements
**Output:** Deployed Convex project with game results schema
**Time:** ~1 hour

### Agent 4: Native Build Agent
**Role:** Configures Expo, builds native apps
**Input:** Game HTML, app metadata, signing certificates
**Output:** Built .ipa (iOS) and .aab (Android) files
**Time:** ~2 hours

### Agent 5: Launch Agent
**Role:** Submits to App Stores, handles review process
**Input:** Built app files, app store metadata
**Output:** Live app on iOS App Store and Google Play Store
**Time:** ~1 day (includes review time)

### Agent 6: Post-Launch Agent (You!)
**Role:** Monitor analytics, iterate on gameplay
**Input:** User feedback, crash reports, analytics data
**Output:** Game updates, content patches, improvements
**Time:** Ongoing

---

## Monetization Options

### 1. Free-to-Play + IAP (Recommended)
- Cosmetics (paddle skins, court themes, ball textures)
- Gameplay features (challenge modes, power-ups)
- Premium features (no ads, extra lives)
- Price points: $0.99 - $19.99

**Revenue model:** Superwall handles all purchases
**Implementation:** See `src/payments.js`

### 2. Premium (No IAP)
- Single purchase ($4.99 - $9.99)
- Unlock full game
- No ads, no gameplay restrictions

### 3. Subscription
- Monthly pass ($9.99)
- Annual pass ($69.99, 40% off)
- Includes all cosmetics + daily bonuses

### 4. Hybrid
- Free-to-play base game
- Seasonal battle pass
- Cosmetics
- Optional premium features

**Recommended:** Freemium (Free-to-Play + IAP)
**Expected conversion:** 2-5% of active users
**ARPPU:** $2-5 per active user

---

## Performance Targets

### Frame Rate
- Target: 60 FPS
- Minimum: 55 FPS on mid-range devices
- Measurement: Debug panel (press 'D' in game)

### Memory Usage
- Target: < 100MB on mobile
- Avoid: Leaks > 1MB per minute
- Measurement: Chrome DevTools, Xcode Instruments

### Load Time
- Cold start: < 2 seconds
- Game start: < 1 second
- Measurement: Performance tab in DevTools

### Battery
- Target: < 5% battery per hour
- Critical: < 10% battery per hour
- Avoid: Constant CPU spinning

### Network
- No network required to play
- Backend sync in background
- Graceful fallback if offline

---

## Troubleshooting

### Game Won't Start
```bash
# Check canvas setup
# Verify game.html has <canvas id="gameCanvas"></canvas>
# Check JavaScript console for errors (Ctrl+Shift+J)
# Verify all framework modules loaded (Network tab)
```

### 60 FPS Not Achieved
```bash
# Debug panel (press 'D')
# Check FPS counter
# Identify slow render (profiler)
# Reduce object count or optimize render loop
```

### Expo App Won't Build
```bash
# Check app.json syntax
# Verify all required fields (name, slug, bundleId)
# Clear Expo cache: eas build:cache:delete
# Check Node.js version (must be 18+)
```

### App Store Rejection
```bash
# Check rejection reason in App Store Connect
# Common: missing privacy policy, crash on launch, incomplete
# Fix issue and resubmit (usually approved in 24h)
# See DEPLOYMENT_PLAYBOOK.md for solutions
```

### Backend Not Receiving Data
```bash
# Verify Convex URL in game.html
# Check browser Network tab (fetch calls)
# Verify schema matches (convex/schema.ts)
# Check Convex logs: npx convex logs
```

---

## FAQ

**Q: Can I use a different backend?**
A: Yes, edit `backend.js` to use Firebase, Supabase, or custom server.

**Q: Can I use a different payment provider?**
A: Yes, edit `payments.js` to use RevenueCat, custom IAP, or remove entirely.

**Q: Does this work on web?**
A: Yes! game.html runs in any browser. The Expo wrapper adds iOS/Android.

**Q: How much does it cost?**
A: Mostly free:
- Expo: Free (EAS Build has paid tiers)
- Convex: Free tier (2GB storage)
- Superwall: Free (takes 30% of revenue)
- Apple Dev: $99/year
- Google Play: $25 (one-time)

**Q: How long does app review take?**
A: iOS App Store: 24-48 hours
Google Play: 2-3 hours

**Q: Can I use this for non-games?**
A: Yes, framework supports any Canvas application.

---

## License & Credits

**Developer:** Alpit Tare
**Framework:** Open source, MIT License
**Built with:** Expo, React Native, Convex, Superwall

---

## Next Steps

1. **Read:** DEPLOYMENT_PLAYBOOK.md (7-day launch timeline)
2. **Design:** Fill GAME_CREATION_PROMPT.md with your game specs
3. **Generate:** Use Claude AI to create game.html
4. **Test:** Launch in browser and customize
5. **Build:** Wrap in Expo and test on simulator
6. **Launch:** Submit to App Stores (Day 7)

**Target:** From concept to App Store in 7 days
**Effort:** 40-60 hours of work
**Cost:** ~$125 + revenue sharing

---

## Resources

- **Framework Documentation:** See each file in `00_Framework_Modules/`
- **Game Creation:** See `10_Templates/GAME_CREATION_PROMPT.md`
- **Deployment Steps:** See `11_Deployment_Playbook/DEPLOYMENT_PLAYBOOK.md`
- **Integration Details:** See `06_Integration/INTEGRATION_GUIDE.md`
- **Example Games:** See `01_Reference_Games/`

---

## Support

For issues or questions:
1. Check DEPLOYMENT_PLAYBOOK.md (troubleshooting section)
2. Check INTEGRATION_GUIDE.md (integration issues)
3. Review framework module code (`00_Framework_Modules/`)
4. Check example games (`01_Reference_Games/`)

---

**Ready to build? Start with GAME_CREATION_PROMPT.md**

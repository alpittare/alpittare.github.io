# Game Creation Prompt Template

## Overview
This is a comprehensive prompt template designed to be given to Claude AI to automatically generate a complete, production-ready game using the Reusable Game Framework. Fill in the blanks in each section, then submit the entire prompt to Claude.

The AI will respond with:
1. A complete `game.html` file (~700 lines) ready to run
2. Integration instructions for the Expo wrapper
3. Configuration for Capacitor (if native build needed)

---

## Template: FILL IN ALL SECTIONS BELOW

### SECTION 1: Game Concept

**Game Title:** [FILL: Name of the game]

**Sport/Genre:** [FILL: e.g., Tennis, Basketball, Soccer, Racing, Puzzle]

**Target Platform:** [FILL: iOS/Android/Web]

**Target Audience:** [FILL: e.g., Casual mobile players aged 8-35]

**Core Loop Duration:** [FILL: Time in seconds for one game session, e.g., 60-90 seconds]

**One-Sentence Pitch:** [FILL: Example: "A fast-paced tennis game where players tap to swing and swipe to aim"]

---

### SECTION 2: Sport Rules & Win Conditions

**Official Rules Reference:** [FILL: Brief description of the real sport's rules if applicable]

**Simplified Game Rules:** [FILL: How many points to win? What ends the game? What are the turn mechanics?]

**Win Condition:** [FILL: e.g., "First to 11 points, or 60 seconds elapsed"]

**Lose Condition:** [FILL: e.g., "Opponent reaches 11 points first, or time expires"]

**Example:** For Tennis:
- Win: First to 4 points (deuce rules simplified: win by 2)
- Lose: Opponent reaches 4 points first
- Draw: After 60 seconds, highest score wins

---

### SECTION 3: Core Mechanics

**Primary Mechanic:** [FILL: The main action player performs repeatedly]

**Example for Tennis:**
- Tap screen to prepare swing
- Drag/swipe to aim direction
- Release to execute shot
- Ball physics determine if it lands in or out

**Secondary Mechanics:** [FILL: List 2-3 additional mechanics]

**Example additions:**
- Power meter: hold longer = harder shot
- Slice shots: flick downward for spin
- Defensive position: drag player left/right to set up

**Special Moves/Power-ups:** [FILL: Any special actions available?]

**Example:** Ace shot (rare: 5% chance per swing) = auto-win point

---

### SECTION 4: Physics Parameters

**Canvas Size:** 414x896 (fixed for mobile)

**Physics Engine:** Matter.js or custom vector-based

**Key Physics Values to Define:**

| Parameter | Current Value | Your Value | Notes |
|-----------|---------------|-----------|-------|
| Gravity | 0.6 | [FILL] | Affects ball drop speed |
| Ball Friction | 0.98 | [FILL] | 1.0 = no friction, 0.8 = high drag |
| Ball Bounce | 0.85 | [FILL] | Elasticity on court collision |
| Max Ball Speed | 12 px/frame | [FILL] | Terminal velocity for shot |
| Player Speed | 6 px/frame | [FILL] | How fast AI/player moves |
| Court Dimensions | 350x600 | [FILL] | Play area size in pixels |

**Example for Tennis:**
- Gravity: 0.6 (realistic drop)
- Ball Friction: 0.97 (minimal air resistance)
- Ball Bounce: 0.80 (clay court softness)
- Max Ball Speed: 10 px/frame (realistic pace)

---

### SECTION 5: AI Configuration

**Difficulty Levels:**

**Level 1 (Easy):**
- Reaction Time: [FILL: milliseconds, e.g., 500ms]
- Accuracy: [FILL: percent, e.g., 60%]
- Strategy: [FILL: e.g., "Random shots, weak positioning"]

**Level 2 (Medium):**
- Reaction Time: [FILL: e.g., 300ms]
- Accuracy: [FILL: e.g., 75%]
- Strategy: [FILL: e.g., "Predictive positioning, consistent placement"]

**Level 3 (Hard):**
- Reaction Time: [FILL: e.g., 150ms]
- Accuracy: [FILL: e.g., 85%]
- Strategy: [FILL: e.g., "Aggressive net play, exploits weaknesses"]

**Example Tennis AI:**

```javascript
const aiConfig = {
  difficulty: 'medium',
  reactionTime: 300,      // ms
  accuracy: 0.75,         // 0-1
  positioningSkill: 0.7,  // predictive movement
  shotSelection: 'adaptive', // changes based on rally length
  exploitWeakness: 0.5,   // tendency to target weak side
  pressureHandling: 0.6   // maintains accuracy under pressure
};
```

---

### SECTION 6: Difficulty Scaling

**Adaptive Difficulty:** [FILL: How does the game respond to player skill?]

**Example Scaling Rules:**
- If player wins 3 in a row → increase AI difficulty
- If player loses 3 in a row → decrease AI difficulty
- If win ratio > 60% → trigger hard mode
- If win ratio < 30% → suggest easy mode

**Difficulty Curve Over Sessions:**
- Session 1: Start on Easy
- Session 2-3: Move to Medium if completing easy 2x
- Session 4+: Unlock Hard mode if Medium win rate > 50%

**Your Scaling Logic:** [FILL: Define your progression]

---

### SECTION 7: Progression Design

**Player Progression Metrics:**
- Total Games Played: [FILL]
- Win Streak: [FILL]
- Best Time: [FILL]
- Total Points Scored: [FILL]
- Achievements Unlocked: [FILL]

**Unlock System:**
- Cosmetics Unlock: [FILL: What visual rewards? e.g., "New court skins every 10 wins"]
- Challenge Modes: [FILL: e.g., "Unlock 60-second sprint at 20 wins"]
- Leaderboard Tiers: [FILL: e.g., "Rank from Bronze → Silver → Gold → Platinum"]

**Example:**
```
Cosmetics by Wins:
- 5 wins → Blue court skin
- 10 wins → Neon ball texture
- 20 wins → Golden paddle skin

Challenges:
- 10 wins → Speed Challenge (faster ball)
- 25 wins → Accuracy Challenge (smaller court)
- 50 wins → Endurance (30 rallies)

Leaderboard:
- Top 1000 = Platinum
- Top 5000 = Gold
- Top 20000 = Silver
- Remaining = Bronze
```

**Your Progression:** [FILL]

---

### SECTION 8: Monetization

**Pricing Model:** [FILL: Free-to-Play with IAP, Premium, Subscription, or Hybrid?]

**Premium Features (if applicable):**
- Cosmetics: [FILL: e.g., "Custom paddle colors, ball skins, court themes"]
- Gameplay: [FILL: e.g., "Challenge modes, extra lives, power-ups"]
- Removal: [FILL: e.g., "Ads, friction elements"]

**In-App Purchase Catalog:**

| Product ID | Name | Price | Benefit |
|-----------|------|-------|---------|
| [FILL] | [FILL] | [FILL] | [FILL] |
| [FILL] | [FILL] | [FILL] | [FILL] |

**Example (Tennis):**
| cosmetic_paddle_gold | Gold Paddle | $0.99 | Visual customization |
| cosmetic_court_neon | Neon Court | $1.99 | Visual customization |
| gameplay_no_ads | Remove Ads | $4.99 | Ad-free experience |
| gameplay_power_pack | 5 Power-ups | $2.99 | Gameplay advantage |
| subscription_monthly | Monthly Pass | $9.99 | All cosmetics + no ads |

**Ad Placement:**
- Banner: [FILL: After game ends? Y/N]
- Rewarded Video: [FILL: "Double coins" button? Y/N]
- Interstitial: [FILL: Between menu and game? Y/N]

**Your Monetization:** [FILL]

---

### SECTION 9: UI Themes & Aesthetics

**Visual Style:** [FILL: Minimalist, Cartoon, Realistic, Neon, etc.]

**Color Scheme:**
- Primary Color: [FILL: hex code or name, e.g., #2D5F8D]
- Secondary Color: [FILL]
- Accent Color: [FILL]
- Background Color: [FILL]

**Font:**
- Title Font: [FILL: e.g., Arial, Roboto]
- Body Font: [FILL]

**Example Tennis Theme:**
```
Visual Style: Minimalist + Realistic
Colors:
  - Primary: #1a472a (dark green, grass court)
  - Secondary: #f5f5f5 (white lines)
  - Accent: #ff6b35 (orange for buttons)
  - Background: #0f0f0f (dark, minimal)

Fonts:
  - Titles: Arial Black, 32px, bold
  - Body: Arial, 16px, regular
  - UI: Courier New, 14px, monospace

Sound Theme:
  - Hit: Sharp "tock" sound
  - Score: Uplifting ding
  - Win: Triumphant fanfare
  - Lose: Descending tone
```

**Sound Effects Needed:**
- [FILL: List all sound effects required]

**Music:**
- Ambient Track: [FILL: Describe mood, e.g., "Upbeat electronic, 120 BPM"]
- Menu Music: [FILL]

**Your Theme:** [FILL]

---

### SECTION 10: Integration with Framework

**Framework Modules to Use:**

The game will import these from `../../../00_Framework_Modules/`:

1. `core.js` - Core game loop, canvas setup, state management
2. `audio.js` - Web Audio API wrapper for music/SFX
3. `input.js` - Touch/mouse/keyboard input handling
4. `physics.js` - Physics calculations (or Matter.js wrapper)
5. `ai.js` - AI opponent logic
6. `analytics.js` - Game metrics collection
7. `backend.js` - Convex HTTP client
8. `payments.js` - Superwall bridge
9. `storage.js` - localStorage wrapper

**Game-Specific Code (You Must Add):**
- Sport logic: `update()` and `render()` game states
- AI behavior: Define `aiStep()` function
- Collision detection: Custom logic for your sport
- Progression: Track achievements, unlock mechanics

---

## SUBMISSION INSTRUCTIONS

**Step 1:** Fill in all sections above (marked with [FILL])

**Step 2:** Paste the entire prompt into Claude with this preamble:

```
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

Here is the game specification:

[PASTE FILLED TEMPLATE HERE]

Expected output:
- Complete game.html file
- Integration checklist
- List of required Superwall product IDs
- Instructions for Expo wrapper
```

**Step 3:** Claude will respond with:
- Complete `game.html` (~700 lines)
- Setup instructions for `app.json` and Expo wrapper
- Capacitor configuration (if needed)
- List of required IAP product IDs for Superwall

**Step 4:** Follow the DEPLOYMENT_PLAYBOOK.md to launch in 7 days

---

## EXAMPLE: TENNIS GAME (FILLED TEMPLATE)

This section shows a complete example for a Tennis game, demonstrating how to fill in the template.

### SECTION 1: Game Concept (Tennis Example)

**Game Title:** Tennis Ace

**Sport/Genre:** Sports / Tennis

**Target Platform:** iOS

**Target Audience:** Casual mobile players aged 8-45

**Core Loop Duration:** 45-60 seconds per rally

**One-Sentence Pitch:** "Tap to swing, swipe to aim—compete in fast-paced tennis matches against adaptive AI"

### SECTION 2: Sport Rules & Win Conditions (Tennis Example)

**Official Rules Reference:** Tennis scoring (15, 30, 40, deuce) simplified to 0, 1, 2, 3, deuce

**Simplified Game Rules:**
- Standard tennis: first to 4 points wins game (must win by 2 after deuce)
- Match is best-of-3 games
- Visual court with player on bottom, opponent on top
- Ball physics determine if shot lands in or out
- Opponent is controlled by AI (difficulty-dependent)

**Win Condition:** Win 2 out of 3 games (best of 3), or reach 4 points with 2-point lead in any game

**Lose Condition:** Lose 2 out of 3 games, or opponent reaches 4 points with 2-point lead

### SECTION 3: Core Mechanics (Tennis Example)

**Primary Mechanic:**
- Tap screen to prepare swing (shows power meter)
- Drag/swipe to aim direction (left, center, right)
- Release to execute shot
- Ball travels based on aim direction and swing power
- AI automatically returns ball if in range

**Secondary Mechanics:**
- Power meter: hold longer = faster shot (up to 1.5x normal speed)
- Spin shots: flick downward while dragging = topspin (curves trajectory)
- Slice shots: flick upward = backspin (lands softer)
- Defensive positioning: drag player left/right to intercept ball

**Special Moves/Power-ups:**
- Ace Shot (5% chance per swing): If ball is unreturnable, automatic win of point with celebratory animation
- Net Dribble (special technique): Rapidly tap screen 3x = low-net volley with 60% success rate

### SECTION 4: Physics Parameters (Tennis Example)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Gravity | 0.55 | Realistic drop for outdoor court |
| Ball Friction | 0.97 | Minimal air resistance |
| Ball Bounce | 0.80 | Hardcourt elasticity |
| Max Ball Speed | 10 px/frame | ~600 px/sec at normal speed |
| Player Speed | 6 px/frame | Must reach ball in <500ms |
| Court Dimensions | 350x600 | Net at x=350, service lines visible |

### SECTION 5: AI Configuration (Tennis Example)

**Level 1 (Easy):**
- Reaction Time: 500ms
- Accuracy: 60%
- Strategy: Random shots, weak positioning, rarely returns powerful shots

**Level 2 (Medium):**
- Reaction Time: 300ms
- Accuracy: 75%
- Strategy: Predictive positioning, consistent placement, counters aggressive play

**Level 3 (Hard):**
- Reaction Time: 150ms
- Accuracy: 85%
- Strategy: Aggressive net play, exploits weak side (right side), pressures player with pace

```javascript
const aiConfig = {
  difficulty: 'medium',
  reactionTime: 300,
  accuracy: 0.75,
  positioningSkill: 0.7,
  shotSelection: 'adaptive',
  exploitWeakness: 0.5,
  pressureHandling: 0.6,
  netPlayAggression: 0.6
};
```

### SECTION 6: Difficulty Scaling (Tennis Example)

**Adaptive Difficulty:**
- If player wins 3 consecutive games → increase AI difficulty
- If player loses 3 consecutive games → decrease AI difficulty
- If overall win ratio > 60% → suggest progression to hard mode
- If overall win ratio < 30% → suggest switching to easy mode

**Difficulty Curve Over Sessions:**
- Session 1: Start on Easy (80% win rate expected)
- Session 2-3: Move to Medium if completing Easy 2x (50% win rate)
- Session 4+: Unlock Hard mode if Medium win rate > 50% (20-30% win rate)

### SECTION 7: Progression Design (Tennis Example)

**Player Progression Metrics:**
- Total Games Played
- Win Streak (tracks current and all-time best)
- Best Time (fastest game completion)
- Total Points Scored
- Achievements (Ace Master, Deuce Handler, etc.)

**Unlock System:**

Cosmetics by Wins:
- 5 wins → Blue court skin
- 10 wins → Neon ball texture
- 20 wins → Golden paddle skin
- 50 wins → Holographic ball + court combo

Challenges:
- 10 wins → Speed Challenge (1.2x faster ball)
- 25 wins → Accuracy Challenge (smaller court area)
- 50 wins → Endurance (5 consecutive games)

Leaderboard Tiers:
- Top 1000 = Platinum (Gold paddle glow)
- Top 5000 = Gold
- Top 20000 = Silver
- Remaining = Bronze

### SECTION 8: Monetization (Tennis Example)

**Pricing Model:** Free-to-Play with cosmetic IAP + optional ads removal

**Premium Features:**
- Cosmetics: Custom paddle colors, ball textures, court themes, player skins
- Ad-free: Remove all banner and interstitial ads
- Extra lives: Not applicable (no lives system)
- Challenge passes: Unlock cosmetic-only challenge modes

**In-App Purchase Catalog:**

| Product ID | Name | Price | Benefit |
|-----------|------|-------|---------|
| cosmetic_paddle_gold | Gold Paddle | $0.99 | Visual |
| cosmetic_paddle_neon | Neon Paddle | $0.99 | Visual |
| cosmetic_court_clay | Clay Court | $1.99 | Visual |
| cosmetic_court_neon | Neon Court | $1.99 | Visual |
| cosmetic_ball_glow | Glowing Ball | $0.99 | Visual |
| cosmetic_player_avatar_1 | Avatar Pack 1 | $2.99 | 3 avatars |
| gameplay_no_ads | Remove Ads Forever | $4.99 | Gameplay |
| gameplay_challenge_pass | Monthly Challenge Pass | $9.99 | 1 month cosmetics |

**Ad Placement:**
- Banner: After game ends (if lost), disappears on replay
- Rewarded Video: "2x Points This Rally" button (optional, appears 1x per session)
- Interstitial: Between main menu and game start (optional)

### SECTION 9: UI Themes & Aesthetics (Tennis Example)

**Visual Style:** Minimalist + Realistic

**Color Scheme:**
- Primary: #1a472a (dark green, grass court)
- Secondary: #f5f5f5 (white lines)
- Accent: #ff6b35 (orange for buttons)
- Background: #0f0f0f (dark, minimal)

**Fonts:**
- Titles: Arial Black, 32px, bold
- Body: Arial, 16px, regular
- UI: Courier New, 14px, monospace

**Sound Effects:**
- Hit: Sharp "tock" sound (440 Hz sine wave, 100ms)
- Score: Uplifting ding (523 Hz, 200ms)
- Win Game: Triumphant fanfare (3-note chord)
- Lose Game: Descending tone (C-B-A)
- Ace: Loud "boom" + cheering crowd (2s)
- Serve Ready: Soft beep (1 tone)

**Music:**
- Menu: Upbeat electronic, 120 BPM, 60s loop
- In-Game: Subtle tennis-themed ambient, 90 BPM
- Victory: Triumphant orchestral, 30s one-shot
- Defeat: Somber piano, 15s one-shot

---

## Using This Template

1. **Copy** this file and fill in all [FILL] sections with your game specifications
2. **Review** the Tennis example for formatting reference
3. **Submit** the filled template to Claude with the preamble from "SUBMISSION INSTRUCTIONS"
4. **Receive** complete game.html file ready to integrate
5. **Follow** the DEPLOYMENT_PLAYBOOK.md to ship in 7 days

This template ensures consistency across all games in the ecosystem and dramatically speeds up game creation.

# E2E Test Scenarios

**Game Ecosystem: CrickBot AI | GoalBot AI | BaseHit AI**

Production-ready end-to-end test scenarios covering happy paths, edge cases, performance, and memory management.

---

## Table of Contents

1. [Happy Path Scenarios](#happy-path-scenarios)
2. [Edge Cases & Stress Tests](#edge-cases--stress-tests)
3. [Performance Benchmarks](#performance-benchmarks)
4. [Memory Leak Detection](#memory-leak-detection)
5. [Cross-Device Testing Matrix](#cross-device-testing-matrix)
6. [Test Execution Guide](#test-execution-guide)

---

## Happy Path Scenarios

### Scenario 1.1: Complete Single Player Game (Cricket)

**Preconditions:**
- App installed and launched
- Player is on main menu
- Device has internet connection

**Steps:**
1. Tap "New Game"
2. Select difficulty: Normal
3. Game loads and displays pitch view
4. Play 10 balls:
   - Tap screen at correct timing for 8 successful hits
   - Miss 2 balls
5. Game displays score screen: "80 Points"
6. Tap "Play Again"
7. Return to menu

**Expected Results:**
- Each tap registers within 16ms (60 FPS window)
- Ball physics consistent throughout
- Score increments by 10 per hit
- Screen transitions smooth (no frame drops)
- Audio plays on each hit (if unmuted)
- Game saves session to localStorage
- Leaderboard syncs score to server

**Duration:** ~2 minutes
**Device:** iPhone 12+, iOS 14+

---

### Scenario 1.2: Campaign Mode Progression (Football)

**Preconditions:**
- App on main menu
- Campaign mode available

**Steps:**
1. Tap "Campaign"
2. Select "Level 1: Beginner"
3. Complete level:
   - Score minimum 50 points
   - Tap "Continue" on score screen
4. Level 2 unlocks automatically
5. Repeat for 3 consecutive levels
6. View campaign progress page
7. Return to menu

**Expected Results:**
- Level data persists in localStorage
- Campaign state saved after each level
- "Next Level" button appears after completion
- Progress bar shows 3/10 levels complete
- All three levels remain playable on replay
- No data loss on app background/foreground

**Duration:** ~4 minutes
**Device:** iPhone SE, iOS 14+

---

### Scenario 1.3: VIP Subscription Purchase (Baseball)

**Preconditions:**
- App on main menu
- Apple ID configured on device
- Player not yet subscribed

**Steps:**
1. Tap menu icon (top right)
2. Select "Settings"
3. Tap "Unlock VIP"
4. Review: Monthly subscription, $4.99
5. Tap "Subscribe"
6. Authenticate with Face ID / Touch ID
7. Wait for confirmation (5-10 seconds)
8. Settings now show "VIP: Active"
9. Close settings
10. Resume game

**Expected Results:**
- In-app purchase dialog shows correct price
- Apple handles authentication securely
- Subscription confirmation received from Superwall
- VIP badge displays on menu
- VIP benefits active (ad removal, bonus coins)
- No app crash or hang during purchase
- Game remains playable after purchase

**Duration:** ~1 minute
**Device:** iPad Pro, iOS 15+

---

### Scenario 1.4: Multiplayer Match (Cricket)

**Preconditions:**
- Two players on same WiFi
- Both apps updated to same version
- Both players on main menu

**Player 1:**
1. Tap "Multiplayer"
2. Tap "Create Room"
3. Room code: ABC123 displays
4. Share code to Player 2
5. Tap "Waiting for opponent..."

**Player 2:**
1. Tap "Multiplayer"
2. Tap "Join Room"
3. Enter code: ABC123
4. Tap "Join"

**Both Players:**
5. Match starts: "3, 2, 1, Play!"
6. Play 5 balls each
7. Match ends
8. Winner screen shows: "Player 1: 60 pts | Player 2: 40 pts"
9. Tap "Rematch" or "Exit"

**Expected Results:**
- Room creation completes in <2 seconds
- Both players see synchronized gameplay
- Scores update in real-time for both
- Ball physics identical for both players
- Winner determined correctly
- No score desync
- Connection loss detected and handled gracefully

**Duration:** ~2 minutes
**Device:** iPhone 12 + iPhone 11, WiFi

---

### Scenario 1.5: Leaderboard & Social Features

**Preconditions:**
- App on main menu
- Player has played at least one game
- Internet connection active

**Steps:**
1. Tap menu → "Leaderboard"
2. View global top 100 scores
3. Find player's position (scrollable list)
4. Tap on a player's score
5. View player profile (score, games played, avatar)
6. Return to leaderboard
7. Filter by "Friends" (if social feature enabled)
8. Return to menu

**Expected Results:**
- Leaderboard loads within 3 seconds
- 100 scores display with rank, name, score, date
- Player's position highlighted
- Leaderboard updates every 30 seconds
- Profile opens without lag
- No duplicate entries
- Scores sorted descending by points

**Duration:** ~1 minute
**Device:** iPhone 13, WiFi

---

## Edge Cases & Stress Tests

### Scenario 2.1: Rapid Tapping (Input Stress)

**Preconditions:**
- Game in progress, ball approaching
- Device has normal battery

**Steps:**
1. Tap screen as rapidly as possible (10+ taps per second)
2. Continue for 5 seconds
3. Observe game behavior
4. Wait for next ball
5. Resume normal play

**Expected Results:**
- Only ONE swing executed per ball
- Excess taps ignored (not queued)
- No lag or frame drops
- Physics remain consistent
- Audio plays once per swing (not overlapping)
- Game remains responsive
- FPS stays at 60 (±5%)

**Duration:** ~10 seconds
**Device:** All supported devices

---

### Scenario 2.2: Orientation Change During Play

**Preconditions:**
- Game in progress
- Device in portrait orientation
- Auto-rotate enabled

**Steps:**
1. Play normally in portrait (5 balls)
2. Rotate device to landscape
3. Wait 2 seconds for re-layout
4. Continue playing (5 balls)
5. Rotate back to portrait
6. Finish game

**Expected Results:**
- Game pauses briefly during orientation change
- UI re-layouts correctly to new orientation
- Game resumes seamlessly
- Score and stats preserved
- Physics continue consistently
- No crash or data loss
- Camera/viewport adjusts appropriately

**Duration:** ~1 minute
**Device:** iPhone (with auto-rotate), iPad

---

### Scenario 2.3: Background/Foreground Transitions

**Preconditions:**
- Game in progress
- Device playing audio
- Background activity available (Messages, calendar)

**Steps:**
1. Play game normally (3 balls)
2. Press home button (app moves to background)
3. Wait 5 seconds
4. Return to app (tap icon)
5. Continue playing (3 more balls)
6. Repeat 3 times
7. Finish game

**Expected Results:**
- Game pauses when moving to background
- Audio stops
- Game state preserved in memory
- Resume works within 2 seconds
- No score loss
- Leaderboard data not corrupted
- Session continues seamlessly
- Battery impact minimal

**Duration:** ~1.5 minutes
**Device:** All iOS devices

---

### Scenario 2.4: Network Loss During Play

**Preconditions:**
- Game in progress (online mode)
- WiFi or cellular connected
- Midway through game session

**Steps:**
1. Play 5 balls normally
2. Disable WiFi and cellular (Airplane mode)
3. Continue playing 3 balls
4. Re-enable WiFi
5. Wait for reconnection
6. Finish game
7. View score (should sync)

**Expected Results:**
- Game continues unaffected during network loss
- Score updates persist locally
- No error messages
- Reconnection automatic (within 5 seconds)
- Score syncs to server after reconnection
- Leaderboard updated
- No duplicate entries on re-sync

**Duration:** ~1.5 minutes
**Device:** All devices with WiFi

---

### Scenario 2.5: Low Memory Conditions

**Preconditions:**
- Device running other apps (consuming RAM)
- Available memory <500MB
- Game started

**Steps:**
1. Open app switcher (recent apps)
2. Keep 3-4 other apps open in background
3. Return to game
4. Play a full game (10 balls)
5. Close game
6. Return to game and play again

**Expected Results:**
- Game functions with minimal lag (FPS >30)
- No unexpected crashes
- Audio may be delayed slightly but plays
- Game cleanup properly on exit
- No memory leaks
- Second session starts cleanly
- No "Out of Memory" errors

**Duration:** ~2 minutes
**Device:** iPhone SE, iPad (older models)

---

### Scenario 2.6: Extreme Battery Saving Mode

**Preconditions:**
- Device in Low Power Mode
- Screen brightness low
- Background app refresh disabled

**Steps:**
1. Play full game in Low Power Mode
2. Monitor FPS (should be capped at 30)
3. Play 10 balls
4. Exit and re-enter game
5. Disable Low Power Mode
6. Verify FPS returns to 60

**Expected Results:**
- Game playable at 30 FPS (lower frame rate)
- No crashes
- Score calculated correctly
- Battery drain acceptable
- No visual glitches when switching modes
- Physics scaled appropriately for lower FPS

**Duration:** ~1.5 minutes
**Device:** All devices

---

## Performance Benchmarks

### Benchmark 3.1: Frame Rate (FPS)

**Target:** 60 FPS consistently, minimum 55 FPS

**Test Method:**
1. Start game session
2. Log frame timestamps every frame
3. Calculate FPS every second
4. Aggregate over 60 seconds of gameplay

**Acceptance Criteria:**
- 60 FPS ±5% for 95% of frames
- No frame drops below 30 FPS
- Average FPS ≥ 58
- Smooth scrolling and transitions

**Measurement Tools:**
- Xcode Instruments (Core Animation)
- Profile > Device Conditions
- Frame rate monitor overlay (in-game)

---

### Benchmark 3.2: Input Latency

**Target:** <100ms from tap to visual response

**Test Method:**
1. Tap screen at known timestamp (T1)
2. Measure timestamp of visual change (T2)
3. Calculate latency = T2 - T1
4. Repeat 20 times

**Acceptance Criteria:**
- Average latency <100ms
- Maximum latency <150ms
- No perceived delay to user

**Measurement Tools:**
- Slow-motion video (240fps) to measure exact timing
- Input event logging
- Graphics profiler

---

### Benchmark 3.3: Load Time

**Target:** <3 seconds from app launch to gameplay

| Stage | Target |
|-------|--------|
| App Launch → Main Menu | <1 second |
| Menu → Game Loading | <2 seconds total |
| Game Ready (first ball) | <3 seconds total |

**Test Method:**
1. Close app completely
2. Launch from icon
3. Measure time to each stage
4. Repeat 5 times, average results

**Acceptance Criteria:**
- Consistent load times
- No variation >500ms
- Loading spinner visible
- Progress indication provided

---

### Benchmark 3.4: Memory Usage

**Target:** Peak memory <300MB, average <200MB

**Test Method:**
1. Use Xcode Instruments Memory profiler
2. Monitor during:
   - App launch
   - Game loading
   - Peak gameplay (10 simultaneous sound effects)
   - Campaign progression
3. Measure peak and average

**Acceptance Criteria:**
- Peak <300MB on iPhone 11+
- Peak <250MB on iPhone SE
- Average stable at 150-200MB
- No continuous growth (memory leak)

---

### Benchmark 3.5: Battery Impact

**Target:** 15 minutes gameplay = <15% battery drain

**Test Method:**
1. Fully charge device
2. Play continuously for 15 minutes
3. Measure battery % change
4. Calculate percentage drain

**Acceptance Criteria:**
- <15% drain in 15 minutes (1% per minute)
- Consistent drain rate
- No rapid drain spikes
- On par with other game apps

---

## Memory Leak Detection

### Checklist 4.1: Object Cleanup

**Every Game Session:**
- [ ] Event listeners removed
- [ ] Audio nodes disposed
- [ ] Physics bodies cleaned up
- [ ] Textures unloaded
- [ ] Timers cleared
- [ ] Intervals cancelled

**Code Audit:**
```javascript
// BAD: Listener not removed
element.addEventListener('click', handler);

// GOOD: Listener removed on cleanup
element.addEventListener('click', handler);
cleanup(() => element.removeEventListener('click', handler));
```

### Checklist 4.2: Automated Leak Detection

**Run Before Release:**

```javascript
// Memory growth test
1. Start app
2. Play 10 consecutive games
3. Measure memory before and after
4. Memory growth should be <20MB
5. No monotonic growth over 10 cycles
```

**Tools:**
- Xcode Instruments: Allocations tab
- Memory Graph debugger
- Leaks instrument

### Checklist 4.3: Long Session Testing

**Test Duration:** 2 hours continuous gameplay

**Steps:**
1. Launch app
2. Play games continuously
3. Pause every 10 minutes for 30 seconds
4. Return to menu after 30 games
5. Restart campaign
6. Repeat

**Expected Results:**
- Memory stable throughout
- No crashes after 100+ games
- No audio degradation
- FPS consistent
- Leaderboard syncs correctly

---

## Cross-Device Testing Matrix

### Devices to Test (Priority Order)

| Device | iOS | Priority | Notes |
|--------|-----|----------|-------|
| iPhone 14 Pro | 17+ | HIGH | Flagship device |
| iPhone 13 | 16+ | HIGH | Primary market |
| iPhone 12 | 15+ | MEDIUM | Still common |
| iPhone SE (3rd) | 15+ | MEDIUM | Budget segment |
| iPhone 11 | 14+ | MEDIUM | Older but viable |
| iPad Pro 11" | 16+ | MEDIUM | Tablet experience |
| iPad (7th gen) | 14+ | LOW | Budget tablet |

### Test Coverage per Device

| Scenario | iPhone 14 Pro | iPhone 13 | iPhone SE | iPad | Notes |
|----------|---------------|-----------|-----------|------|-------|
| Scenario 1.1 | ✓ | ✓ | ✓ | ✓ | Basic gameplay |
| Scenario 2.1 | ✓ | ✓ | ~ | ✓ | Rapid tapping (SE slower) |
| Scenario 2.5 | ~ | ~ | ✓ | ~ | Low memory (SE focus) |
| Benchmark 3.2 | ✓ | ✓ | ~ | ✓ | Input latency |
| Benchmark 3.4 | ✓ | ✓ | ✓ | ~ | Memory (iPad higher) |

**Legend:** ✓ = Full test, ~ = Reduced scope, blank = Skip

---

## Test Execution Guide

### Pre-Test Checklist

- [ ] All devices updated to latest iOS
- [ ] App built in Release configuration
- [ ] Provisioning profiles valid
- [ ] No other apps being debugged
- [ ] WiFi stable (for network tests)
- [ ] Devices fully charged
- [ ] Backup any user data (testuser accounts)

### Test Run Procedure

1. **Create Test Account**
   ```
   Email: qa-tester-[date]@test.com
   No real payment info needed (test mode)
   ```

2. **Run Scenario**
   - Follow steps exactly
   - Document results in test log
   - Screenshot any anomalies
   - Note device/OS version

3. **Record Results**
   ```
   SCENARIO: 1.1 Single Player Cricket
   DEVICE: iPhone 13, iOS 16.2
   DATE: 2026-03-30
   RESULT: PASS / FAIL / PARTIAL
   NOTES: [Any issues encountered]
   DURATION: 2:15
   ```

4. **File Issues**
   - Use GitHub Issues template
   - Include reproduction steps
   - Attach screenshots/logs
   - Tag with `bug` label

### Test Reporting

**Summary Report Template:**

```markdown
# QA Test Report - v1.0.0
Date: 2026-03-30

## Coverage
- Scenarios Executed: 15/15
- Devices Tested: 6
- Total Test Time: 45 minutes

## Results
- PASS: 13 scenarios
- FAIL: 2 scenarios
- PARTIAL: 0 scenarios

## Critical Issues
- [Describe any blocking issues]

## Recommendations
- [Fixes before release]

## Sign-off
QA Lead: [Name]
Date: [Date]
```

---

## Appendix: Test Data

### Test Account Credentials (Local Testing)

```
Username: qa-test-player
Player ID: test-player-001
Convex Instance: test.convex.cloud
```

### Sample Test Scores

| Game | Level | Score | Duration | Notes |
|------|-------|-------|----------|-------|
| Cricket | 1 | 120 | 2:30 | Normal difficulty |
| Football | 3 | 85 | 3:00 | Hard difficulty |
| Baseball | 2 | 150 | 2:15 | Easy difficulty |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-30 | QA Team | Initial creation |

---

**Last Updated:** March 30, 2026
**Next Review:** June 30, 2026 (quarterly)

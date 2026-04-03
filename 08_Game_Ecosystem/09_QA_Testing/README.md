# QA & Testing Documentation

**Game Ecosystem Testing Framework**
Cricket AI 2026 | Football AI 2026 | Baseball AI 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Test Framework](#test-framework)
3. [Test Suites](#test-suites)
4. [Running Tests](#running-tests)
5. [Coverage Targets](#coverage-targets)
6. [CI Integration](#ci-integration)
7. [Bug Reporting](#bug-reporting)
8. [Performance Testing](#performance-testing)

---

## Overview

This directory contains all test suites and QA documentation for the Game Ecosystem. Tests are organized by type:

- **Unit Tests:** Core engine functionality
- **Integration Tests:** Game sessions and workflows
- **E2E Tests:** End-to-end scenarios and user flows

**Testing Philosophy:**
- No external dependencies (minimal test runner)
- Fast execution (<2 minutes for all unit tests)
- Clear failure messages
- Comprehensive coverage of critical paths

---

## Test Framework

### TestSuite Class (Zero Dependency)

Tests use a minimal custom test runner with no external dependencies:

```javascript
// unit/test-game-engine.js
const assert = require('assert');

class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✓ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${error.message}`);
        this.failed++;
      }
    }
  }
}
```

**Benefits:**
- No npm dependencies to install
- Runs with vanilla Node.js
- Clear, readable output
- Fast test execution
- Easy to debug failures

### Test Assertions

All tests use Node.js built-in `assert` module:

```javascript
// Equality
assert.strictEqual(actual, expected);

// Truthiness
assert(condition);
assert(condition, 'Error message');

// Type checking
assert(value instanceof Constructor);

// Throws
assert.throws(() => { functionThatErrors(); });
```

---

## Test Suites

### Unit Tests

Located in `unit/` directory. Test individual components in isolation.

#### test-game-engine.js
**Coverage:** Core game engine functionality

**Test Suites:**
- Entity Lifecycle (5 tests)
- State Machine (4 tests)
- Event System (6 tests)
- Game Loop Timing (7 tests)

**Key Tests:**
- Creating/destroying entities
- State transitions (IDLE → RUNNING → PAUSED → GAMEOVER)
- Event emission and history
- Frame timing and deltaTime calculation

```bash
node unit/test-game-engine.js
```

#### test-ai-engine.js
**Coverage:** AI decision-making system (4 phases)

**Test Suites:**
- Phase 1: Game State Analysis (5 tests)
- Phase 2: Player Modeling (4 tests)
- Phase 3: Predictive Modeling (4 tests)
- Phase 4: Circuit Breaker Safety (5 tests)
- Integration: Full Decision Cycle (6 tests)

**Key Tests:**
- Ball tracking and time-to-impact
- Player action history and aggression
- Prediction confidence
- Failure tolerance and circuit breaker

```bash
node unit/test-ai-engine.js
```

#### test-physics.js
**Coverage:** Physics simulation

**Test Suites:**
- Gravity (4 tests)
- Collision Detection (4 tests)
- Ball Trajectory (4 tests)
- Timing Windows (3 tests)
- Physics Objects (4 tests)
- Integration (3 tests)

**Key Tests:**
- Gravity acceleration
- Collision response and velocity exchange
- Parabolic trajectory calculation
- Impact time prediction
- Multiple object simulation

```bash
node unit/test-physics.js
```

#### test-audio.js
**Coverage:** Audio engine

**Test Suites:**
- Sound Generation (6 tests)
- Mute Toggle (5 tests)
- Volume Control (3 tests)
- iOS App Lifecycle (4 tests)
- Node Cleanup (4 tests)
- Sound Effects (3 tests)
- Integration (3 tests)

**Key Tests:**
- Sound registration and playback
- Mute/unmute behavior
- Master volume control
- iOS suspend/resume handling
- Memory cleanup of audio nodes

```bash
node unit/test-audio.js
```

### Integration Tests

Located in `integration/` directory. Test complete workflows and systems together.

#### test-game-session.js
**Coverage:** Full game session lifecycle

**Test Suites:**
- Single Player Game Session (8 tests)
- Campaign Level Progression (5 tests)
- Multiplayer Room Lifecycle (10 tests)
- Integration: Full Game Flow (4 tests)

**Key Tests:**
- Menu → Loading → Playing → Score → Gameover flow
- Campaign level unlocking and progression
- Multiplayer room creation and player management
- Score calculation and accuracy tracking
- Event tracking throughout session

```bash
node integration/test-game-session.js
```

### E2E Tests

Located in `e2e/` directory. Real-world scenario testing.

#### test-scenarios.md
**Coverage:** End-to-end user scenarios and edge cases

**Scenarios:**
- 5 Happy Path Scenarios (complete user flows)
- 6 Edge Cases & Stress Tests
- 5 Performance Benchmarks
- Memory Leak Detection Checklist
- Cross-Device Testing Matrix

**Key Scenarios:**
- Complete single-player game (each sport)
- Campaign progression
- VIP subscription purchase
- Multiplayer match
- Leaderboard viewing
- Rapid tapping stress test
- Orientation changes
- Background/foreground transitions
- Network loss handling
- Low memory conditions
- Battery saving mode

---

## Running Tests

### Run All Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Or manually
node unit/test-game-engine.js
node unit/test-ai-engine.js
node unit/test-physics.js
node unit/test-audio.js
```

### Run Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Or manually
node integration/test-game-session.js
```

### Run Specific Test Suite

```bash
# Just game engine tests
node unit/test-game-engine.js

# Just AI engine tests
node unit/test-ai-engine.js
```

### Watch Mode (Auto-rerun on file changes)

```bash
# Install nodemon first
npm install --save-dev nodemon

# Watch and rerun tests
nodemon unit/test-game-engine.js
```

### Test Output Example

```
=== Entity Lifecycle ===

✓ Create entity should add to engine
✓ Destroy entity should remove from engine
✓ Entity should support components
✓ Multiple entities can coexist

=== State Machine ===

✓ Initial state should be IDLE
✓ setState should transition states
✓ Should transition through valid states
✓ setGameOver should set correct state

==================================================
TOTAL: 32 passed, 0 failed
==================================================
```

---

## Coverage Targets

### Code Coverage Goals

| Category | Target | Status |
|----------|--------|--------|
| Game Engine | 95% | Unit Tests |
| AI Engine | 90% | Unit + Integration Tests |
| Physics | 90% | Unit Tests |
| Audio | 85% | Unit Tests |
| Game Sessions | 100% | Integration Tests |
| **Overall** | **90%** | Measured by npm coverage |

### Coverage Measurement

```bash
# Run tests with coverage report
npm run test:coverage

# Generate HTML report
npm run coverage:html

# View report
open coverage/index.html
```

### Critical Paths Coverage

**Must have 100% test coverage:**
- Game over conditions
- Score calculation
- State transitions
- Payment/subscription flows
- Data persistence
- Leaderboard sync

**Must have 95%+ coverage:**
- Game mechanics
- AI decision-making
- Physics calculations
- Audio playback

---

## CI Integration

### GitHub Actions

Tests run automatically on every push via `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - uses: codecov/codecov-action@v3
```

### Pre-commit Hook

Tests run before every commit:

```bash
#!/bin/sh
# .husky/pre-commit

npm run test:unit || exit 1
```

### Release Checklist

Before deploying to App Store:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E scenarios executed on 3+ devices
- [ ] Coverage ≥90%
- [ ] No known bugs in critical path
- [ ] Performance benchmarks met
- [ ] Memory leak check passed

---

## Bug Reporting

### Bug Report Template

Create a new GitHub Issue using this template:

```markdown
## Title
[Brief description of bug]

## Severity
- [ ] Critical (prevents gameplay)
- [ ] High (major feature broken)
- [ ] Medium (feature degraded)
- [ ] Low (cosmetic/minor)

## Reproduction Steps
1. [First step]
2. [Second step]
3. [Expected result]

## Actual Result
[What actually happens]

## Device & OS
- Device: iPhone 13
- iOS: 16.2
- App Version: 1.0.0

## Logs
[Any error messages or logs]

## Screenshots/Video
[If applicable]

## Notes
[Additional context]
```

### Bug Severity Levels

| Level | Impact | Fix Timeline |
|-------|--------|--------------|
| Critical | Game unplayable, data loss, crash | Immediate (24h) |
| High | Core feature broken, score lost | ASAP (48h) |
| Medium | Feature partially broken, workaround exists | Next release (1 week) |
| Low | Cosmetic, minor issue | Next major release |

### Defect Tracking

Bugs tracked in GitHub Issues with labels:

- `bug` - Software defect
- `critical` - Blocking issue
- `ios` - iOS platform specific
- `web` - Web platform specific
- `ai` - AI system related
- `physics` - Physics engine related
- `audio` - Audio system related
- `performance` - Performance regression
- `memory-leak` - Memory issue

---

## Performance Testing

### Running Performance Benchmarks

```bash
npm run benchmark

# Individual benchmarks
npm run benchmark:fps
npm run benchmark:latency
npm run benchmark:memory
npm run benchmark:battery
```

### FPS Monitoring (In-Game)

Add FPS overlay to detect performance issues:

```javascript
// Enable FPS counter in game
localStorage.setItem('DEBUG_FPS', 'true');

// Disable
localStorage.setItem('DEBUG_FPS', 'false');
```

### Memory Profiling

```bash
# Generate memory snapshot
npm run profile:memory

# Analyze allocation growth
npm run profile:growth

# Detect leaks
npm run profile:leaks
```

### Battery Testing

Monitor battery usage during gameplay:

1. Fully charge device
2. Play game for 15 minutes
3. Compare battery percentage
4. Target: <15% drain

```bash
# Enable battery logging
localStorage.setItem('DEBUG_BATTERY', 'true');
```

---

## Test Data & Fixtures

### Mock Objects

Located in each test file. No external files needed:

```javascript
// GameEngine mock (built into test file)
class GameEngine {
  constructor() { }
  createEntity(id) { }
  // ... etc
}

// No separate fixture files required
// All data defined inline
```

### Test Accounts

For manual testing:

```
Email: qa-test-1@test.com
Player ID: test-player-001
Password: TestPass123
```

### Sample Game States

Built into each test:

```javascript
const gameState = {
  ball: { x: 100, y: 100, vx: 5, vy: 0 },
  player: { x: 50, y: 100 },
};

const session = new GameSession('player1', 'cricket');
```

---

## Troubleshooting

### Tests Hang

**Problem:** Test runner appears to hang

**Solution:**
- Check for infinite loops in mock objects
- Verify all async operations complete
- Check setTimeout/setInterval cleanup

```bash
# Run with timeout
timeout 30 node unit/test-game-engine.js
```

### Assertion Failures

**Problem:** Test fails with "AssertionError"

**Solution:**
- Read error message carefully
- Add console.log for debugging
- Check equality: `===` vs `==`
- Verify mock object state

```javascript
// Add debugging
console.log('Expected:', expected);
console.log('Actual:', actual);
assert.strictEqual(actual, expected);
```

### Memory Issues

**Problem:** Tests consume too much memory

**Solution:**
- Reduce iterations in stress tests
- Clear mock objects between tests
- Check for memory leaks in mocks

---

## Best Practices

### Writing New Tests

1. **Name clearly**
   ```javascript
   // Good
   test('Should calculate accuracy from hits and misses', () => {});

   // Bad
   test('Test calculation', () => {});
   ```

2. **Test one thing**
   ```javascript
   // Good: Tests single behavior
   test('Should increase velocity on gravity', () => {});

   // Bad: Tests multiple things
   test('Should handle gravity, collision, and scoring', () => {});
   ```

3. **Use descriptive assertions**
   ```javascript
   // Good
   assert.strictEqual(score, 100, 'Score should be 100 after 10 hits');

   // Bad
   assert(score === 100);
   ```

4. **Isolate tests**
   ```javascript
   // Good: Each test is independent
   test('Test 1', () => {
     const engine = new GameEngine();
     // ... test logic
   });

   test('Test 2', () => {
     const engine = new GameEngine(); // Fresh instance
     // ... test logic
   });
   ```

### Debugging Tests

```bash
# Run with debug output
DEBUG=* node unit/test-game-engine.js

# Run single test (manually edit file)
node -e "
  const test = require('./unit/test-game-engine.js');
  // Run specific test
"
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-30 | QA Team | Initial test framework |

---

## Support & Contact

**QA Lead:** qa@alpittare.com
**Test Framework Issues:** GitHub Issues with `testing` label
**Performance Questions:** github.com/alpittare/[game]/discussions

---

**Last Updated:** March 30, 2026
**Next Major Version:** v2.0 (Q4 2026)

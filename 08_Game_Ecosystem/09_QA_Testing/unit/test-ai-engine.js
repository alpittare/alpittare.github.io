/**
 * AI Engine Unit Tests
 * Tests all 4 phases of AI decision-making
 *
 * Run: node test-ai-engine.js
 */

const assert = require('assert');

// Minimal test runner
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
    console.log(`\n=== ${this.name} ===\n`);
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

// ============================================================================
// Mock AI Engine (4-Phase System)
// ============================================================================

class AIEngine {
  constructor() {
    this.difficulty = 'normal'; // easy, normal, hard
    this.decisionHistory = [];
    this.playerModel = null;
    this.phase1Decisions = {};
    this.circuitBreaker = {
      enabled: true,
      failureCount: 0,
      failureThreshold: 5,
      isTripped: false,
    };
  }

  // ========== Phase 1: Game State Analysis ==========
  analyzeGameState(gameState) {
    const analysis = {
      ballPosition: {
        x: gameState.ball?.x || 0,
        y: gameState.ball?.y || 0,
      },
      playerPosition: {
        x: gameState.player?.x || 0,
        y: gameState.player?.y || 0,
      },
      ballVelocity: {
        x: gameState.ball?.vx || 0,
        y: gameState.ball?.vy || 0,
      },
      timeToImpact: this._calculateTimeToImpact(gameState),
      ballInRange: this._isBallInRange(gameState),
    };

    this.phase1Decisions[Date.now()] = analysis;
    return analysis;
  }

  _calculateTimeToImpact(gameState) {
    if (!gameState.ball) return 999;
    const distance = Math.sqrt(
      Math.pow(gameState.ball.x - gameState.player?.x || 0, 2) +
      Math.pow(gameState.ball.y - gameState.player?.y || 0, 2)
    );
    const speed = Math.sqrt(
      Math.pow(gameState.ball.vx || 0, 2) +
      Math.pow(gameState.ball.vy || 0, 2)
    );
    return speed > 0 ? distance / speed : 999;
  }

  _isBallInRange(gameState) {
    if (!gameState.ball || !gameState.player) return false;
    const distance = Math.sqrt(
      Math.pow(gameState.ball.x - gameState.player.x, 2) +
      Math.pow(gameState.ball.y - gameState.player.y, 2)
    );
    return distance < 200;
  }

  // ========== Phase 2: Player Model ==========
  updatePlayerModel(playerActions) {
    if (!this.playerModel) {
      this.playerModel = {
        aggression: 0.5,
        accuracy: 0.5,
        reactionTime: 200,
        actionHistory: [],
        decisionCount: 0,
      };
    }

    // Track player actions
    this.playerModel.actionHistory.push(playerActions);
    this.playerModel.decisionCount++;

    // Calculate aggression (actions per second)
    const recentActions = this.playerModel.actionHistory.slice(-10);
    this.playerModel.aggression = Math.min(1.0, recentActions.length / 10);

    // Calculate accuracy (successful hits / attempts)
    const hits = recentActions.filter(a => a.success).length;
    this.playerModel.accuracy = recentActions.length > 0 ? hits / recentActions.length : 0.5;

    return this.playerModel;
  }

  getPlayerModel() {
    return this.playerModel || {
      aggression: 0.5,
      accuracy: 0.5,
      reactionTime: 200,
    };
  }

  // ========== Phase 3: Predictive Modeling ==========
  predictPlayerNextAction(currentGameState) {
    const model = this.getPlayerModel();

    // Predict next position based on player model
    const predictedX = currentGameState.player?.x || 0 + (model.aggression * 50);
    const predictedY = currentGameState.player?.y || 0 + (model.aggression * 50);

    const prediction = {
      predictedPosition: { x: predictedX, y: predictedY },
      confidence: model.accuracy,
      difficulty: this.difficulty,
      timestamp: Date.now(),
    };

    return prediction;
  }

  // ========== Phase 4: Circuit Breaker (Safety) ==========
  recordDecisionFailure() {
    this.circuitBreaker.failureCount++;
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.isTripped = true;
    }
  }

  recordDecisionSuccess() {
    // Decay failure count on success
    this.circuitBreaker.failureCount = Math.max(0, this.circuitBreaker.failureCount - 1);
  }

  isCircuitBreakerTripped() {
    return this.circuitBreaker.isTripped;
  }

  resetCircuitBreaker() {
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.isTripped = false;
  }

  // ========== Main Decision Function ==========
  makeDecision(gameState) {
    // Check circuit breaker
    if (this.circuitBreaker.isTripped) {
      return { action: 'default', reason: 'circuit_breaker_tripped' };
    }

    // Phase 1: Analyze
    const analysis = this.analyzeGameState(gameState);

    // Phase 2: Player Model
    const playerModel = this.getPlayerModel();

    // Phase 3: Predict
    const prediction = this.predictPlayerNextAction(gameState);

    // Phase 4: Decide (with fallback)
    let decision;
    try {
      decision = {
        action: analysis.ballInRange ? 'swing' : 'move',
        target: analysis.ballPosition,
        confidence: prediction.confidence,
        analysis,
        prediction,
      };
      this.recordDecisionSuccess();
    } catch (error) {
      decision = { action: 'default', error: error.message };
      this.recordDecisionFailure();
    }

    this.decisionHistory.push(decision);
    return decision;
  }

  setDifficulty(level) {
    assert(['easy', 'normal', 'hard'].includes(level));
    this.difficulty = level;
  }

  getDecisionHistory() {
    return this.decisionHistory;
  }
}

// ============================================================================
// Test Suites
// ============================================================================

// Phase 1: Game State Analysis
const phase1Tests = new TestSuite('Phase 1: Game State Analysis');

phase1Tests.test('Should analyze ball position', () => {
  const ai = new AIEngine();
  const gameState = {
    ball: { x: 100, y: 200, vx: 5, vy: -3 },
    player: { x: 50, y: 100 },
  };

  const analysis = ai.analyzeGameState(gameState);
  assert.strictEqual(analysis.ballPosition.x, 100);
  assert.strictEqual(analysis.ballPosition.y, 200);
});

phase1Tests.test('Should calculate time to impact', () => {
  const ai = new AIEngine();
  const gameState = {
    ball: { x: 100, y: 100, vx: 10, vy: 0 },
    player: { x: 50, y: 100 },
  };

  const analysis = ai.analyzeGameState(gameState);
  assert(analysis.timeToImpact < 999);
  assert(analysis.timeToImpact > 0);
});

phase1Tests.test('Should detect if ball in range', () => {
  const ai = new AIEngine();
  const gameState = {
    ball: { x: 50, y: 100, vx: 0, vy: 0 },
    player: { x: 50, y: 100 },
  };

  const analysis = ai.analyzeGameState(gameState);
  assert.strictEqual(analysis.ballInRange, true);
});

phase1Tests.test('Should handle missing game state', () => {
  const ai = new AIEngine();
  const analysis = ai.analyzeGameState({});

  assert.strictEqual(analysis.ballPosition.x, 0);
  assert.strictEqual(analysis.ballInRange, false);
});

phase1Tests.test('Should track analysis history', () => {
  const ai = new AIEngine();
  ai.analyzeGameState({ ball: { x: 10, y: 20 } });
  ai.analyzeGameState({ ball: { x: 20, y: 30 } });

  assert.strictEqual(Object.keys(ai.phase1Decisions).length, 2);
});

// Phase 2: Player Modeling
const phase2Tests = new TestSuite('Phase 2: Player Modeling');

phase2Tests.test('Should initialize player model', () => {
  const ai = new AIEngine();
  const model = ai.getPlayerModel();

  assert(model.aggression >= 0 && model.aggression <= 1);
  assert(model.accuracy >= 0 && model.accuracy <= 1);
  assert(model.reactionTime > 0);
});

phase2Tests.test('Should track player actions', () => {
  const ai = new AIEngine();
  const actions = { success: true, type: 'swing' };

  ai.updatePlayerModel(actions);
  const model = ai.getPlayerModel();

  assert.strictEqual(model.actionHistory.length, 1);
  assert.strictEqual(model.decisionCount, 1);
});

phase2Tests.test('Should calculate aggression from action history', () => {
  const ai = new AIEngine();

  // Add multiple actions
  for (let i = 0; i < 5; i++) {
    ai.updatePlayerModel({ success: true, type: 'swing' });
  }

  const model = ai.getPlayerModel();
  assert(model.aggression > 0);
});

phase2Tests.test('Should calculate accuracy from hit ratio', () => {
  const ai = new AIEngine();

  ai.updatePlayerModel({ success: true });
  ai.updatePlayerModel({ success: true });
  ai.updatePlayerModel({ success: false });

  const model = ai.getPlayerModel();
  assert.strictEqual(model.accuracy, 2 / 3);
});

// Phase 3: Predictive Modeling
const phase3Tests = new TestSuite('Phase 3: Predictive Modeling');

phase3Tests.test('Should predict player next action', () => {
  const ai = new AIEngine();
  const gameState = { player: { x: 100, y: 100 } };

  const prediction = ai.predictPlayerNextAction(gameState);
  assert(prediction.predictedPosition);
  assert(prediction.confidence >= 0 && prediction.confidence <= 1);
});

phase3Tests.test('Prediction should include difficulty', () => {
  const ai = new AIEngine();
  ai.setDifficulty('hard');

  const prediction = ai.predictPlayerNextAction({});
  assert.strictEqual(prediction.difficulty, 'hard');
});

phase3Tests.test('Aggression should affect prediction', () => {
  const ai = new AIEngine();
  ai.playerModel = { aggression: 1.0, accuracy: 0.5 };

  const prediction = ai.predictPlayerNextAction({ player: { x: 0, y: 0 } });
  // High aggression should predict larger movement
  assert(prediction.predictedPosition.x > 0 || prediction.predictedPosition.y > 0);
});

phase3Tests.test('Confidence should reflect model accuracy', () => {
  const ai = new AIEngine();
  ai.playerModel = { accuracy: 0.9 };

  const prediction = ai.predictPlayerNextAction({});
  assert.strictEqual(prediction.confidence, 0.9);
});

// Phase 4: Circuit Breaker
const phase4Tests = new TestSuite('Phase 4: Circuit Breaker (Safety)');

phase4Tests.test('Circuit breaker should be enabled by default', () => {
  const ai = new AIEngine();
  assert.strictEqual(ai.circuitBreaker.enabled, true);
  assert.strictEqual(ai.isCircuitBreakerTripped(), false);
});

phase4Tests.test('Should track decision failures', () => {
  const ai = new AIEngine();
  ai.recordDecisionFailure();
  ai.recordDecisionFailure();

  assert.strictEqual(ai.circuitBreaker.failureCount, 2);
});

phase4Tests.test('Should trip after threshold failures', () => {
  const ai = new AIEngine();

  for (let i = 0; i < 5; i++) {
    ai.recordDecisionFailure();
  }

  assert.strictEqual(ai.isCircuitBreakerTripped(), true);
});

phase4Tests.test('Should decay failures on success', () => {
  const ai = new AIEngine();
  ai.recordDecisionFailure();
  ai.recordDecisionFailure();
  ai.recordDecisionSuccess();

  assert.strictEqual(ai.circuitBreaker.failureCount, 1);
});

phase4Tests.test('Should reset circuit breaker', () => {
  const ai = new AIEngine();
  ai.recordDecisionFailure();
  ai.recordDecisionFailure();
  ai.resetCircuitBreaker();

  assert.strictEqual(ai.circuitBreaker.failureCount, 0);
  assert.strictEqual(ai.isCircuitBreakerTripped(), false);
});

// Integration: Full Decision Making
const integrationTests = new TestSuite('Integration: Full Decision Cycle');

integrationTests.test('Should make complete decision', () => {
  const ai = new AIEngine();
  const gameState = {
    ball: { x: 100, y: 100, vx: 5, vy: 0 },
    player: { x: 50, y: 100 },
  };

  const decision = ai.makeDecision(gameState);
  assert(decision.action);
  assert(decision.analysis);
  assert(decision.prediction);
});

integrationTests.test('Should return default action when circuit breaker tripped', () => {
  const ai = new AIEngine();
  ai.circuitBreaker.isTripped = true;

  const decision = ai.makeDecision({ ball: { x: 100 }, player: { x: 50 } });
  assert.strictEqual(decision.reason, 'circuit_breaker_tripped');
});

integrationTests.test('Should track decision history', () => {
  const ai = new AIEngine();

  ai.makeDecision({ ball: { x: 100 }, player: { x: 50 } });
  ai.makeDecision({ ball: { x: 110 }, player: { x: 60 } });

  assert.strictEqual(ai.getDecisionHistory().length, 2);
});

integrationTests.test('Should handle difficulty levels', () => {
  const ai = new AIEngine();

  ai.setDifficulty('easy');
  assert.strictEqual(ai.difficulty, 'easy');

  ai.setDifficulty('hard');
  assert.strictEqual(ai.difficulty, 'hard');
});

integrationTests.test('Should swing when ball in range', () => {
  const ai = new AIEngine();
  const gameState = {
    ball: { x: 50, y: 100 },
    player: { x: 50, y: 100 },
  };

  const decision = ai.makeDecision(gameState);
  assert.strictEqual(decision.action, 'swing');
});

integrationTests.test('Should move when ball out of range', () => {
  const ai = new AIEngine();
  const gameState = {
    ball: { x: 1000, y: 1000 },
    player: { x: 50, y: 100 },
  };

  const decision = ai.makeDecision(gameState);
  assert.strictEqual(decision.action, 'move');
});

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  const suites = [
    phase1Tests,
    phase2Tests,
    phase3Tests,
    phase4Tests,
    integrationTests,
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    await suite.run();
    totalPassed += suite.passed;
    totalFailed += suite.failed;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('='.repeat(50));

  process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});

/**
 * GameEngine Unit Tests
 * Tests core game engine functionality: entity lifecycle, state machine, events, game loop
 *
 * Run: node test-game-engine.js
 */

const assert = require('assert');

// Minimal test runner (no external dependencies)
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
    console.log(`\nPassed: ${this.passed}/${this.tests.length}\n`);
  }
}

// ============================================================================
// Mock GameEngine Class (simplified for testing)
// ============================================================================

class Entity {
  constructor(id, type) {
    this.id = id;
    this.type = type;
    this.active = true;
    this.components = {};
  }

  addComponent(name, component) {
    this.components[name] = component;
  }

  getComponent(name) {
    return this.components[name];
  }
}

class GameEngine {
  constructor() {
    this.entities = new Map();
    this.state = 'IDLE'; // IDLE, RUNNING, PAUSED, GAMEOVER
    this.deltaTime = 0;
    this.totalTime = 0;
    this.events = [];
    this.eventListeners = new Map();
    this.frameRate = 60;
    this.isRunning = false;
  }

  // ========== Entity Management ==========
  createEntity(id, type) {
    const entity = new Entity(id, type);
    this.entities.set(id, entity);
    this.emit('entity:created', { id, type });
    return entity;
  }

  getEntity(id) {
    return this.entities.get(id);
  }

  destroyEntity(id) {
    const entity = this.entities.get(id);
    if (entity) {
      entity.active = false;
      this.entities.delete(id);
      this.emit('entity:destroyed', { id });
    }
  }

  // ========== State Management ==========
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.emit('state:changed', { oldState, newState });
  }

  getState() {
    return this.state;
  }

  // ========== Event System ==========
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  off(event, listener) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data = {}) {
    const listeners = this.eventListeners.get(event) || [];
    this.events.push({ event, data, timestamp: this.totalTime });
    listeners.forEach(listener => listener(data));
  }

  getEventHistory(event) {
    return this.events.filter(e => e.event === event);
  }

  clearEventHistory() {
    this.events = [];
  }

  // ========== Game Loop ==========
  start() {
    this.isRunning = true;
    this.setState('RUNNING');
    this.emit('game:started');
  }

  stop() {
    this.isRunning = false;
    this.setState('IDLE');
    this.emit('game:stopped');
  }

  pause() {
    this.setState('PAUSED');
    this.emit('game:paused');
  }

  resume() {
    this.setState('RUNNING');
    this.emit('game:resumed');
  }

  update(deltaTime) {
    if (!this.isRunning) return;

    this.deltaTime = deltaTime;
    this.totalTime += deltaTime;

    // Update all active entities
    this.entities.forEach(entity => {
      if (entity.active && entity.components.transform) {
        // Simulate position update
        entity.components.transform.update(deltaTime);
      }
    });

    this.emit('game:update', { deltaTime, totalTime: this.totalTime });
  }

  getGameOverState() {
    return this.state === 'GAMEOVER';
  }

  setGameOver() {
    this.setState('GAMEOVER');
    this.isRunning = false;
    this.emit('game:over');
  }
}

// ============================================================================
// Test Suites
// ============================================================================

// Test: Entity Lifecycle
const entityLifecycleTests = new TestSuite('Entity Lifecycle');

entityLifecycleTests.test('Create entity should add to engine', () => {
  const engine = new GameEngine();
  const entity = engine.createEntity('player1', 'player');

  assert.strictEqual(engine.getEntity('player1'), entity);
  assert.strictEqual(entity.id, 'player1');
  assert.strictEqual(entity.type, 'player');
  assert.strictEqual(entity.active, true);
});

entityLifecycleTests.test('Destroy entity should remove from engine', () => {
  const engine = new GameEngine();
  engine.createEntity('player1', 'player');
  engine.destroyEntity('player1');

  assert.strictEqual(engine.getEntity('player1'), undefined);
});

entityLifecycleTests.test('Entity should support components', () => {
  const engine = new GameEngine();
  const entity = engine.createEntity('ball1', 'ball');

  const positionComponent = { x: 0, y: 0 };
  entity.addComponent('position', positionComponent);

  assert.strictEqual(entity.getComponent('position'), positionComponent);
});

entityLifecycleTests.test('Multiple entities can coexist', () => {
  const engine = new GameEngine();
  engine.createEntity('player', 'player');
  engine.createEntity('ball', 'ball');
  engine.createEntity('obstacle', 'obstacle');

  assert.strictEqual(engine.entities.size, 3);
});

// Test: State Machine
const stateMachineTests = new TestSuite('State Machine');

stateMachineTests.test('Initial state should be IDLE', () => {
  const engine = new GameEngine();
  assert.strictEqual(engine.getState(), 'IDLE');
});

stateMachineTests.test('setState should transition states', () => {
  const engine = new GameEngine();
  engine.setState('RUNNING');
  assert.strictEqual(engine.getState(), 'RUNNING');
});

stateMachineTests.test('Should transition through valid states', () => {
  const engine = new GameEngine();
  engine.setState('RUNNING');
  assert.strictEqual(engine.getState(), 'RUNNING');

  engine.setState('PAUSED');
  assert.strictEqual(engine.getState(), 'PAUSED');

  engine.setState('RUNNING');
  assert.strictEqual(engine.getState(), 'RUNNING');

  engine.setState('GAMEOVER');
  assert.strictEqual(engine.getState(), 'GAMEOVER');
});

stateMachineTests.test('setGameOver should set correct state', () => {
  const engine = new GameEngine();
  engine.start();
  engine.setGameOver();

  assert.strictEqual(engine.getGameOverState(), true);
  assert.strictEqual(engine.getState(), 'GAMEOVER');
  assert.strictEqual(engine.isRunning, false);
});

// Test: Event System
const eventSystemTests = new TestSuite('Event System');

eventSystemTests.test('Should emit and receive events', () => {
  const engine = new GameEngine();
  let received = false;
  let eventData = null;

  engine.on('test:event', (data) => {
    received = true;
    eventData = data;
  });

  engine.emit('test:event', { value: 42 });

  assert.strictEqual(received, true);
  assert.strictEqual(eventData.value, 42);
});

eventSystemTests.test('Multiple listeners should all receive event', () => {
  const engine = new GameEngine();
  let count = 0;

  engine.on('test:event', () => count++);
  engine.on('test:event', () => count++);
  engine.on('test:event', () => count++);

  engine.emit('test:event');

  assert.strictEqual(count, 3);
});

eventSystemTests.test('off should remove event listener', () => {
  const engine = new GameEngine();
  let count = 0;

  const listener = () => count++;
  engine.on('test:event', listener);
  engine.emit('test:event');

  engine.off('test:event', listener);
  engine.emit('test:event');

  assert.strictEqual(count, 1);
});

eventSystemTests.test('Entity creation should emit event', () => {
  const engine = new GameEngine();
  const history = [];

  engine.on('entity:created', (data) => history.push(data));
  engine.createEntity('player1', 'player');

  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].id, 'player1');
  assert.strictEqual(history[0].type, 'player');
});

eventSystemTests.test('Entity destruction should emit event', () => {
  const engine = new GameEngine();
  engine.createEntity('player1', 'player');

  const history = [];
  engine.on('entity:destroyed', (data) => history.push(data));
  engine.destroyEntity('player1');

  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].id, 'player1');
});

eventSystemTests.test('Should track event history', () => {
  const engine = new GameEngine();
  engine.emit('test:event', { value: 1 });
  engine.emit('test:event', { value: 2 });
  engine.emit('other:event', { value: 3 });

  const testEvents = engine.getEventHistory('test:event');
  assert.strictEqual(testEvents.length, 2);
  assert.strictEqual(testEvents[0].data.value, 1);
  assert.strictEqual(testEvents[1].data.value, 2);
});

// Test: Game Loop Timing
const gameLoopTests = new TestSuite('Game Loop Timing');

gameLoopTests.test('Game should start and run', () => {
  const engine = new GameEngine();
  engine.start();

  assert.strictEqual(engine.isRunning, true);
  assert.strictEqual(engine.getState(), 'RUNNING');
});

gameLoopTests.test('Game should stop', () => {
  const engine = new GameEngine();
  engine.start();
  engine.stop();

  assert.strictEqual(engine.isRunning, false);
  assert.strictEqual(engine.getState(), 'IDLE');
});

gameLoopTests.test('Game should pause and resume', () => {
  const engine = new GameEngine();
  engine.start();
  engine.pause();

  assert.strictEqual(engine.getState(), 'PAUSED');

  engine.resume();
  assert.strictEqual(engine.getState(), 'RUNNING');
});

gameLoopTests.test('Update should track deltaTime and totalTime', () => {
  const engine = new GameEngine();
  engine.start();

  engine.update(0.016); // ~60 FPS
  assert.strictEqual(engine.deltaTime, 0.016);
  assert.strictEqual(engine.totalTime, 0.016);

  engine.update(0.016);
  assert.strictEqual(engine.deltaTime, 0.016);
  assert.strictEqual(engine.totalTime, 0.032);
});

gameLoopTests.test('Update should not progress if not running', () => {
  const engine = new GameEngine();
  engine.update(0.016);

  assert.strictEqual(engine.totalTime, 0);
  assert.strictEqual(engine.deltaTime, 0);
});

gameLoopTests.test('Game loop should emit update events', () => {
  const engine = new GameEngine();
  const updateEvents = [];

  engine.on('game:update', (data) => updateEvents.push(data));
  engine.start();
  engine.update(0.016);

  assert.strictEqual(updateEvents.length, 1);
  assert.strictEqual(updateEvents[0].deltaTime, 0.016);
});

gameLoopTests.test('Should track state transitions', () => {
  const engine = new GameEngine();
  const stateChanges = [];

  engine.on('state:changed', (data) => stateChanges.push(data));
  engine.setState('RUNNING');
  engine.setState('PAUSED');
  engine.setState('RUNNING');

  assert.strictEqual(stateChanges.length, 3);
  assert.strictEqual(stateChanges[0].newState, 'RUNNING');
  assert.strictEqual(stateChanges[1].newState, 'PAUSED');
  assert.strictEqual(stateChanges[2].newState, 'RUNNING');
});

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  const suites = [
    entityLifecycleTests,
    stateMachineTests,
    eventSystemTests,
    gameLoopTests,
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    await suite.run();
    totalPassed += suite.passed;
    totalFailed += suite.failed;
  }

  console.log('='.repeat(50));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('='.repeat(50));

  process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});

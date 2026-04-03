/**
 * Physics Engine Unit Tests
 * Tests gravity, collision detection, ball trajectory, and timing windows
 *
 * Run: node test-physics.js
 */

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
// Mock Physics Engine
// ============================================================================

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  distance(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

class PhysicsObject {
  constructor(id, x, y, mass = 1, radius = 10) {
    this.id = id;
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.acceleration = new Vector2(0, 0);
    this.mass = mass;
    this.radius = radius;
    this.active = true;
  }

  applyForce(force) {
    this.acceleration.x += force.x / this.mass;
    this.acceleration.y += force.y / this.mass;
  }

  update(deltaTime) {
    // v = v + a*dt
    this.velocity.x += this.acceleration.x * deltaTime;
    this.velocity.y += this.acceleration.y * deltaTime;

    // p = p + v*dt
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    // Reset acceleration each frame
    this.acceleration.x = 0;
    this.acceleration.y = 0;
  }
}

class PhysicsEngine {
  constructor() {
    this.gravity = new Vector2(0, 9.8); // m/s^2
    this.objects = new Map();
    this.collisions = [];
    this.dampening = 0.99; // Energy loss on collision
  }

  // ========== Gravity ==========
  applyGravity(deltaTime) {
    this.objects.forEach(obj => {
      if (obj.active) {
        const gravityForce = new Vector2(
          this.gravity.x * obj.mass,
          this.gravity.y * obj.mass
        );
        obj.applyForce(gravityForce);
      }
    });
  }

  // ========== Collision Detection ==========
  checkCollisions() {
    this.collisions = [];
    const objArray = Array.from(this.objects.values());

    for (let i = 0; i < objArray.length; i++) {
      for (let j = i + 1; j < objArray.length; j++) {
        if (this._isColliding(objArray[i], objArray[j])) {
          const collision = {
            obj1: objArray[i].id,
            obj2: objArray[j].id,
            distance: objArray[i].position.distance(objArray[j].position),
          };
          this.collisions.push(collision);
          this._resolveCollision(objArray[i], objArray[j]);
        }
      }
    }

    return this.collisions;
  }

  _isColliding(obj1, obj2) {
    const distance = obj1.position.distance(obj2.position);
    return distance < (obj1.radius + obj2.radius);
  }

  _resolveCollision(obj1, obj2) {
    // Reflect velocity on collision
    const temp = obj1.velocity.x;
    obj1.velocity.x = obj2.velocity.x * this.dampening;
    obj2.velocity.x = temp * this.dampening;

    const temp2 = obj1.velocity.y;
    obj1.velocity.y = obj2.velocity.y * this.dampening;
    obj2.velocity.y = temp2 * this.dampening;
  }

  // ========== Ball Trajectory ==========
  calculateTrajectory(startPos, velocity, duration, steps = 10) {
    const trajectory = [startPos];
    let pos = new Vector2(startPos.x, startPos.y);
    let vel = new Vector2(velocity.x, velocity.y);
    const dt = duration / steps;

    for (let i = 0; i < steps; i++) {
      vel.y += this.gravity.y * dt;
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      trajectory.push(new Vector2(pos.x, pos.y));
    }

    return trajectory;
  }

  // ========== Timing Windows ==========
  calculateImpactTime(ballPos, ballVel) {
    // Simple: time when ball reaches y=0
    if (ballVel.y >= 0) return null; // Not falling

    const timeToGround = (-ballPos.y) / (ballVel.y + this.gravity.y * 0.5);
    return Math.max(0, timeToGround);
  }

  // ========== Object Management ==========
  addObject(id, obj) {
    this.objects.set(id, obj);
  }

  removeObject(id) {
    this.objects.delete(id);
  }

  getObject(id) {
    return this.objects.get(id);
  }

  // ========== Simulation Step ==========
  update(deltaTime) {
    this.applyGravity(deltaTime);

    this.objects.forEach(obj => {
      if (obj.active) {
        obj.update(deltaTime);
      }
    });

    this.checkCollisions();
  }
}

// ============================================================================
// Test Suites
// ============================================================================

// Gravity Tests
const gravityTests = new TestSuite('Gravity');

gravityTests.test('Gravity should accelerate objects downward', () => {
  const engine = new PhysicsEngine();
  const ball = new PhysicsObject('ball', 0, 100);

  engine.addObject('ball', ball);
  engine.applyGravity(0.016);

  assert(ball.acceleration.y > 0);
});

gravityTests.test('Heavier objects should have same acceleration', () => {
  const engine = new PhysicsEngine();
  const light = new PhysicsObject('light', 0, 100, 1);
  const heavy = new PhysicsObject('heavy', 0, 100, 10);

  engine.addObject('light', light);
  engine.addObject('heavy', heavy);
  engine.applyGravity(0.016);

  // Both should have same acceleration (F=ma, a=F/m)
  assert.strictEqual(light.acceleration.y, heavy.acceleration.y);
});

gravityTests.test('Velocity should increase each frame', () => {
  const engine = new PhysicsEngine();
  const ball = new PhysicsObject('ball', 0, 100);

  engine.addObject('ball', ball);

  for (let i = 0; i < 5; i++) {
    engine.applyGravity(0.016);
    ball.update(0.016);
  }

  assert(ball.velocity.y > 0);
});

// Collision Detection Tests
const collisionTests = new TestSuite('Collision Detection');

collisionTests.test('Should detect collision when objects overlap', () => {
  const engine = new PhysicsEngine();
  const ball = new PhysicsObject('ball', 0, 0, 1, 10);
  const paddle = new PhysicsObject('paddle', 5, 0, 1, 10);

  engine.addObject('ball', ball);
  engine.addObject('paddle', paddle);
  engine.checkCollisions();

  assert(engine.collisions.length > 0);
});

collisionTests.test('Should not detect collision when objects far apart', () => {
  const engine = new PhysicsEngine();
  const ball = new PhysicsObject('ball', 0, 0);
  const paddle = new PhysicsObject('paddle', 1000, 1000);

  engine.addObject('ball', ball);
  engine.addObject('paddle', paddle);
  engine.checkCollisions();

  assert.strictEqual(engine.collisions.length, 0);
});

collisionTests.test('Should track collision data', () => {
  const engine = new PhysicsEngine();
  const ball = new PhysicsObject('ball', 0, 0, 1, 10);
  const paddle = new PhysicsObject('paddle', 15, 0, 1, 10);

  engine.addObject('ball', ball);
  engine.addObject('paddle', paddle);
  engine.checkCollisions();

  assert.strictEqual(engine.collisions[0].obj1, 'ball');
  assert.strictEqual(engine.collisions[0].obj2, 'paddle');
  assert(engine.collisions[0].distance < 30);
});

collisionTests.test('Should resolve collision with velocity exchange', () => {
  const engine = new PhysicsEngine();
  const ball = new PhysicsObject('ball', 0, 0, 1, 5);
  const paddle = new PhysicsObject('paddle', 10, 0, 1, 5);

  ball.velocity.x = 10;
  paddle.velocity.x = 0;

  engine.addObject('ball', ball);
  engine.addObject('paddle', paddle);
  engine.checkCollisions();

  // Velocities should be exchanged (with dampening)
  assert(Math.abs(ball.velocity.x) < 10);
});

// Trajectory Tests
const trajectoryTests = new TestSuite('Ball Trajectory');

trajectoryTests.test('Should calculate parabolic trajectory', () => {
  const engine = new PhysicsEngine();
  const startPos = new Vector2(0, 100);
  const velocity = new Vector2(10, -20);

  const trajectory = engine.calculateTrajectory(startPos, velocity, 2.0);

  assert(trajectory.length > 1);
  assert(trajectory[0].x === 0);
  assert(trajectory[0].y === 100);
});

trajectoryTests.test('Ball should fall downward in trajectory', () => {
  const engine = new PhysicsEngine();
  const startPos = new Vector2(0, 100);
  const velocity = new Vector2(10, 0);

  const trajectory = engine.calculateTrajectory(startPos, velocity, 1.0, 5);

  // Later positions should be lower
  for (let i = 1; i < trajectory.length; i++) {
    assert(trajectory[i].y > trajectory[i - 1].y);
  }
});

trajectoryTests.test('Trajectory should curve rightward', () => {
  const engine = new PhysicsEngine();
  const startPos = new Vector2(0, 100);
  const velocity = new Vector2(20, -10);

  const trajectory = engine.calculateTrajectory(startPos, velocity, 1.0, 10);

  // X should increase
  assert(trajectory[trajectory.length - 1].x > trajectory[0].x);
});

trajectoryTests.test('Trajectory with positive velocity should arc', () => {
  const engine = new PhysicsEngine();
  const startPos = new Vector2(0, 100);
  const velocity = new Vector2(10, 50);

  const trajectory = engine.calculateTrajectory(startPos, velocity, 2.0, 20);

  // Should go up then down
  let maxY = trajectory[0].y;
  for (const point of trajectory) {
    maxY = Math.max(maxY, point.y);
  }
  assert(maxY > startPos.y);
});

// Timing Window Tests
const timingTests = new TestSuite('Timing Windows');

timingTests.test('Should calculate impact time for falling ball', () => {
  const engine = new PhysicsEngine();
  const ballPos = new Vector2(0, 100);
  const ballVel = new Vector2(0, -10);

  const impactTime = engine.calculateImpactTime(ballPos, ballVel);

  assert(impactTime !== null);
  assert(impactTime > 0);
});

timingTests.test('Should not calculate impact time for rising ball', () => {
  const engine = new PhysicsEngine();
  const ballPos = new Vector2(0, 100);
  const ballVel = new Vector2(0, 10); // Rising

  const impactTime = engine.calculateImpactTime(ballPos, ballVel);

  assert.strictEqual(impactTime, null);
});

timingTests.test('Ball closer to ground should have shorter impact time', () => {
  const engine = new PhysicsEngine();

  const time1 = engine.calculateImpactTime(
    new Vector2(0, 100),
    new Vector2(0, -10)
  );

  const time2 = engine.calculateImpactTime(
    new Vector2(0, 10),
    new Vector2(0, -10)
  );

  assert(time2 < time1);
});

// Physics Object Tests
const objectTests = new TestSuite('Physics Objects');

objectTests.test('Should create physics object', () => {
  const obj = new PhysicsObject('ball', 10, 20, 1, 5);

  assert.strictEqual(obj.id, 'ball');
  assert.strictEqual(obj.position.x, 10);
  assert.strictEqual(obj.position.y, 20);
  assert.strictEqual(obj.mass, 1);
  assert.strictEqual(obj.radius, 5);
});

objectTests.test('Should apply forces to object', () => {
  const obj = new PhysicsObject('ball', 0, 0, 1);
  const force = new Vector2(10, 0);

  obj.applyForce(force);

  assert.strictEqual(obj.acceleration.x, 10);
});

objectTests.test('Should update position with velocity', () => {
  const obj = new PhysicsObject('ball', 0, 0);
  obj.velocity.x = 10;

  obj.update(1.0);

  assert.strictEqual(obj.position.x, 10);
});

objectTests.test('Should reset acceleration each frame', () => {
  const obj = new PhysicsObject('ball', 0, 0, 1);
  obj.applyForce(new Vector2(5, 0));
  obj.update(0.016);

  assert.strictEqual(obj.acceleration.x, 0);
});

// Integration Tests
const integrationTests = new TestSuite('Integration: Full Physics Simulation');

integrationTests.test('Should simulate falling ball', () => {
  const engine = new PhysicsEngine();
  const ball = new PhysicsObject('ball', 0, 100);

  engine.addObject('ball', ball);

  const initialY = ball.position.y;

  for (let i = 0; i < 10; i++) {
    engine.update(0.016);
  }

  assert(ball.position.y > initialY);
  assert(ball.velocity.y > 0);
});

integrationTests.test('Should simulate ball with initial velocity', () => {
  const engine = new PhysicsEngine();
  const ball = new PhysicsObject('ball', 0, 100);
  ball.velocity.x = 20;

  engine.addObject('ball', ball);

  const initialX = ball.position.x;

  for (let i = 0; i < 10; i++) {
    engine.update(0.016);
  }

  assert(ball.position.x > initialX);
});

integrationTests.test('Should handle multiple objects', () => {
  const engine = new PhysicsEngine();

  engine.addObject('ball', new PhysicsObject('ball', 0, 100));
  engine.addObject('paddle', new PhysicsObject('paddle', 50, 50));
  engine.addObject('obstacle', new PhysicsObject('obstacle', 100, 100));

  assert.strictEqual(engine.objects.size, 3);
});

integrationTests.test('Should remove objects', () => {
  const engine = new PhysicsEngine();
  engine.addObject('ball', new PhysicsObject('ball', 0, 100));
  engine.removeObject('ball');

  assert.strictEqual(engine.objects.size, 0);
});

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  const suites = [
    gravityTests,
    collisionTests,
    trajectoryTests,
    timingTests,
    objectTests,
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

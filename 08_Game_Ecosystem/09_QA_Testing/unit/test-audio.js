/**
 * Audio Engine Unit Tests
 * Tests sound generation, mute toggle, iOS resume, and node cleanup
 *
 * Run: node test-audio.js
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
// Mock Audio Engine (Web Audio API compatible)
// ============================================================================

class AudioNode {
  constructor(id, type) {
    this.id = id;
    this.type = type; // 'oscillator', 'gainNode', 'filter'
    this.active = true;
    this.frequency = 440;
    this.gain = 1.0;
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;
    this.active = false;
  }

  start() {
    this.isPlaying = true;
  }

  setGain(value) {
    this.gain = Math.max(0, Math.min(1, value));
  }

  setFrequency(frequency) {
    assert(frequency > 0 && frequency < 20000);
    this.frequency = frequency;
  }
}

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.nodes = new Map();
    this.isMuted = false;
    this.masterGain = 1.0;
    this.soundLibrary = new Map();
    this.isInitialized = false;
    this.activeNodes = new Set();
  }

  // ========== Initialization ==========
  initialize() {
    // Mock Web Audio API initialization
    this.audioContext = {
      state: 'running',
      createOscillator: () => new AudioNode('osc', 'oscillator'),
      createGain: () => new AudioNode('gain', 'gainNode'),
      createFilter: () => new AudioNode('filter', 'filter'),
    };
    this.isInitialized = true;
  }

  // ========== Sound Library ==========
  registerSound(name, config) {
    this.soundLibrary.set(name, {
      name,
      frequency: config.frequency || 440,
      duration: config.duration || 1.0,
      type: config.type || 'sine',
      volume: config.volume || 0.5,
    });
  }

  playSound(name) {
    if (!this.isInitialized) {
      this.initialize();
    }

    if (!this.soundLibrary.has(name)) {
      throw new Error(`Sound not found: ${name}`);
    }

    const soundConfig = this.soundLibrary.get(name);
    const nodeId = `${name}-${Date.now()}`;
    const node = new AudioNode(nodeId, 'oscillator');

    node.setFrequency(soundConfig.frequency);
    node.setGain(soundConfig.volume * this.masterGain);

    if (!this.isMuted) {
      node.start();
      this.activeNodes.add(nodeId);
    }

    this.nodes.set(nodeId, node);

    // Auto-stop after duration
    setTimeout(() => {
      this.stopSound(nodeId);
    }, soundConfig.duration * 1000);

    return nodeId;
  }

  stopSound(nodeId) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.stop();
      this.activeNodes.delete(nodeId);
    }
  }

  // ========== Muting ==========
  setMuted(muted) {
    this.isMuted = muted;

    if (muted) {
      // Stop all playing nodes
      this.activeNodes.forEach(nodeId => {
        const node = this.nodes.get(nodeId);
        if (node && node.isPlaying) {
          node.isPlaying = false;
        }
      });
    }
  }

  isSoundMuted() {
    return this.isMuted;
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
  }

  // ========== Volume Control ==========
  setMasterVolume(volume) {
    this.masterGain = Math.max(0, Math.min(1, volume));
  }

  getMasterVolume() {
    return this.masterGain;
  }

  // ========== iOS Specific ==========
  handleAppSuspend() {
    // Pause audio on iOS background
    this.audioContext.state = 'suspended';
  }

  handleAppResume() {
    // Resume audio on iOS foreground
    if (this.audioContext) {
      this.audioContext.state = 'running';
    }
  }

  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      // Simulate resuming Web Audio context
      this.audioContext.state = 'running';
      return true;
    }
    return false;
  }

  isContextRunning() {
    return this.audioContext && this.audioContext.state === 'running';
  }

  // ========== Node Management ==========
  getActiveNodeCount() {
    return this.activeNodes.size;
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  cleanupInactiveNodes() {
    const nodesToRemove = [];

    this.nodes.forEach((node, nodeId) => {
      if (!node.active || !node.isPlaying) {
        nodesToRemove.push(nodeId);
      }
    });

    nodesToRemove.forEach(nodeId => {
      this.nodes.delete(nodeId);
      this.activeNodes.delete(nodeId);
    });

    return nodesToRemove.length;
  }

  cleanupAllNodes() {
    const count = this.nodes.size;
    this.nodes.clear();
    this.activeNodes.clear();
    return count;
  }

  // ========== Sound Effects ==========
  playSoundEffect(effectName) {
    const effects = {
      hit: { frequency: 800, duration: 0.1, volume: 0.7 },
      miss: { frequency: 300, duration: 0.2, volume: 0.5 },
      score: { frequency: 1200, duration: 0.3, volume: 0.8 },
      gameover: { frequency: 200, duration: 1.0, volume: 0.6 },
    };

    if (!effects[effectName]) {
      throw new Error(`Unknown effect: ${effectName}`);
    }

    this.registerSound(effectName, effects[effectName]);
    return this.playSound(effectName);
  }

  // ========== Debug Info ==========
  getAudioStats() {
    return {
      isMuted: this.isMuted,
      masterVolume: this.masterGain,
      totalNodes: this.nodes.size,
      activeNodes: this.activeNodes.size,
      contextState: this.audioContext?.state || 'not initialized',
      soundsRegistered: this.soundLibrary.size,
    };
  }
}

// ============================================================================
// Test Suites
// ============================================================================

// Sound Generation Tests
const soundGenerationTests = new TestSuite('Sound Generation');

soundGenerationTests.test('Should initialize audio engine', () => {
  const engine = new AudioEngine();
  assert.strictEqual(engine.isInitialized, false);

  engine.initialize();
  assert.strictEqual(engine.isInitialized, true);
  assert(engine.audioContext !== null);
});

soundGenerationTests.test('Should register sound', () => {
  const engine = new AudioEngine();
  engine.registerSound('beep', { frequency: 440, duration: 0.5 });

  assert(engine.soundLibrary.has('beep'));
});

soundGenerationTests.test('Should play registered sound', () => {
  const engine = new AudioEngine();
  engine.registerSound('beep', { frequency: 440, duration: 0.5 });
  const nodeId = engine.playSound('beep');

  assert(engine.nodes.has(nodeId));
  assert.strictEqual(engine.getActiveNodeCount(), 1);
});

soundGenerationTests.test('Should throw error for unregistered sound', () => {
  const engine = new AudioEngine();

  assert.throws(() => {
    engine.playSound('nonexistent');
  });
});

soundGenerationTests.test('Should create multiple sound nodes', () => {
  const engine = new AudioEngine();
  engine.registerSound('beep', { frequency: 440 });

  engine.playSound('beep');
  engine.playSound('beep');
  engine.playSound('beep');

  assert.strictEqual(engine.getActiveNodeCount(), 3);
});

soundGenerationTests.test('Should set frequency on node', () => {
  const engine = new AudioEngine();
  engine.registerSound('note', { frequency: 880 });
  const nodeId = engine.playSound('note');

  const node = engine.nodes.get(nodeId);
  assert.strictEqual(node.frequency, 880);
});

soundGenerationTests.test('Should set volume on node', () => {
  const engine = new AudioEngine();
  engine.registerSound('quiet', { frequency: 440, volume: 0.3 });
  const nodeId = engine.playSound('quiet');

  const node = engine.nodes.get(nodeId);
  assert(node.gain <= 0.3);
});

// Mute Toggle Tests
const muteTests = new TestSuite('Mute Toggle');

muteTests.test('Should not be muted by default', () => {
  const engine = new AudioEngine();
  assert.strictEqual(engine.isSoundMuted(), false);
});

muteTests.test('Should set muted state', () => {
  const engine = new AudioEngine();
  engine.setMuted(true);

  assert.strictEqual(engine.isSoundMuted(), true);
});

muteTests.test('Should toggle mute state', () => {
  const engine = new AudioEngine();
  assert.strictEqual(engine.isSoundMuted(), false);

  engine.toggleMute();
  assert.strictEqual(engine.isSoundMuted(), true);

  engine.toggleMute();
  assert.strictEqual(engine.isSoundMuted(), false);
});

muteTests.test('Should stop playing nodes when muted', () => {
  const engine = new AudioEngine();
  engine.registerSound('beep', { frequency: 440 });
  const nodeId = engine.playSound('beep');

  const node = engine.nodes.get(nodeId);
  assert.strictEqual(node.isPlaying, true);

  engine.setMuted(true);
  assert.strictEqual(node.isPlaying, false);
});

muteTests.test('Should not play sounds while muted', () => {
  const engine = new AudioEngine();
  engine.setMuted(true);
  engine.registerSound('beep', { frequency: 440 });
  const nodeId = engine.playSound('beep');

  const node = engine.nodes.get(nodeId);
  assert.strictEqual(node.isPlaying, false);
});

// Volume Control Tests
const volumeTests = new TestSuite('Volume Control');

volumeTests.test('Should set master volume', () => {
  const engine = new AudioEngine();
  engine.setMasterVolume(0.5);

  assert.strictEqual(engine.getMasterVolume(), 0.5);
});

volumeTests.test('Should clamp volume to 0-1', () => {
  const engine = new AudioEngine();

  engine.setMasterVolume(1.5);
  assert.strictEqual(engine.getMasterVolume(), 1.0);

  engine.setMasterVolume(-0.5);
  assert.strictEqual(engine.getMasterVolume(), 0.0);
});

volumeTests.test('Should apply master volume to nodes', () => {
  const engine = new AudioEngine();
  engine.setMasterVolume(0.5);
  engine.registerSound('beep', { frequency: 440, volume: 0.8 });
  const nodeId = engine.playSound('beep');

  const node = engine.nodes.get(nodeId);
  assert(node.gain <= 0.4); // 0.8 * 0.5
});

// iOS Resume Tests
const iosTests = new TestSuite('iOS App Lifecycle');

iosTests.test('Should handle app suspend', () => {
  const engine = new AudioEngine();
  engine.initialize();
  assert.strictEqual(engine.isContextRunning(), true);

  engine.handleAppSuspend();
  assert.strictEqual(engine.isContextRunning(), false);
});

iosTests.test('Should handle app resume', () => {
  const engine = new AudioEngine();
  engine.initialize();
  engine.handleAppSuspend();

  engine.handleAppResume();
  assert.strictEqual(engine.isContextRunning(), true);
});

iosTests.test('Should resume audio context', () => {
  const engine = new AudioEngine();
  engine.initialize();
  engine.audioContext.state = 'suspended';

  const resumed = engine.resumeAudioContext();
  assert.strictEqual(resumed, true);
  assert.strictEqual(engine.isContextRunning(), true);
});

iosTests.test('Should return false if context already running', () => {
  const engine = new AudioEngine();
  engine.initialize();

  const resumed = engine.resumeAudioContext();
  assert.strictEqual(resumed, false);
});

// Node Cleanup Tests
const cleanupTests = new TestSuite('Node Cleanup');

cleanupTests.test('Should cleanup inactive nodes', () => {
  const engine = new AudioEngine();
  engine.registerSound('beep', { frequency: 440 });

  const nodeId = engine.playSound('beep');
  const node = engine.nodes.get(nodeId);
  node.active = false;

  const cleaned = engine.cleanupInactiveNodes();
  assert.strictEqual(cleaned, 1);
  assert(!engine.nodes.has(nodeId));
});

cleanupTests.test('Should cleanup only inactive nodes', () => {
  const engine = new AudioEngine();
  engine.registerSound('beep', { frequency: 440 });

  engine.playSound('beep'); // Active
  const nodeId2 = engine.playSound('beep');
  const node2 = engine.nodes.get(nodeId2);
  node2.active = false; // Inactive

  const cleaned = engine.cleanupInactiveNodes();
  assert.strictEqual(cleaned, 1);
  assert.strictEqual(engine.getActiveNodeCount(), 1);
});

cleanupTests.test('Should cleanup all nodes', () => {
  const engine = new AudioEngine();
  engine.registerSound('beep', { frequency: 440 });

  engine.playSound('beep');
  engine.playSound('beep');
  engine.playSound('beep');

  const count = engine.cleanupAllNodes();
  assert.strictEqual(count, 3);
  assert.strictEqual(engine.nodes.size, 0);
});

cleanupTests.test('Should get active node count', () => {
  const engine = new AudioEngine();
  engine.registerSound('beep', { frequency: 440 });

  engine.playSound('beep');
  engine.playSound('beep');

  assert.strictEqual(engine.getActiveNodeCount(), 2);
});

// Sound Effects Tests
const effectsTests = new TestSuite('Sound Effects');

effectsTests.test('Should play hit effect', () => {
  const engine = new AudioEngine();
  const nodeId = engine.playSoundEffect('hit');

  assert(engine.nodes.has(nodeId));
});

effectsTests.test('Should play all standard effects', () => {
  const engine = new AudioEngine();
  const effects = ['hit', 'miss', 'score', 'gameover'];

  effects.forEach(effect => {
    const nodeId = engine.playSoundEffect(effect);
    assert(engine.nodes.has(nodeId));
  });
});

effectsTests.test('Should throw error for unknown effect', () => {
  const engine = new AudioEngine();

  assert.throws(() => {
    engine.playSoundEffect('unknown');
  });
});

// Integration Tests
const integrationTests = new TestSuite('Integration: Full Audio Workflow');

integrationTests.test('Should complete full playback cycle', () => {
  const engine = new AudioEngine();
  engine.initialize();
  engine.registerSound('beep', { frequency: 440, duration: 0.1 });

  const nodeId = engine.playSound('beep');
  assert(engine.nodes.has(nodeId));

  engine.stopSound(nodeId);
  const node = engine.nodes.get(nodeId);
  assert.strictEqual(node.isPlaying, false);
});

integrationTests.test('Should get audio stats', () => {
  const engine = new AudioEngine();
  engine.initialize();
  engine.setMasterVolume(0.7);
  engine.registerSound('beep', { frequency: 440 });
  engine.playSound('beep');

  const stats = engine.getAudioStats();
  assert.strictEqual(stats.isMuted, false);
  assert.strictEqual(stats.masterVolume, 0.7);
  assert.strictEqual(stats.soundsRegistered, 1);
  assert(stats.activeNodes > 0);
});

integrationTests.test('Should handle multiple simultaneous sounds', () => {
  const engine = new AudioEngine();
  engine.registerSound('low', { frequency: 220 });
  engine.registerSound('high', { frequency: 880 });

  engine.playSound('low');
  engine.playSound('high');
  engine.playSound('low');

  assert.strictEqual(engine.getActiveNodeCount(), 3);
});

integrationTests.test('Should maintain audio state through app lifecycle', () => {
  const engine = new AudioEngine();
  engine.initialize();
  engine.setMasterVolume(0.5);
  engine.registerSound('beep', { frequency: 440 });
  engine.playSound('beep');

  engine.handleAppSuspend();
  assert.strictEqual(engine.isContextRunning(), false);

  engine.handleAppResume();
  assert.strictEqual(engine.isContextRunning(), true);
  assert.strictEqual(engine.getMasterVolume(), 0.5);
});

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  const suites = [
    soundGenerationTests,
    muteTests,
    volumeTests,
    iosTests,
    cleanupTests,
    effectsTests,
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

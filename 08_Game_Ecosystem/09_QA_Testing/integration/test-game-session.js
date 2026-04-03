/**
 * Game Session Integration Tests
 * Tests full game workflows: menu -> game -> score -> gameover, campaigns, multiplayer
 *
 * Run: node test-game-session.js
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
// Mock Game Session Manager
// ============================================================================

class GameSession {
  constructor(playerId, gameType) {
    this.playerId = playerId;
    this.gameType = gameType; // 'cricket', 'football', 'baseball'
    this.sessionId = `session-${Date.now()}`;
    this.state = 'MENU'; // MENU, LOADING, PLAYING, PAUSED, SCORE, GAMEOVER
    this.score = 0;
    this.level = 1;
    this.startTime = null;
    this.endTime = null;
    this.events = [];
    this.stats = {
      accuracy: 0,
      hits: 0,
      misses: 0,
      timePlayedSeconds: 0,
    };
  }

  // ========== State Transitions ==========
  loadGame() {
    assert.strictEqual(this.state, 'MENU');
    this.state = 'LOADING';
    this._logEvent('game:loaded');
  }

  startGame() {
    assert(['LOADING', 'MENU'].includes(this.state));
    this.state = 'PLAYING';
    this.startTime = Date.now();
    this._logEvent('game:started');
  }

  pauseGame() {
    assert.strictEqual(this.state, 'PLAYING');
    this.state = 'PAUSED';
    this._logEvent('game:paused');
  }

  resumeGame() {
    assert.strictEqual(this.state, 'PAUSED');
    this.state = 'PLAYING';
    this._logEvent('game:resumed');
  }

  finishGame() {
    assert.strictEqual(this.state, 'PLAYING');
    this.state = 'SCORE';
    this.endTime = Date.now();
    this._calculateStats();
    this._logEvent('game:finished');
  }

  showGameOver() {
    this.state = 'GAMEOVER';
    this._logEvent('game:over');
  }

  returnToMenu() {
    this.state = 'MENU';
    this._logEvent('game:menu');
  }

  // ========== Scoring ==========
  addScore(points) {
    assert(this.state === 'PLAYING', 'Can only score while playing');
    this.score += points;
    this._logEvent('score:added', { points, total: this.score });
  }

  recordHit() {
    this.stats.hits++;
    this.addScore(10);
    this._logEvent('hit:recorded');
  }

  recordMiss() {
    this.stats.misses++;
    this._logEvent('miss:recorded');
  }

  // ========== Level Progression ==========
  completeLevel() {
    assert(this.state === 'SCORE');
    this.level++;
    this._logEvent('level:completed', { newLevel: this.level });
  }

  getCurrentLevel() {
    return this.level;
  }

  // ========== Statistics ==========
  _calculateStats() {
    const total = this.stats.hits + this.stats.misses;
    this.stats.accuracy = total > 0 ? (this.stats.hits / total) * 100 : 0;
    if (this.startTime && this.endTime) {
      this.stats.timePlayedSeconds = (this.endTime - this.startTime) / 1000;
    }
  }

  getStats() {
    return { ...this.stats, score: this.score, level: this.level };
  }

  // ========== Events ==========
  _logEvent(event, data = {}) {
    this.events.push({ event, data, timestamp: Date.now() });
  }

  getEventHistory() {
    return this.events;
  }

  // ========== Multiplayer ==========
  isMultiplayer() {
    return this.opponent !== undefined;
  }

  setOpponent(opponentId) {
    this.opponent = opponentId;
    this._logEvent('opponent:set', { opponentId });
  }
}

class CampaignManager {
  constructor(playerId) {
    this.playerId = playerId;
    this.currentCampaign = null;
    this.campaignProgress = {};
    this.completedCampaigns = [];
  }

  startCampaign(campaignId) {
    this.currentCampaign = campaignId;
    this.campaignProgress[campaignId] = { level: 1, completed: false };
  }

  completeCampaignLevel(campaignId, levelNum) {
    if (this.campaignProgress[campaignId]) {
      this.campaignProgress[campaignId].level = levelNum + 1;
    }
  }

  completeCampaign(campaignId) {
    if (this.campaignProgress[campaignId]) {
      this.campaignProgress[campaignId].completed = true;
      this.completedCampaigns.push(campaignId);
    }
  }

  getCampaignProgress(campaignId) {
    return this.campaignProgress[campaignId] || null;
  }

  getTotalCompletedCampaigns() {
    return this.completedCampaigns.length;
  }
}

class MultiplayerRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.host = null;
    this.state = 'WAITING'; // WAITING, READY, PLAYING, FINISHED
    this.scores = new Map();
    this.maxPlayers = 2;
  }

  addPlayer(playerId) {
    assert(this.players.length < this.maxPlayers);
    this.players.push(playerId);
    this.scores.set(playerId, 0);

    if (this.players.length === 1) {
      this.host = playerId;
    }
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p !== playerId);
    this.scores.delete(playerId);
  }

  setPlayerReady(playerId) {
    if (this.players.length === this.maxPlayers) {
      this.state = 'READY';
    }
  }

  startGame() {
    assert.strictEqual(this.state, 'READY');
    this.state = 'PLAYING';
  }

  updatePlayerScore(playerId, score) {
    assert.strictEqual(this.state, 'PLAYING');
    this.scores.set(playerId, score);
  }

  finishGame() {
    this.state = 'FINISHED';
  }

  getWinner() {
    let winner = null;
    let maxScore = -1;

    this.scores.forEach((score, playerId) => {
      if (score > maxScore) {
        maxScore = score;
        winner = playerId;
      }
    });

    return winner;
  }

  getPlayerCount() {
    return this.players.length;
  }
}

// ============================================================================
// Test Suites
// ============================================================================

// Single Player Session Tests
const singlePlayerTests = new TestSuite('Single Player Game Session');

singlePlayerTests.test('Should create game session', () => {
  const session = new GameSession('player1', 'cricket');

  assert.strictEqual(session.playerId, 'player1');
  assert.strictEqual(session.gameType, 'cricket');
  assert.strictEqual(session.state, 'MENU');
});

singlePlayerTests.test('Should transition menu -> loading -> playing', () => {
  const session = new GameSession('player1', 'cricket');

  session.loadGame();
  assert.strictEqual(session.state, 'LOADING');

  session.startGame();
  assert.strictEqual(session.state, 'PLAYING');
});

singlePlayerTests.test('Should pause and resume game', () => {
  const session = new GameSession('player1', 'cricket');
  session.startGame();

  session.pauseGame();
  assert.strictEqual(session.state, 'PAUSED');

  session.resumeGame();
  assert.strictEqual(session.state, 'PLAYING');
});

singlePlayerTests.test('Should finish game and show score', () => {
  const session = new GameSession('player1', 'cricket');
  session.startGame();
  session.addScore(50);

  session.finishGame();
  assert.strictEqual(session.state, 'SCORE');
  assert.strictEqual(session.score, 50);
});

singlePlayerTests.test('Should track hits and misses', () => {
  const session = new GameSession('player1', 'cricket');
  session.startGame();

  session.recordHit();
  session.recordHit();
  session.recordMiss();

  const stats = session.getStats();
  assert.strictEqual(stats.hits, 2);
  assert.strictEqual(stats.misses, 1);
});

singlePlayerTests.test('Should calculate accuracy', () => {
  const session = new GameSession('player1', 'cricket');
  session.startGame();

  session.recordHit();
  session.recordHit();
  session.recordMiss();

  session.finishGame();
  const stats = session.getStats();

  assert.strictEqual(stats.accuracy, (2 / 3) * 100);
});

singlePlayerTests.test('Should return to menu after gameover', () => {
  const session = new GameSession('player1', 'cricket');
  session.startGame();
  session.finishGame();
  session.showGameOver();

  session.returnToMenu();
  assert.strictEqual(session.state, 'MENU');
});

singlePlayerTests.test('Should track game events', () => {
  const session = new GameSession('player1', 'cricket');
  session.startGame();
  session.addScore(10);
  session.finishGame();

  const events = session.getEventHistory();
  assert(events.length > 0);
  assert(events.some(e => e.event === 'game:started'));
  assert(events.some(e => e.event === 'score:added'));
  assert(events.some(e => e.event === 'game:finished'));
});

// Campaign Tests
const campaignTests = new TestSuite('Campaign Level Progression');

campaignTests.test('Should start campaign', () => {
  const manager = new CampaignManager('player1');
  manager.startCampaign('campaign-1');

  assert.strictEqual(manager.currentCampaign, 'campaign-1');
});

campaignTests.test('Should track level progress', () => {
  const manager = new CampaignManager('player1');
  manager.startCampaign('campaign-1');
  manager.completeCampaignLevel('campaign-1', 1);

  const progress = manager.getCampaignProgress('campaign-1');
  assert.strictEqual(progress.level, 2);
});

campaignTests.test('Should complete campaign', () => {
  const manager = new CampaignManager('player1');
  manager.startCampaign('campaign-1');
  manager.completeCampaign('campaign-1');

  const progress = manager.getCampaignProgress('campaign-1');
  assert.strictEqual(progress.completed, true);
});

campaignTests.test('Should track completed campaigns', () => {
  const manager = new CampaignManager('player1');

  manager.startCampaign('campaign-1');
  manager.completeCampaign('campaign-1');

  manager.startCampaign('campaign-2');
  manager.completeCampaign('campaign-2');

  assert.strictEqual(manager.getTotalCompletedCampaigns(), 2);
});

campaignTests.test('Should support multiple campaigns', () => {
  const manager = new CampaignManager('player1');

  manager.startCampaign('easy');
  manager.completeCampaignLevel('easy', 5);

  manager.startCampaign('hard');
  manager.completeCampaignLevel('hard', 2);

  const easyProgress = manager.getCampaignProgress('easy');
  const hardProgress = manager.getCampaignProgress('hard');

  assert.strictEqual(easyProgress.level, 6);
  assert.strictEqual(hardProgress.level, 3);
});

// Multiplayer Room Tests
const multiplayerTests = new TestSuite('Multiplayer Room Lifecycle');

multiplayerTests.test('Should create multiplayer room', () => {
  const room = new MultiplayerRoom('room-1');

  assert.strictEqual(room.roomId, 'room-1');
  assert.strictEqual(room.state, 'WAITING');
  assert.strictEqual(room.getPlayerCount(), 0);
});

multiplayerTests.test('Should add players to room', () => {
  const room = new MultiplayerRoom('room-1');

  room.addPlayer('player1');
  room.addPlayer('player2');

  assert.strictEqual(room.getPlayerCount(), 2);
  assert.strictEqual(room.host, 'player1');
});

multiplayerTests.test('Should not exceed max players', () => {
  const room = new MultiplayerRoom('room-1');
  room.addPlayer('player1');
  room.addPlayer('player2');

  assert.throws(() => {
    room.addPlayer('player3');
  });
});

multiplayerTests.test('Should remove players from room', () => {
  const room = new MultiplayerRoom('room-1');
  room.addPlayer('player1');
  room.addPlayer('player2');

  room.removePlayer('player1');

  assert.strictEqual(room.getPlayerCount(), 1);
});

multiplayerTests.test('Should transition to ready when full', () => {
  const room = new MultiplayerRoom('room-1');
  room.addPlayer('player1');
  room.addPlayer('player2');

  room.setPlayerReady('player1');
  assert.strictEqual(room.state, 'READY');
});

multiplayerTests.test('Should start game from ready state', () => {
  const room = new MultiplayerRoom('room-1');
  room.addPlayer('player1');
  room.addPlayer('player2');
  room.setPlayerReady('player1');

  room.startGame();
  assert.strictEqual(room.state, 'PLAYING');
});

multiplayerTests.test('Should update player scores', () => {
  const room = new MultiplayerRoom('room-1');
  room.addPlayer('player1');
  room.addPlayer('player2');
  room.setPlayerReady('player1');
  room.startGame();

  room.updatePlayerScore('player1', 100);
  room.updatePlayerScore('player2', 80);

  assert.strictEqual(room.scores.get('player1'), 100);
  assert.strictEqual(room.scores.get('player2'), 80);
});

multiplayerTests.test('Should determine winner', () => {
  const room = new MultiplayerRoom('room-1');
  room.addPlayer('player1');
  room.addPlayer('player2');
  room.setPlayerReady('player1');
  room.startGame();

  room.updatePlayerScore('player1', 150);
  room.updatePlayerScore('player2', 100);

  room.finishGame();
  assert.strictEqual(room.getWinner(), 'player1');
});

// Integration: Full Game Flow
const fullGameFlowTests = new TestSuite('Integration: Full Game Flow');

fullGameFlowTests.test('Should complete single player session', () => {
  const session = new GameSession('player1', 'cricket');

  session.loadGame();
  session.startGame();

  // Play game
  session.recordHit();
  session.recordHit();
  session.recordMiss();

  session.finishGame();
  session.showGameOver();

  const stats = session.getStats();
  assert(stats.accuracy > 0);
  assert(stats.hits > 0);
});

fullGameFlowTests.test('Should complete campaign with levels', () => {
  const campaign = new CampaignManager('player1');
  campaign.startCampaign('story-mode');

  // Complete levels
  for (let i = 0; i < 5; i++) {
    const session = new GameSession('player1', 'cricket');
    session.startGame();
    session.recordHit();
    session.finishGame();

    campaign.completeCampaignLevel('story-mode', i);
  }

  campaign.completeCampaign('story-mode');

  const progress = campaign.getCampaignProgress('story-mode');
  assert.strictEqual(progress.completed, true);
});

fullGameFlowTests.test('Should complete multiplayer match', () => {
  const room = new MultiplayerRoom('match-1');

  // Players join
  room.addPlayer('player1');
  room.addPlayer('player2');
  room.setPlayerReady('player1');

  // Play game
  room.startGame();

  // Simulate gameplay
  room.updatePlayerScore('player1', 120);
  room.updatePlayerScore('player2', 90);

  // Finish
  room.finishGame();

  const winner = room.getWinner();
  assert.strictEqual(winner, 'player1');
});

fullGameFlowTests.test('Should track session duration', () => {
  const session = new GameSession('player1', 'cricket');
  session.startGame();

  // Simulate gameplay
  const startTime = session.startTime;
  session.recordHit();
  session.recordMiss();
  session.recordHit();

  session.finishGame();

  const stats = session.getStats();
  assert(stats.timePlayedSeconds >= 0);
  assert(session.endTime >= startTime);
});

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  const suites = [
    singlePlayerTests,
    campaignTests,
    multiplayerTests,
    fullGameFlowTests,
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

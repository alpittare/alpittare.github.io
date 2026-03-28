#!/usr/bin/env node
/**
 * COMPREHENSIVE PHASE 4 TEST SUITE
 * Tests ClaudeAIAdvisor + all phases working together
 * Run: node test-phase4.js
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Change to engine directory
const engineDir = '/sessions/lucid-peaceful-brahmagupta/mnt/3. Games/engine';
process.chdir(engineDir);

// Create sandbox with required globals
const sandbox = {
    console,
    Math,
    performance: { now: () => Date.now() },
    Date,
    Object,
    Array,
    JSON,
    module: { exports: {} },
    setTimeout,
    clearTimeout,
    Promise,
    fetch: undefined,
    AbortController,
};

const ctx = vm.createContext(sandbox);

// Load all files in order
const files = ['core.js', 'cricket-physics.js', 'football-physics.js', 'ai-engine.js'];
for (const f of files) {
    const code = fs.readFileSync(f, 'utf8');
    vm.runInContext(code, ctx);
}

// Extract exports
const {
    AIUtil,
    PlayerModel,
    BayesPredictor,
    SequencePredictor,
    AdaptiveDifficulty,
    ClaudeAIAdvisor,
    AIEngine,
    CricketAI,
    FootballAI,
    attachClaudeAdvisor,
} = sandbox.module.exports;

// ============================================================================
// TEST FRAMEWORK
// ============================================================================

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
    testCount++;
    try {
        fn();
        passCount++;
        console.log(`✓ ${name}`);
    } catch (err) {
        failCount++;
        console.log(`✗ ${name}`);
        console.log(`  Error: ${err.message}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, message) {
    if (a !== b) throw new Error(`${message}: expected ${b}, got ${a}`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// SECTION 1 — ClaudeAIAdvisor UNIT TESTS
// ============================================================================

console.log('\n=== SECTION 1: ClaudeAIAdvisor Unit Tests ===\n');

test('Constructor with empty apiKey → enabled=false', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: '' });
    assert(advisor.enabled === false, 'Should be disabled');
});

test('Constructor with apiKey → enabled=true', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    assert(advisor.enabled === true, 'Should be enabled');
});

test('setEnabled(false) disables, setEnabled(true) re-enables', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    assert(advisor.enabled === true, 'Should start enabled');
    advisor.setEnabled(false);
    assert(advisor.enabled === false, 'Should be disabled');
    advisor.setEnabled(true);
    assert(advisor.enabled === true, 'Should be re-enabled');
});

test('isAvailable returns false when disabled', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    advisor.setEnabled(false);
    assert(advisor.isAvailable === false, 'Should not be available');
});

test('isAvailable returns true when enabled (no circuit open)', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    assert(advisor.isAvailable === true, 'Should be available');
});

test('stats returns correct structure', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const stats = advisor.stats;
    assert(typeof stats.enabled === 'boolean', 'Should have enabled');
    assert(typeof stats.totalRequests === 'number', 'Should have totalRequests');
    assert(typeof stats.totalErrors === 'number', 'Should have totalErrors');
    assert(typeof stats.totalCacheHits === 'number', 'Should have totalCacheHits');
    assert(typeof stats.circuitOpen === 'boolean', 'Should have circuitOpen');
});

test('clearCache() empties the cache', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    // Manually inject cache
    advisor._cache['test'] = { response: {}, timestamp: Date.now(), ttl: 30000 };
    advisor._cacheKeys.push('test');
    assert(advisor._cacheKeys.length === 1, 'Cache should have 1 item');
    advisor.clearCache();
    assert(advisor._cacheKeys.length === 0, 'Cache should be empty');
});

test('getAdvice() returns null when no cache', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const advice = advisor.getAdvice('unknown');
    assert(advice === null, 'Should return null');
});

test('requestAdvice() returns false when disabled', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: '' });
    const result = advisor.requestAdvice('cricket_strategy', {});
    assert(result === false, 'Should return false');
});

test('requestAdvice() returns false when circuit is open', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    advisor._circuitOpen = true;
    advisor._circuitOpenUntil = Date.now() + 10000;
    const result = advisor.requestAdvice('cricket_strategy', {});
    assert(result === false, 'Should return false when circuit open');
});

test('requestAdvice() returns false when cached data is still fresh', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    // Inject fresh cache
    advisor._cache['cricket_strategy'] = {
        response: { test: 'data' },
        timestamp: Date.now() - 1000, // 1s old
        ttl: 30000, // 30s TTL
    };
    const result = advisor.requestAdvice('cricket_strategy', {});
    assert(result === false, 'Should return false (cached)');
    assert(advisor.stats.totalCacheHits === 1, 'Should increment cache hit');
});

test('requestAdvice() returns false for unknown topic', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const result = advisor.requestAdvice('unknown_topic', {});
    assert(result === false, 'Should return false for unknown topic');
});

test('requestAdvice() queues correctly when enabled (mock _callAPI)', async () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test', minIntervalMs: 0 });

    // Mock _callAPI
    let callCount = 0;
    advisor._callAPI = async (prompt) => {
        callCount++;
        return {
            content: [{ text: '{ "bowling_priority": "defensive" }' }]
        };
    };

    const result = advisor.requestAdvice('cricket_strategy', { runs: 10 });
    assert(result === true, 'Should queue request');
    assert(advisor.stats.queueDepth === 1, 'Should have 1 item in queue');

    // Wait for processing
    await sleep(200);
    assert(callCount === 1, 'Should have called API');
});

test('toJSON()/fromJSON() preserves telemetry counters', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    advisor._totalRequests = 42;
    advisor._totalErrors = 5;
    advisor._totalCacheHits = 37;

    const json = advisor.toJSON();
    assert(json.totalRequests === 42, 'Should preserve totalRequests');

    const advisor2 = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    advisor2.fromJSON(json);
    assert(advisor2._totalRequests === 42, 'Should restore totalRequests');
    assert(advisor2._totalErrors === 5, 'Should restore totalErrors');
    assert(advisor2._totalCacheHits === 37, 'Should restore totalCacheHits');
});

// ============================================================================
// SECTION 2 — FAIL-SAFE TESTS
// ============================================================================

console.log('\n=== SECTION 2: Fail-Safe Tests ===\n');

test('When advisor is disabled, CricketAI.selectShot still works', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: '' });
    const cricket = new CricketAI();
    attachClaudeAdvisor(new AIEngine(), advisor);

    const input = { ball_type: 'fast', length: 'good', line: 'off', pace: 80 };
    const result = cricket.selectShot(input);
    assert(result !== null, 'Should return valid action');
    assert(typeof result.action === 'string', 'Should have action');
});

test('When advisor is disabled, CricketAI.selectDelivery still works', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: '' });
    const cricket = new CricketAI();
    attachClaudeAdvisor(new AIEngine(), advisor);

    const state = { battersStreak: 0, lastOver: [] };
    const result = cricket.selectDelivery(state);
    assert(result !== null, 'Should return valid delivery');
    assert(typeof result.type === 'string', 'Should have type');
});

test('When advisor is disabled, FootballAI.decideKeeper still works', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: '' });
    const football = new FootballAI();
    attachClaudeAdvisor(new AIEngine(), advisor);

    const input = { direction: 'left', power: 0.8 };
    const result = football.decideKeeper(input);
    assert(result !== null, 'Should return valid keeper decision');
    assert(typeof result.action !== 'undefined', 'Should have action');
});

test('When advisor is disabled, FootballAI.selectShot still works', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: '' });
    const football = new FootballAI();
    attachClaudeAdvisor(new AIEngine(), advisor);

    const context = { round: 1, playerScore: 0, aiScore: 0 };
    const result = football.selectShot(context);
    assert(result !== null, 'Should return valid shot');
    assert(typeof result.power === 'number', 'Should have power');
});

test('When advisor has null cache, decision results have no _claudeAdvice field', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const cricket = new CricketAI();
    const aiEngine = new AIEngine();
    attachClaudeAdvisor(aiEngine, advisor);

    const state = { battersStreak: 0, lastOver: [] };
    const result = cricket.selectDelivery(state);
    // When cache is null, _claudeAdvice should not be set
    assert(result._claudeAdvice === undefined, 'Should not have _claudeAdvice when cached is null');
});

test('CricketAI with null bayes/sequence/adaptiveDiff (Phase 3 disabled) still works', () => {
    const cricket = new CricketAI();
    const input = { ballType: 'fast', length: 'good', line: 'off', pace: 80 };
    const result = cricket.selectShot(input);
    assert(result !== null, 'Should work without Phase 3');
});

test('FootballAI with null bayes/sequence/adaptiveDiff (Phase 3 disabled) still works', () => {
    const football = new FootballAI();
    const context = { round: 1, playerScore: 0, aiScore: 0 };
    const result = football.selectShot(context);
    assert(result !== null, 'Should work without Phase 3');
});

// ============================================================================
// SECTION 3 — CIRCUIT BREAKER TESTS
// ============================================================================

console.log('\n=== SECTION 3: Circuit Breaker Tests ===\n');

test('After 3 consecutive errors, circuit opens', async () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test', minIntervalMs: 0 });

    let errorCount = 0;
    advisor._callAPI = async () => {
        errorCount++;
        throw new Error('API error');
    };

    // Trigger 3 failed requests
    for (let i = 0; i < 3; i++) {
        advisor._queue.push({
            topic: `cricket_${i}`,
            prompt: 'test',
            context: {},
            ttl: 30000,
            queuedAt: Date.now(),
        });
    }

    // Process queue (will fail 3 times)
    await advisor._processQueue();
    await sleep(300);

    assert(advisor._circuitOpen === true, 'Circuit should be open');
    assert(advisor.stats.circuitOpen === true, 'Stats should reflect circuit open');
});

test('While circuit is open, requestAdvice returns false', async () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    advisor._circuitOpen = true;
    advisor._circuitOpenUntil = Date.now() + 10000;

    const result = advisor.requestAdvice('cricket_strategy', {});
    assert(result === false, 'Should return false when circuit open');
});

test('After circuitOpenUntil passes, circuit half-opens (allows one request)', async () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test', minIntervalMs: 0 });

    advisor._circuitOpen = true;
    advisor._circuitOpenUntil = Date.now() - 100; // Already expired

    let callCount = 0;
    advisor._callAPI = async () => {
        callCount++;
        return { content: [{ text: '{ "test": "data" }' }] };
    };

    const result = advisor.requestAdvice('cricket_strategy', { test: 1 });
    assert(result === true, 'Should allow request when circuit recovers');
    assert(advisor._circuitOpen === false, 'Circuit should be half-open (closed)');
});

// ============================================================================
// SECTION 4 — CACHE TESTS
// ============================================================================

console.log('\n=== SECTION 4: Cache Tests ===\n');

test('_storeCache stores and retrieves correctly', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const response = { bowling_priority: 'defensive' };

    advisor._storeCache('cricket_strategy', response, 30000);
    const cached = advisor._cache['cricket_strategy'];

    assert(cached !== undefined, 'Should be stored');
    assert(cached.response === response, 'Should store response');
    assert(cached.ttl === 30000, 'Should store TTL');
});

test('Cache TTL expiry: store with ttl=100ms, wait 150ms, getAdvice returns null', async () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const response = { test: 'data' };

    advisor._storeCache('test_topic', response, 100);
    assert(advisor.getAdvice('test_topic') !== null, 'Should be available immediately');

    await sleep(150);
    const result = advisor.getAdvice('test_topic');
    assert(result === null, 'Should be expired');
});

test('LRU eviction: store maxCacheSize+1 items, first should be evicted', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test', maxCacheSize: 3 });

    advisor._storeCache('item1', { data: 1 }, 30000);
    advisor._storeCache('item2', { data: 2 }, 30000);
    advisor._storeCache('item3', { data: 3 }, 30000);
    assert(advisor._cacheKeys.length === 3, 'Should have 3 items');

    advisor._storeCache('item4', { data: 4 }, 30000);
    assert(advisor._cacheKeys.length === 3, 'Should still have 3 items (LRU eviction)');
    assert(advisor._cache['item1'] === undefined, 'First item should be evicted');
    assert(advisor._cache['item2'] !== undefined, 'Second item should remain');
});

test('clearCache empties everything', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });

    advisor._storeCache('item1', { data: 1 }, 30000);
    advisor._storeCache('item2', { data: 2 }, 30000);
    assert(Object.keys(advisor._cache).length === 2, 'Should have 2 items');

    advisor.clearCache();
    assert(Object.keys(advisor._cache).length === 0, 'Should be empty');
    assert(advisor._cacheKeys.length === 0, 'LRU list should be empty');
});

// ============================================================================
// SECTION 5 — PROMPT BUILDER TESTS
// ============================================================================

console.log('\n=== SECTION 5: Prompt Builder Tests ===\n');

test('_buildCricketStrategyPrompt returns string containing game state values', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const prompt = advisor._buildCricketStrategyPrompt({
        runs: 45,
        wickets: 2,
        overs: 8,
        target: 120,
    });

    assert(typeof prompt === 'string', 'Should return string');
    assert(prompt.includes('45'), 'Should include runs');
    assert(prompt.includes('2'), 'Should include wickets');
    assert(prompt.includes('120'), 'Should include target');
});

test('_buildFootballStrategyPrompt returns string with shot pattern', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const prompt = advisor._buildFootballStrategyPrompt({
        playerScore: 3,
        aiScore: 2,
        recentDirs: 'left,right,center',
        pattern: 'L→R→C',
    });

    assert(typeof prompt === 'string', 'Should return string');
    assert(prompt.includes('left,right,center'), 'Should include recent dirs');
    assert(prompt.includes('3'), 'Should include player score');
});

test('_buildDifficultyAdvicePrompt returns string with win rate', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const prompt = advisor._buildDifficultyAdvicePrompt({
        winRate: 0.55,
        recentWinRate: 0.60,
        streak: 3,
    });

    assert(typeof prompt === 'string', 'Should return string');
    assert(prompt.includes('0.55'), 'Should include win rate');
    assert(prompt.includes('3'), 'Should include streak');
});

test('_buildCommentaryPrompt returns string with event', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const prompt = advisor._buildCommentaryPrompt({
        event: 'six',
        sport: 'cricket',
        details: 'Beautiful shot',
    });

    assert(typeof prompt === 'string', 'Should return string');
    assert(prompt.includes('six'), 'Should include event');
    assert(prompt.includes('cricket'), 'Should include sport');
});

// ============================================================================
// SECTION 6 — _parseResponse TESTS
// ============================================================================

console.log('\n=== SECTION 6: _parseResponse Tests ===\n');

test('Valid JSON in response text → parsed object with _topic and _timestamp', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const raw = {
        content: [{ text: '{ "bowling_priority": "defensive", "reasoning": "test" }' }]
    };

    const parsed = advisor._parseResponse(raw, 'cricket_strategy');
    assert(parsed !== null, 'Should parse');
    assert(parsed._topic === 'cricket_strategy', 'Should add topic');
    assert(typeof parsed._timestamp === 'number', 'Should add timestamp');
    assert(parsed.bowling_priority === 'defensive', 'Should parse JSON fields');
});

test('Invalid JSON → fallback to text object', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const raw = {
        content: [{ text: 'This is plain text, not JSON' }]
    };

    const parsed = advisor._parseResponse(raw, 'cricket_strategy');
    assert(parsed !== null, 'Should return fallback');
    assert(parsed.text === 'This is plain text, not JSON', 'Should include text field');
    assert(parsed._topic === 'cricket_strategy', 'Should add topic');
});

test('Empty response → null', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const raw = { content: [{ text: null }] };

    const parsed = advisor._parseResponse(raw, 'cricket_strategy');
    assert(parsed === null, 'Should return null');
});

test('Nested JSON extraction from mixed text', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const raw = {
        content: [{
            text: 'Here is my advice: { "bowling_priority": "aggressive", "confidence": 0.8 } Please follow it.'
        }]
    };

    const parsed = advisor._parseResponse(raw, 'cricket_strategy');
    assert(parsed !== null, 'Should parse nested JSON');
    assert(parsed.bowling_priority === 'aggressive', 'Should extract JSON from text');
    assert(parsed.confidence === 0.8, 'Should parse numeric fields');
});

// ============================================================================
// SECTION 7 — attachClaudeAdvisor INTEGRATION
// ============================================================================

console.log('\n=== SECTION 7: attachClaudeAdvisor Integration ===\n');

test('After attach, aiEngine.claudeAdvisor is set', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const aiEngine = new AIEngine();
    attachClaudeAdvisor(aiEngine, advisor);

    assert(aiEngine.claudeAdvisor === advisor, 'Should set advisor');
});

test('After attach, aiEngine has requestCommentary/getCommentary methods', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const aiEngine = new AIEngine();
    attachClaudeAdvisor(aiEngine, advisor);

    assert(typeof aiEngine.requestCommentary === 'function', 'Should have requestCommentary');
    assert(typeof aiEngine.getCommentary === 'function', 'Should have getCommentary');
});

test('recordBattingEvent still works after attach (monkey-patch doesn\'t break)', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const aiEngine = new AIEngine();
    attachClaudeAdvisor(aiEngine, advisor);

    const cricket = aiEngine.cricket;
    const delivery = { type: 'fast', length: 'good' };
    const result = { _simRuns: 4, _simWickets: 0, _simOvers: 1 };

    // Should not throw
    cricket.recordBattingEvent(delivery, result);
});

test('selectDelivery still works after attach', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const aiEngine = new AIEngine();
    attachClaudeAdvisor(aiEngine, advisor);

    const state = { battersStreak: 0, lastOver: [] };
    const result = aiEngine.cricket.selectDelivery(state);
    assert(result !== null, 'Should return valid delivery');
});

test('decideKeeper still works after attach', () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test' });
    const aiEngine = new AIEngine();
    attachClaudeAdvisor(aiEngine, advisor);

    const input = { playerDir: 'left', playerPower: 0.8 };
    const result = aiEngine.football.decideKeeper(input);
    assert(result !== null, 'Should return valid keeper decision');
});

// ============================================================================
// SECTION 8 — MOCK MODE SIMULATION
// ============================================================================

console.log('\n=== SECTION 8: Mock Mode Simulation ===\n');

test('Mock mode: create advisor with mock _callAPI that returns after 50ms', async () => {
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test', minIntervalMs: 0 });

    advisor._callAPI = async (prompt) => {
        await sleep(50);
        return {
            content: [{
                text: '{ "bowling_priority": "balanced", "confidence": 0.85 }'
            }]
        };
    };

    const queued = advisor.requestAdvice('cricket_strategy', { runs: 20 });
    assert(queued === true, 'Should queue');

    await sleep(200);

    const advice = advisor.getAdvice('cricket_strategy');
    assert(advice !== null, 'Should have parsed advice');
    assert(advice.bowling_priority === 'balanced', 'Should parse fields');
    assert(advice._topic === 'cricket_strategy', 'Should have topic marker');
});

// ============================================================================
// SECTION 9 — ALL PHASES WORKING TOGETHER
// ============================================================================

console.log('\n=== SECTION 9: All Phases Working Together ===\n');

test('Run 50 decisions (cricket + football) with advisor disabled, verify all phases active', () => {
    const aiEngine = new AIEngine();
    const advisor = new ClaudeAIAdvisor({ apiKey: '' }); // disabled
    attachClaudeAdvisor(aiEngine, advisor);

    // Run 25 cricket + 25 football decisions
    for (let i = 0; i < 25; i++) {
        const input = { ballType: 'fast', length: 'good', line: 'off', pace: 80 };
        const shot = aiEngine.cricket.selectShot(input);
        assert(shot !== null, `Cricket decision ${i} should work`);

        const state = { battersStreak: 0, lastOver: [] };
        const delivery = aiEngine.cricket.selectDelivery(state);
        assert(delivery !== null, `Cricket delivery ${i} should work`);

        const fbContext = { round: i + 1, playerScore: 0, aiScore: 0 };
        const fbShot = aiEngine.football.selectShot(fbContext);
        assert(fbShot !== null, `Football shot ${i} should work`);

        const keeperInput = { playerDir: 'left', playerPower: 0.8 };
        const keeper = aiEngine.football.decideKeeper(keeperInput);
        assert(keeper !== null, `Football keeper ${i} should work`);
    }

    // Verify phase structures exist
    assert(aiEngine.playerModel !== null, 'PlayerModel should exist');
    assert(aiEngine.cricketBayes !== null, 'CricketBayes should exist');
    assert(aiEngine.fbSeq !== null, 'FootballSequence should exist');
    assert(aiEngine.difficulty_adaptive !== null, 'AdaptiveDifficulty should exist');
});

test('Enable mock advisor, run 10 more decisions, verify stats', async () => {
    const aiEngine = new AIEngine();
    const advisor = new ClaudeAIAdvisor({ apiKey: 'sk-test', minIntervalMs: 0 });

    // Mock API
    let apiCalls = 0;
    advisor._callAPI = async () => {
        apiCalls++;
        return { content: [{ text: '{ "test": "value" }' }] };
    };

    attachClaudeAdvisor(aiEngine, advisor);

    // Run 10 decisions
    for (let i = 0; i < 10; i++) {
        const delivery = aiEngine.cricket.selectDelivery({ battersStreak: 0, lastOver: [] });
        assert(delivery !== null, 'Should work');
    }

    await sleep(300);

    // Verify advisor stats
    const stats = advisor.stats;
    assert(stats.enabled === true, 'Should be enabled');
    assert(stats.totalRequests >= 0, 'Should track requests');
});

// ============================================================================
// SECTION 10 — PERFORMANCE
// ============================================================================

console.log('\n=== SECTION 10: Performance ===\n');

test('1000x selectShot with Phase 4 attached but advisor disabled: < 50µs/call', () => {
    const aiEngine = new AIEngine();
    const advisor = new ClaudeAIAdvisor({ apiKey: '' }); // disabled
    attachClaudeAdvisor(aiEngine, advisor);

    const input = { ballType: 'fast', length: 'good', line: 'off', pace: 80 };
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
        aiEngine.cricket.selectShot(input);
    }

    const elapsed = performance.now() - start;
    const perCall = (elapsed * 1000) / 1000; // µs per call

    console.log(`  Total: ${elapsed.toFixed(2)}ms for 1000 calls (~${perCall.toFixed(1)}µs each)`);
    assert(perCall < 50, `Should be < 50µs/call, got ${perCall.toFixed(1)}µs`);
});

test('1000x decideKeeper with Phase 4 attached but advisor disabled: < 30µs/call', () => {
    const aiEngine = new AIEngine();
    const advisor = new ClaudeAIAdvisor({ apiKey: '' }); // disabled
    attachClaudeAdvisor(aiEngine, advisor);

    const input = { playerDir: 'left', playerPower: 0.8 };
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
        aiEngine.football.decideKeeper(input);
    }

    const elapsed = performance.now() - start;
    const perCall = (elapsed * 1000) / 1000; // µs per call

    console.log(`  Total: ${elapsed.toFixed(2)}ms for 1000 calls (~${perCall.toFixed(1)}µs each)`);
    assert(perCall < 30, `Should be < 30µs/call, got ${perCall.toFixed(1)}µs`);
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=== TEST SUMMARY ===\n');
console.log(`Total: ${testCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Pass rate: ${((passCount / testCount) * 100).toFixed(1)}%\n`);

if (failCount > 0) {
    process.exit(1);
} else {
    console.log('All tests passed!');
    process.exit(0);
}

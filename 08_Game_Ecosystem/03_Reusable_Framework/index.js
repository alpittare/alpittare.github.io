/**
 * Reusable Game Framework
 * Production-ready modular game engine for HTML5 Canvas games.
 * Extracted and refined from 3 production games: Cricket, Football, Baseball.
 *
 * Main entry point - exports all framework modules.
 */

'use strict';

// Core game engine
export { GameEngine, Entity } from './core/GameEngine.js';
export { StateManager } from './core/StateManager.js';

// Physics
export { PhysicsBody, CollisionSystem, Platform, BallPhysics } from './physics/PhysicsEngine.js';

// AI Engine (4-Phase system)
export { AIEngine } from './ai/AIEngine.js';
export { PlayerModel } from './ai/PlayerModel.js';
export { BayesPredictor } from './ai/BayesPredictor.js';
export { AdaptiveDifficulty } from './ai/AdaptiveDifficulty.js';

// Input & Audio
export { InputManager, SwipeDetector, VirtualJoystick } from './input/InputManager.js';
export { AudioEngine } from './audio/AudioEngine.js';

// Rendering
export { Renderer, Camera, ParticleSystem, TrailRenderer, Particle, Easing } from './rendering/Renderer.js';

// Game State & Persistence
export { GameState } from './state/GameState.js';

// Monetization
export { ShopSystem } from './monetization/ShopSystem.js';

// Campaign
export { CampaignManager } from './campaign/CampaignManager.js';

/**
 * Convenience factory for creating a complete game instance.
 *
 * @param {object} config - Game configuration
 * @param {string} config.canvasId - Canvas element ID
 * @param {number} [config.width=414] - Game width
 * @param {number} [config.height=896] - Game height
 * @param {string} [config.sport='cricket'] - Sport type
 * @param {boolean} [config.enableAI=true] - Enable AI
 * @param {boolean} [config.enableAudio=true] - Enable audio
 * @param {boolean} [config.enableShop=true] - Enable shop
 * @returns {Promise<object>} Game instance with all systems
 */
export async function createGame(config) {
    const {
        canvasId,
        width = 414,
        height = 896,
        sport = 'cricket',
        enableAI = true,
        enableAudio = true,
        enableShop = true
    } = config;

    // Initialize game state
    const gameState = new GameState();
    await gameState.initialize();

    // Create engine
    const engine = new GameEngine(canvasId, width, height);

    // Add systems
    const stateManager = new StateManager(engine);
    const inputManager = new InputManager(engine);
    const renderer = new Renderer(engine.ctx, width, height);

    // Optional systems
    let aiEngine = null;
    if (enableAI) {
        aiEngine = new AIEngine({ sport });
    }

    let audioEngine = null;
    if (enableAudio) {
        audioEngine = new AudioEngine();
        audioEngine.initContext();
    }

    let shopSystem = null;
    if (enableShop) {
        shopSystem = new ShopSystem(gameState);
    }

    const campaignManager = new CampaignManager(gameState);

    // Package everything
    const game = {
        engine,
        stateManager,
        inputManager,
        renderer,
        gameState,
        aiEngine,
        audioEngine,
        shopSystem,
        campaignManager,

        /**
         * Start the game loop.
         */
        start() {
            this.engine.start();
        },

        /**
         * Stop the game loop.
         */
        stop() {
            this.engine.stop();
        },

        /**
         * Get all game stats for HUD display.
         */
        getStats() {
            return {
                state: this.stateManager.getCurrentState(),
                fps: this.engine.fps,
                gameState: this.gameState.getSummary(),
                campaign: this.campaignManager.getStats()
            };
        },

        /**
         * Save game state.
         */
        async save() {
            return await this.gameState.save();
        },

        /**
         * Enable debug mode.
         */
        enableDebug(enable = true) {
            this.engine.debug = enable;
        }
    };

    return game;
}

// Version info
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

/**
 * Log framework info.
 */
export function logFrameworkInfo() {
    console.log(`%c Game Framework v${VERSION}`, 'color: #0f0; font-weight: bold; font-size: 14px');
    console.log('%c Built: ' + BUILD_DATE, 'color: #888');
    console.log('%c Modules:', 'color: #0ff; font-weight: bold');
    console.log('  - GameEngine (core loop, entity management)');
    console.log('  - StateManager (screen state machine)');
    console.log('  - PhysicsEngine (gravity, collision, resolution)');
    console.log('  - AIEngine (4-phase: rules, learning, prediction, Claude)');
    console.log('  - InputManager (touch, mouse, joystick)');
    console.log('  - AudioEngine (Web Audio synthesis)');
    console.log('  - Renderer (camera, particles, trails, easing)');
    console.log('  - GameState (persistence, localStorage, Capacitor)');
    console.log('  - ShopSystem (coins, gems, IAP, VIP)');
    console.log('  - CampaignManager (100 levels, progressive difficulty)');
}

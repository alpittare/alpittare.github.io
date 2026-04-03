/**
 * AudioEngine.js
 * Web Audio API synthesis engine for sound generation.
 * Zero external audio files — all sounds generated procedurally.
 * Mobile-optimized with iOS AudioContext resume workaround.
 *
 * Features:
 * - Oscillator-based synthesis (sine, square, triangle, sawtooth)
 * - ADSR envelope (attack, decay, sustain, release)
 * - Frequency sweep effects
 * - Chord generation
 * - Noise generation with bandpass filtering
 * - Predefined effects: hit, score, miss, click, surge, coin, levelup
 * - Master gain + mute control
 * - Node cleanup to prevent leaks
 *
 * @module audio/AudioEngine
 */

'use strict';

/**
 * AudioEngine creates and plays synthesized sounds.
 *
 * @class AudioEngine
 */
class AudioEngine {
    /**
     * @param {object} [config]
     * @param {number} [config.masterGain=0.3] - Master volume (0-1)
     */
    constructor(config = {}) {
        // Audio context (lazy-initialized)
        this._context = null;
        this._masterGain = null;
        this._isMuted = false;

        // Settings
        this.masterGainValue = config.masterGain || 0.3;

        // Active nodes for cleanup
        this._activeNodes = [];
        this._nodeCleanupQueue = [];
    }

    /**
     * Initialize or resume audio context (required on mobile).
     */
    initContext() {
        if (this._context) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn('Web Audio API not supported');
            return;
        }

        this._context = new AudioContext();

        // iOS workaround: resume on first user interaction
        if (this._context.state === 'suspended') {
            const resume = () => {
                this._context.resume();
                document.removeEventListener('touchend', resume);
            };
            document.addEventListener('touchend', resume);
        }

        // Master gain
        this._masterGain = this._context.createGain();
        this._masterGain.gain.value = this.masterGainValue;
        this._masterGain.connect(this._context.destination);
    }

    /**
     * Play a predefined sound effect.
     *
     * @param {string} effectName - 'hit', 'score', 'miss', 'click', 'surge', 'coin', 'levelup'
     * @param {object} [options] - Override parameters
     */
    playEffect(effectName, options = {}) {
        if (!this._context) this.initContext();
        if (!this._context || this._isMuted) return;

        const effects = {
            hit: { freq: 440, duration: 0.15, type: 'sine', adsr: [0.02, 0.08, 0, 0.05] },
            score: { freq: 800, duration: 0.3, type: 'sine', adsr: [0.05, 0.15, 0, 0.1] },
            miss: { freq: 200, duration: 0.2, type: 'sine', adsr: [0.05, 0.12, 0, 0.03] },
            click: { freq: 600, duration: 0.1, type: 'square', adsr: [0.01, 0.08, 0, 0.01] },
            surge: { freq: 1200, duration: 0.25, type: 'triangle', adsr: [0.05, 0.15, 0, 0.05] },
            coin: { freq: 1000, duration: 0.2, type: 'sine', adsr: [0.02, 0.15, 0, 0.03] },
            levelup: { freq: [400, 600, 800], duration: 0.5, type: 'sine', adsr: [0.05, 0.1, 0, 0.2] }
        };

        const effect = effects[effectName];
        if (!effect) {
            console.warn(`Unknown effect: ${effectName}`);
            return;
        }

        const config = { ...effect, ...options };
        this._playTone(config);
    }

    /**
     * Play a custom tone.
     *
     * @param {object} config
     * @param {number|number[]} config.freq - Frequency in Hz (or array for chord)
     * @param {number} config.duration - Duration in seconds
     * @param {string} [config.type='sine'] - 'sine', 'square', 'triangle', 'sawtooth'
     * @param {number[]} [config.adsr=[0.05, 0.1, 0.2, 0.1]] - Attack, decay, sustain, release
     * @param {number} [config.gain=0.5] - Oscillator gain
     * @private
     */
    _playTone(config) {
        const ctx = this._context;
        const now = ctx.currentTime;
        const freq = Array.isArray(config.freq) ? config.freq : [config.freq];
        const duration = config.duration || 0.5;
        const type = config.type || 'sine';
        const [a, d, s, r] = config.adsr || [0.05, 0.1, 0.2, 0.1];
        const gain = config.gain || 0.5;

        // Create oscillators for each frequency
        for (const f of freq) {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = type;
            osc.frequency.value = f;

            // ADSR envelope
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(gain, now + a); // Attack
            gainNode.gain.linearRampToValueAtTime(gain * s, now + a + d); // Decay
            gainNode.gain.setValueAtTime(gain * s, now + duration - r); // Sustain
            gainNode.gain.linearRampToValueAtTime(0, now + duration); // Release

            osc.connect(gainNode);
            gainNode.connect(this._masterGain);

            osc.start(now);
            osc.stop(now + duration);

            // Track for cleanup
            this._nodeCleanupQueue.push({ node: osc, time: now + duration + 0.1 });
            this._nodeCleanupQueue.push({ node: gainNode, time: now + duration + 0.1 });
        }

        // Cleanup old nodes periodically
        this._cleanupNodes();
    }

    /**
     * Play a frequency sweep (pitch slide).
     *
     * @param {number} startFreq - Starting frequency
     * @param {number} endFreq - Ending frequency
     * @param {number} duration - Duration in seconds
     * @param {string} [type='sine'] - Oscillator type
     */
    playSweep(startFreq, endFreq, duration = 0.5, type = 'sine') {
        if (!this._context) this.initContext();
        if (!this._context || this._isMuted) return;

        const ctx = this._context;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.linearRampToValueAtTime(endFreq, now + duration);

        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gainNode);
        gainNode.connect(this._masterGain);

        osc.start(now);
        osc.stop(now + duration);

        this._nodeCleanupQueue.push({ node: osc, time: now + duration + 0.1 });
        this._nodeCleanupQueue.push({ node: gainNode, time: now + duration + 0.1 });
    }

    /**
     * Play noise (useful for percussion).
     *
     * @param {number} duration - Duration in seconds
     * @param {number} [gain=0.3] - Volume
     */
    playNoise(duration = 0.1, gain = 0.3) {
        if (!this._context) this.initContext();
        if (!this._context || this._isMuted) return;

        const ctx = this._context;
        const now = ctx.currentTime;

        // Create noise buffer
        const bufferSize = ctx.sampleRate * duration;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        // Play with gain envelope
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();

        source.buffer = noiseBuffer;
        gainNode.gain.setValueAtTime(gain, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        source.connect(gainNode);
        gainNode.connect(this._masterGain);

        source.start(now);

        this._nodeCleanupQueue.push({ node: source, time: now + duration + 0.1 });
        this._nodeCleanupQueue.push({ node: gainNode, time: now + duration + 0.1 });
    }

    /**
     * Set master volume.
     *
     * @param {number} gain - 0-1
     */
    setMasterGain(gain) {
        this.masterGainValue = Math.max(0, Math.min(1, gain));
        if (this._masterGain) {
            this._masterGain.gain.value = this.masterGainValue;
        }
    }

    /**
     * Toggle mute.
     *
     * @returns {boolean} New mute state
     */
    toggleMute() {
        this._isMuted = !this._isMuted;
        if (this._masterGain) {
            this._masterGain.gain.value = this._isMuted ? 0 : this.masterGainValue;
        }
        return this._isMuted;
    }

    /**
     * Set mute state.
     *
     * @param {boolean} muted
     */
    setMuted(muted) {
        this._isMuted = muted;
        if (this._masterGain) {
            this._masterGain.gain.value = muted ? 0 : this.masterGainValue;
        }
    }

    /**
     * Get current audio context state.
     *
     * @returns {string} 'running', 'suspended', 'closed', or 'not-supported'
     */
    getState() {
        if (!this._context) return 'not-initialized';
        return this._context.state;
    }

    /**
     * Clean up old nodes from the queue.
     * @private
     */
    _cleanupNodes() {
        const now = this._context?.currentTime || 0;
        this._nodeCleanupQueue = this._nodeCleanupQueue.filter(item => {
            if (now >= item.time) {
                try {
                    item.node.disconnect();
                } catch (e) {
                    // Already disconnected
                }
                return false;
            }
            return true;
        });
    }

    /**
     * Stop all sounds immediately.
     */
    stopAll() {
        if (!this._context) return;

        // Stop and disconnect all nodes
        for (const item of this._nodeCleanupQueue) {
            try {
                item.node.stop(this._context.currentTime);
                item.node.disconnect();
            } catch (e) {
                // Already stopped/disconnected
            }
        }
        this._nodeCleanupQueue = [];
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioEngine };
}

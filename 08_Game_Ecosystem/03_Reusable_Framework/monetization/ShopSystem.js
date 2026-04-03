/**
 * ShopSystem.js
 * In-game shop and economy system.
 * Manages coins, gems, skins, themes, power-ups, daily rewards, and VIP passes.
 *
 * Features:
 * - Coin currency (earned through gameplay)
 * - Gem currency (premium/IAP)
 * - Shop with skins and themes (level-gated)
 * - Power-up inventory and activation
 * - Daily reward streak (7-tier)
 * - VIP pass system
 * - Superwall integration bridge
 *
 * @module monetization/ShopSystem
 */

'use strict';

/**
 * ShopSystem manages economy, store, and transactions.
 *
 * @class ShopSystem
 */
class ShopSystem {
    /**
     * @param {GameState} gameState - Reference to persistent game state
     * @param {object} [config]
     * @param {object} [config.coinRewards] - Reward multipliers
     * @param {object} [config.itemPrices] - Skin/theme prices
     */
    constructor(gameState, config = {}) {
        this.gameState = gameState;

        // Reward config
        this.coinRewards = config.coinRewards || {
            levelWin: 100,
            levelComplete: 50,
            challenge: 200,
            daily: 50
        };

        // Shop items (skins, themes)
        this.skins = this._initializeSkins();
        this.themes = this._initializeThemes();

        // Power-ups
        this.powerups = this._initializePowerups();

        // Daily rewards
        this.dailyRewards = [50, 100, 150, 200, 300, 400, 500]; // Tier rewards (coins)

        // VIP tiers
        this.vipTiers = {
            starter: { duration: 7 * 24 * 60 * 60 * 1000, price: 999, gems: 100 },
            pro: { duration: 30 * 24 * 60 * 60 * 1000, price: 4999, gems: 500 },
            elite: { duration: 365 * 24 * 60 * 60 * 1000, price: 49999, gems: 6000 }
        };

        // Transactions
        this._pendingPurchases = [];
    }

    /**
     * Initialize shop skins (level-gated cosmetics).
     * @private
     */
    _initializeSkins() {
        return {
            default: { name: 'Default', level: 1, price: 0, type: 'free' },
            bronze: { name: 'Bronze Player', level: 5, price: 500, type: 'coins' },
            silver: { name: 'Silver Player', level: 15, price: 2000, type: 'coins' },
            gold: { name: 'Gold Player', level: 30, price: 5000, type: 'coins' },
            diamond: { name: 'Diamond Elite', level: 50, price: 999, type: 'gems' },
            legendary: { name: 'Legendary Pro', level: 75, price: 1999, type: 'gems' }
        };
    }

    /**
     * Initialize themes.
     * @private
     */
    _initializeThemes() {
        return {
            default: { name: 'Classic', level: 1, price: 0, type: 'free', bg: '#000' },
            neon: { name: 'Neon', level: 10, price: 300, type: 'coins', bg: '#0a0a2e' },
            sunset: { name: 'Sunset', level: 20, price: 1000, type: 'coins', bg: '#ff6b35' },
            ocean: { name: 'Ocean', level: 30, price: 2000, type: 'coins', bg: '#0077be' },
            forest: { name: 'Forest', level: 40, price: 3000, type: 'coins', bg: '#1b4332' },
            cosmic: { name: 'Cosmic', level: 60, price: 499, type: 'gems', bg: '#0b0014' }
        };
    }

    /**
     * Initialize power-ups.
     * @private
     */
    _initializePowerups() {
        return {
            shield: { name: 'Shield', description: 'Prevent one failure', price: 200, type: 'coins' },
            doubleScore: { name: '2x Score', description: 'Double points for one match', price: 300, type: 'coins' },
            slowTime: { name: 'Slow Time', description: 'Slow down time by 50%', price: 500, type: 'coins' },
            extendTime: { name: 'Time+', description: 'Add 30 seconds', price: 250, type: 'coins' },
            aiWeakness: { name: 'AI Weakness', description: 'Reduce AI accuracy', price: 400, type: 'coins' },
            masterShot: { name: 'Master Shot', description: 'Guaranteed perfect shot', price: 600, type: 'coins' }
        };
    }

    /**
     * Award coins to player.
     *
     * @param {number} amount
     * @param {string} reason - 'level_win', 'challenge', 'daily', etc.
     */
    awardCoins(amount, reason = 'gameplay') {
        const reward = amount * (this._getVipMultiplier() || 1);
        this.gameState.coins += Math.floor(reward);
        this.gameState.coins_spent = this.gameState.coins_spent || 0;
        this.gameState.markDirty();
    }

    /**
     * Award gems (premium currency).
     *
     * @param {number} amount
     */
    awardGems(amount) {
        this.gameState.gems += amount;
        this.gameState.markDirty();
    }

    /**
     * Spend coins on an item.
     *
     * @param {string} itemId - Item identifier
     * @param {string} itemType - 'skin', 'theme', 'powerup'
     * @returns {boolean} Success
     */
    purchaseWithCoins(itemId, itemType) {
        const item = this._getItem(itemId, itemType);
        if (!item || item.type !== 'coins') {
            console.warn(`Invalid purchase: ${itemId} (${itemType})`);
            return false;
        }

        if (this.gameState.coins < item.price) {
            return false; // Insufficient funds
        }

        // Check level gate
        if (this.gameState.currentLevel < item.level) {
            return false; // Not unlocked
        }

        this.gameState.coins -= item.price;
        this.gameState.coins_spent = (this.gameState.coins_spent || 0) + item.price;

        // Apply purchase
        this._applyPurchase(itemId, itemType);
        this.gameState.markDirty();

        return true;
    }

    /**
     * Spend gems on an item.
     *
     * @param {string} itemId - Item identifier
     * @param {string} itemType - 'skin', 'theme', 'powerup'
     * @returns {boolean} Success
     */
    purchaseWithGems(itemId, itemType) {
        const item = this._getItem(itemId, itemType);
        if (!item || item.type !== 'gems') {
            console.warn(`Invalid purchase: ${itemId} (${itemType})`);
            return false;
        }

        if (this.gameState.gems < item.price) {
            return false; // Insufficient gems
        }

        this.gameState.gems -= item.price;
        this.gameState.gems_spent = (this.gameState.gems_spent || 0) + item.price;

        // Apply purchase
        this._applyPurchase(itemId, itemType);
        this.gameState.markDirty();

        return true;
    }

    /**
     * Purchase IAP through native store (iOS/Android).
     * Bridges to Superwall or native IAP.
     *
     * @param {string} productId - IAP product ID
     * @returns {Promise<boolean>}
     */
    async purchaseViaIAP(productId) {
        try {
            // Try native bridge first
            if (window.NativePurchase) {
                const result = await window.NativePurchase.purchase(productId);
                if (result.success) {
                    this._handleIAPCompletion(productId);
                    return true;
                }
            }

            // Fallback: Superwall
            if (window.Superwall) {
                window.Superwall.purchase(productId, {
                    onComplete: () => this._handleIAPCompletion(productId)
                });
                return true;
            }

            console.warn('No IAP system available');
            return false;
        } catch (e) {
            console.error('IAP error:', e);
            return false;
        }
    }

    /**
     * Handle IAP completion.
     * @private
     */
    _handleIAPCompletion(productId) {
        // Map product ID to gems/benefits
        const products = {
            'gems_100': 100,
            'gems_500': 500,
            'gems_1000': 1000,
            'starter_vip': 0, // VIP handling separate
            'pro_vip': 0,
            'elite_vip': 0
        };

        if (products[productId]) {
            if (productId.includes('vip')) {
                this._activateVip(productId.split('_')[0]);
            } else {
                this.awardGems(products[productId]);
            }
        }
    }

    /**
     * Activate power-up.
     *
     * @param {string} powerupId
     * @returns {boolean}
     */
    activatePowerup(powerupId) {
        if (!this.gameState.powerUpInventory[powerupId] || this.gameState.powerUpInventory[powerupId] <= 0) {
            return false;
        }

        this.gameState.powerUpInventory[powerupId]--;
        this.gameState.markDirty();

        // Emit activation event
        if (this.gameState._listeners?.powerup_activated) {
            this.gameState.emit('powerup_activated', { powerupId });
        }

        return true;
    }

    /**
     * Get daily reward (7-day streak).
     *
     * @returns {number} Coins awarded, or 0 if already claimed today
     */
    claimDailyReward() {
        const today = new Date().toDateString();
        const lastDate = this.gameState.lastDailyRewardDate;

        if (lastDate && lastDate.startsWith(today)) {
            return 0; // Already claimed today
        }

        const lastDateObj = lastDate ? new Date(lastDate) : new Date(0);
        const todayObj = new Date(today);
        const daysSince = (todayObj - lastDateObj) / (1000 * 60 * 60 * 24);

        // Reset streak if >1 day gap
        let streak = daysSince <= 1 ? (this.gameState.dailyRewardStreak || 0) + 1 : 1;
        if (streak > 7) streak = 7;

        const reward = this.dailyRewards[Math.min(streak - 1, 6)];
        this.awardCoins(reward, 'daily');

        this.gameState.dailyRewardStreak = streak;
        this.gameState.lastDailyRewardDate = new Date().toISOString();
        this.gameState.markDirty();

        return reward;
    }

    /**
     * Activate VIP pass.
     *
     * @param {string} tier - 'starter', 'pro', 'elite'
     * @returns {boolean}
     */
    activateVip(tier) {
        return this._activateVip(tier);
    }

    /**
     * Internal: Activate VIP.
     * @private
     */
    _activateVip(tier) {
        const tierData = this.vipTiers[tier];
        if (!tierData) return false;

        this.gameState.vipActive = true;
        this.gameState.vipExpiryDate = new Date(Date.now() + tierData.duration).toISOString();
        this.gameState.markDirty();
        return true;
    }

    /**
     * Check if VIP is active and not expired.
     *
     * @returns {boolean}
     */
    isVipActive() {
        if (!this.gameState.vipActive) return false;
        const expiry = new Date(this.gameState.vipExpiryDate || 0);
        return expiry > new Date();
    }

    /**
     * Get VIP coin multiplier.
     * @private
     */
    _getVipMultiplier() {
        return this.isVipActive() ? 1.5 : 1.0;
    }

    /**
     * Get shop item by ID.
     * @private
     */
    _getItem(itemId, itemType) {
        const collections = {
            skin: this.skins,
            theme: this.themes,
            powerup: this.powerups
        };
        return collections[itemType]?.[itemId];
    }

    /**
     * Apply purchase (add to inventory/ownership).
     * @private
     */
    _applyPurchase(itemId, itemType) {
        if (itemType === 'skin') {
            if (!this.gameState.ownedSkins.includes(itemId)) {
                this.gameState.ownedSkins.push(itemId);
            }
        } else if (itemType === 'theme') {
            if (!this.gameState.ownedThemes.includes(itemId)) {
                this.gameState.ownedThemes.push(itemId);
            }
        } else if (itemType === 'powerup') {
            if (!this.gameState.powerUpInventory[itemId]) {
                this.gameState.powerUpInventory[itemId] = 0;
            }
            this.gameState.powerUpInventory[itemId]++;
        }
    }

    /**
     * Get purchasable skins for current level.
     *
     * @returns {object} Available skins
     */
    getAvailableSkins() {
        const available = {};
        for (const id in this.skins) {
            const skin = this.skins[id];
            if (this.gameState.currentLevel >= skin.level) {
                available[id] = skin;
            }
        }
        return available;
    }

    /**
     * Get shop summary for HUD.
     *
     * @returns {object}
     */
    getSummary() {
        return {
            coins: this.gameState.coins,
            gems: this.gameState.gems,
            vipActive: this.isVipActive(),
            dailyStreak: this.gameState.dailyRewardStreak,
            powerupCount: Object.values(this.gameState.powerUpInventory || {}).reduce((s, v) => s + v, 0)
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShopSystem };
}

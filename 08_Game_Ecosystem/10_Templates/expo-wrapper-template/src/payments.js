// ============================================================================
// Payment Catalog - Superwall Products Configuration
// ============================================================================
// This file defines all in-app purchase products available in your game.
// These products are synced with Superwall, which handles:
// - Receipt validation
// - Cross-platform purchases (iOS/Android)
// - Subscription management
// - Promo codes and discounts
// ============================================================================

// TODO: Replace {{PLACEHOLDERS}} with your actual product IDs from Superwall
// Product IDs should follow the format: com.company.game.product_name

export const PaymentProducts = {
    // ============================================================================
    // Cosmetic Products (Visual Only)
    // ============================================================================
    COSMETICS: {
        // Paddle/Player Skins
        PADDLE_GOLD: {
            id: '{{PRODUCT_ID_PADDLE_GOLD}}',
            name: 'Gold Paddle',
            description: 'Premium golden paddle skin',
            price: 0.99,
            category: 'cosmetic',
            type: 'consumable',
        },
        PADDLE_NEON: {
            id: '{{PRODUCT_ID_PADDLE_NEON}}',
            name: 'Neon Paddle',
            description: 'Electric neon paddle skin',
            price: 0.99,
            category: 'cosmetic',
            type: 'consumable',
        },
        PADDLE_HOLOGRAPHIC: {
            id: '{{PRODUCT_ID_PADDLE_HOLOGRAPHIC}}',
            name: 'Holographic Paddle',
            description: 'Shimmering holographic paddle',
            price: 1.99,
            category: 'cosmetic',
            type: 'consumable',
        },

        // Court/Arena Skins
        COURT_CLAY: {
            id: '{{PRODUCT_ID_COURT_CLAY}}',
            name: 'Clay Court',
            description: 'Red clay court theme',
            price: 1.99,
            category: 'cosmetic',
            type: 'consumable',
        },
        COURT_NEON: {
            id: '{{PRODUCT_ID_COURT_NEON}}',
            name: 'Neon Court',
            description: 'Glowing neon court theme',
            price: 1.99,
            category: 'cosmetic',
            type: 'consumable',
        },
        COURT_RETRO: {
            id: '{{PRODUCT_ID_COURT_RETRO}}',
            name: 'Retro Court',
            description: '80s retro court theme',
            price: 1.99,
            category: 'cosmetic',
            type: 'consumable',
        },

        // Ball Skins
        BALL_GLOW: {
            id: '{{PRODUCT_ID_BALL_GLOW}}',
            name: 'Glowing Ball',
            description: 'Luminescent ball texture',
            price: 0.99,
            category: 'cosmetic',
            type: 'consumable',
        },
        BALL_HOLOGRAPHIC: {
            id: '{{PRODUCT_ID_BALL_HOLOGRAPHIC}}',
            name: 'Holographic Ball',
            description: 'Prismatic ball texture',
            price: 1.99,
            category: 'cosmetic',
            type: 'consumable',
        },

        // Avatar Packs
        AVATAR_PACK_1: {
            id: '{{PRODUCT_ID_AVATAR_PACK_1}}',
            name: 'Avatar Pack 1',
            description: '3 custom player avatars',
            price: 2.99,
            category: 'cosmetic',
            type: 'consumable',
        },
        AVATAR_PACK_2: {
            id: '{{PRODUCT_ID_AVATAR_PACK_2}}',
            name: 'Avatar Pack 2',
            description: '3 premium player avatars',
            price: 2.99,
            category: 'cosmetic',
            type: 'consumable',
        },

        // Cosmetic Bundle
        COSMETIC_BUNDLE: {
            id: '{{PRODUCT_ID_COSMETIC_BUNDLE}}',
            name: 'Cosmetic Bundle',
            description: 'All cosmetics at 40% off',
            price: 9.99,
            category: 'cosmetic',
            type: 'consumable',
            includesProducts: [
                'PADDLE_GOLD',
                'PADDLE_NEON',
                'COURT_NEON',
                'BALL_GLOW',
                'AVATAR_PACK_1',
            ],
        },
    },

    // ============================================================================
    // Gameplay Products (Functional)
    // ============================================================================
    GAMEPLAY: {
        // Power-ups and Consumables
        POWER_UPS_5: {
            id: '{{PRODUCT_ID_POWER_UPS_5}}',
            name: '5 Power-ups',
            description: 'Unlock 5 special power-up abilities',
            price: 2.99,
            category: 'gameplay',
            type: 'consumable',
            quantity: 5,
        },
        POWER_UPS_20: {
            id: '{{PRODUCT_ID_POWER_UPS_20}}',
            name: '20 Power-ups',
            description: 'Unlock 20 special power-up abilities (best value)',
            price: 7.99,
            category: 'gameplay',
            type: 'consumable',
            quantity: 20,
            isBestValue: true,
        },

        // Unlock Premium Challenges
        CHALLENGE_PACK: {
            id: '{{PRODUCT_ID_CHALLENGE_PACK}}',
            name: 'Challenge Pack',
            description: 'Unlock 5 premium challenge modes',
            price: 4.99,
            category: 'gameplay',
            type: 'consumable',
        },

        // Skill Boost (Temporary)
        SKILL_BOOST_1H: {
            id: '{{PRODUCT_ID_SKILL_BOOST_1H}}',
            name: '1 Hour Skill Boost',
            description: '+25% XP gain for 1 hour',
            price: 0.99,
            category: 'gameplay',
            type: 'consumable',
            duration: 3600, // seconds
        },
        SKILL_BOOST_24H: {
            id: '{{PRODUCT_ID_SKILL_BOOST_24H}}',
            name: '24 Hour Skill Boost',
            description: '+25% XP gain for 24 hours',
            price: 4.99,
            category: 'gameplay',
            type: 'consumable',
            duration: 86400,
        },
    },

    // ============================================================================
    // Premium Features (Removal Products)
    // ============================================================================
    PREMIUM: {
        // Ad Removal
        NO_ADS: {
            id: '{{PRODUCT_ID_NO_ADS}}',
            name: 'Remove Ads Forever',
            description: 'Play ad-free forever',
            price: 4.99,
            category: 'premium',
            type: 'non-consumable',
            features: [
                'No banner ads',
                'No interstitial ads',
                'No rewarded video prompts',
            ],
        },

        // Premium Pass (Monthly Subscription)
        MONTHLY_PASS: {
            id: '{{PRODUCT_ID_MONTHLY_PASS}}',
            name: 'Monthly Premium Pass',
            description: 'All premium features for 1 month',
            price: 9.99,
            category: 'premium',
            type: 'subscription',
            duration: 2592000, // 30 days in seconds
            features: [
                'No ads',
                'All cosmetics',
                'Daily bonus coins',
                'Early access to new features',
            ],
            isFeatured: true,
        },

        // Premium Pass (Annual Subscription)
        ANNUAL_PASS: {
            id: '{{PRODUCT_ID_ANNUAL_PASS}}',
            name: 'Annual Premium Pass',
            description: 'All premium features for 1 year (40% off)',
            price: 69.99,
            category: 'premium',
            type: 'subscription',
            duration: 31536000, // 365 days in seconds
            features: [
                'No ads',
                'All cosmetics',
                'Daily bonus coins (2x)',
                'Early access to new features',
                'Premium support',
            ],
            isBestValue: true,
        },

        // VIP Pass
        VIP_PASS: {
            id: '{{PRODUCT_ID_VIP_PASS}}',
            name: 'VIP Pass',
            description: 'Exclusive VIP treatment',
            price: 19.99,
            category: 'premium',
            type: 'non-consumable',
            features: [
                'Custom VIP badge',
                'VIP-only cosmetics',
                '2x all rewards',
                'Priority matchmaking',
                'Direct support channel',
            ],
        },
    },

    // ============================================================================
    // Currency Products (Virtual Currency)
    // ============================================================================
    CURRENCY: {
        COINS_500: {
            id: '{{PRODUCT_ID_COINS_500}}',
            name: '500 Coins',
            description: 'In-game currency for cosmetics',
            price: 2.99,
            category: 'currency',
            type: 'consumable',
            quantity: 500,
            currencyType: 'coins',
        },
        COINS_2500: {
            id: '{{PRODUCT_ID_COINS_2500}}',
            name: '2,500 Coins',
            description: 'In-game currency (best value)',
            price: 9.99,
            category: 'currency',
            type: 'consumable',
            quantity: 2500,
            currencyType: 'coins',
            isBestValue: true,
        },
        GEMS_100: {
            id: '{{PRODUCT_ID_GEMS_100}}',
            name: '100 Premium Gems',
            description: 'Premium currency for exclusive items',
            price: 4.99,
            category: 'currency',
            type: 'consumable',
            quantity: 100,
            currencyType: 'gems',
        },
        GEMS_550: {
            id: '{{PRODUCT_ID_GEMS_550}}',
            name: '550 Premium Gems',
            description: 'Premium currency (best value)',
            price: 19.99,
            category: 'currency',
            type: 'consumable',
            quantity: 550,
            currencyType: 'gems',
            isBestValue: true,
        },
    },
};

// ============================================================================
// Product Grouping Utilities
// ============================================================================

/**
 * Get all products in a category
 * @param {string} category - 'cosmetic', 'gameplay', 'premium', or 'currency'
 * @returns {object} Products in the category
 */
export function getProductsByCategory(category) {
    const allProducts = {
        cosmetic: PaymentProducts.COSMETICS,
        gameplay: PaymentProducts.GAMEPLAY,
        premium: PaymentProducts.PREMIUM,
        currency: PaymentProducts.CURRENCY,
    };
    return allProducts[category] || {};
}

/**
 * Get a single product by ID
 * @param {string} productId - The product identifier (e.g., 'PADDLE_GOLD')
 * @returns {object} Product object or null
 */
export function getProduct(productId) {
    for (const category in PaymentProducts) {
        for (const key in PaymentProducts[category]) {
            const product = PaymentProducts[category][key];
            if (product.id === productId || key === productId) {
                return product;
            }
        }
    }
    return null;
}

/**
 * Get featured products for display
 * @returns {array} Array of featured products
 */
export function getFeaturedProducts() {
    const featured = [];
    for (const category in PaymentProducts) {
        for (const key in PaymentProducts[category]) {
            const product = PaymentProducts[category][key];
            if (product.isFeatured) {
                featured.push({ key, ...product });
            }
        }
    }
    return featured;
}

/**
 * Get best value products for each category
 * @returns {object} Best value products by category
 */
export function getBestValueProducts() {
    const bestValue = {};
    for (const category in PaymentProducts) {
        for (const key in PaymentProducts[category]) {
            const product = PaymentProducts[category][key];
            if (product.isBestValue) {
                if (!bestValue[category]) {
                    bestValue[category] = [];
                }
                bestValue[category].push({ key, ...product });
            }
        }
    }
    return bestValue;
}

// ============================================================================
// Superwall Configuration
// ============================================================================

export const SuperwallConfig = {
    // API Key - TODO: Replace with your actual Superwall API key
    apiKey: '{{SUPERWALL_API_KEY}}',

    // Feature Flags
    features: {
        enableAds: true,
        enableShop: true,
        enableSubscriptions: true,
        enablePaywall: true,
    },

    // Paywall Configuration
    paywall: {
        requestCode: '{{PAYWALL_REQUEST_CODE}}', // Customizable by sport/game
        delay: 0, // ms before showing paywall
        backgroundColor: '#0f0f0f',
        cornerRadius: 16,
    },

    // Analytics Configuration
    analytics: {
        trackPurchases: true,
        trackImpressions: true,
        trackFailures: true,
    },

    // Price Display Configuration
    pricing: {
        showCrossSell: true,
        showBestValue: true,
        highlightBestValue: true,
        sortBy: 'price', // 'price' or 'recommendationScore'
    },
};

// ============================================================================
// Default Implementation Helper
// ============================================================================

/**
 * Initialize payment system
 * Call this from App.js to set up all payment products
 */
export async function initializePayments(userId) {
    // TODO: Initialize Superwall with your configuration
    try {
        console.log('Initializing payments for user:', userId);

        // Example Superwall initialization:
        // const Superwall = require('@superwall/react-native-superwall').default;
        // await Superwall.configure(userId, {
        //     apiKey: SuperwallConfig.apiKey,
        //     options: {
        //         isLogLevel: 'debug',
        //     },
        // });

        console.log('Payments initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing payments:', error);
        return false;
    }
}

/**
 * Purchase a product
 * @param {string} productKey - Product key from PaymentProducts (e.g., 'PADDLE_GOLD')
 */
export async function purchaseProduct(productKey) {
    try {
        const product = getProduct(productKey);
        if (!product) {
            console.error('Product not found:', productKey);
            return null;
        }

        console.log('Purchasing product:', product.name);

        // TODO: Implement actual purchase logic with Superwall
        // const result = await Superwall.purchaseProduct(product.id);
        // return result;

        return {
            success: true,
            productId: product.id,
            productKey: productKey,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Purchase error:', error);
        return null;
    }
}

/**
 * Restore purchases
 */
export async function restorePurchases() {
    try {
        console.log('Restoring purchases...');

        // TODO: Implement restore logic with Superwall
        // const result = await Superwall.restoreTransactions();
        // return result;

        return {
            success: true,
            restoredCount: 0,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Restore error:', error);
        return null;
    }
}

/**
 * Check if user has purchased a product
 * @param {string} productKey - Product key
 * @returns {boolean} True if purchased
 */
export async function isPurchased(productKey) {
    // TODO: Check against Superwall's records or local cache
    return false;
}

/**
 * Show paywall
 * @param {string} requestCode - Custom request code for this game
 */
export async function showPaywall(requestCode) {
    try {
        console.log('Showing paywall:', requestCode);

        // TODO: Implement with Superwall
        // await Superwall.register(requestCode);

        return true;
    } catch (error) {
        console.error('Error showing paywall:', error);
        return false;
    }
}

export default PaymentProducts;

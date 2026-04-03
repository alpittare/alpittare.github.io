# Integration Guide: Connecting All Pieces

## Overview

This guide explains how to wire together:
1. Framework modules → Game HTML
2. Game HTML → Expo wrapper (native)
3. Game → Convex backend
4. Game → Superwall payments
5. Game → localStorage + native preferences
6. Game → Web Audio
7. CI/CD → App Stores

Each section includes exact code snippets you can copy-paste.

---

## 1. Framework Modules → Game HTML

### What They Do

The framework modules are imported at the top of `game-template.html`:

```html
<!-- Located in: /00_Framework_Modules/ -->
<script src="../../../00_Framework_Modules/core.js"></script>
<script src="../../../00_Framework_Modules/audio.js"></script>
<script src="../../../00_Framework_Modules/input.js"></script>
<script src="../../../00_Framework_Modules/physics.js"></script>
<script src="../../../00_Framework_Modules/ai.js"></script>
<script src="../../../00_Framework_Modules/analytics.js"></script>
<script src="../../../00_Framework_Modules/backend.js"></script>
<script src="../../../00_Framework_Modules/payments.js"></script>
<script src="../../../00_Framework_Modules/storage.js"></script>
```

### Module Functions

Each module exports specific functions:

#### core.js - Game Loop & State
```javascript
// Available after import
CoreGame.init(canvas, config)      // Initialize game engine
CoreGame.registerScreen(name, obj)  // Register menu/game/shop screens
CoreGame.setScreen(name)           // Switch to different screen
CoreGame.gameLoop(callback)        // Main update loop
CoreGame.getState()                // Get current game state
```

**Usage in your game:**
```javascript
// game-template.html uses this implicitly in requestAnimationFrame loop
// You don't need to call it directly - the template handles it

// But you can access the state:
const currentState = window.gameState;  // Already exposed in template
```

#### audio.js - Sound & Music
```javascript
// Available after import
Audio.playSound(frequency, duration, volume)
Audio.playEffect(soundName)        // Play preset sound
Audio.playMusic(musicUrl)          // Play background music
Audio.setVolume(level)             // 0-1
Audio.stop()                       // Stop all audio
```

**Usage in your game:**
```javascript
// In handleGameInputRelease:
Audio.playSound(440, 0.1); // Play beep

// Or play preset sound:
if (gameState.score > gameState.opponentScore) {
    Audio.playEffect('win');
}
```

#### input.js - Touch/Mouse/Keyboard
```javascript
// Already wired in game-template.html
// inputState object tracks:
inputState.mouseX              // Current X
inputState.mouseY              // Current Y
inputState.isPressed           // Touch down?
inputState.isDragging          // Dragging?
inputState.dragDeltaX          // Horizontal drag distance
inputState.dragDeltaY          // Vertical drag distance
inputState.touchDuration       // How long touch held
```

**Usage in your game:**
```javascript
function handleGameInput(input) {
    // input.mouseX, input.mouseY are the tap location
    // input.touchDuration is how long they held it
    console.log(`Tapped at (${input.mouseX}, ${input.mouseY})`);
}

function handleGameInputRelease(input) {
    // input.dragDeltaX, dragDeltaY are swipe distance
    const swipeLength = Math.sqrt(
        input.dragDeltaX ** 2 + input.dragDeltaY ** 2
    );
    console.log(`Swiped ${swipeLength} pixels`);
}
```

#### physics.js - Physics Engine
```javascript
// Available after import
Physics.update(objects, dt)        // Update all objects
Physics.checkCollision(a, b)       // Check if two objects collide
Physics.applyForce(object, fx, fy) // Apply force to object
Physics.applyDrag(object, factor)  // Apply air resistance
```

**Usage in your game:**
```javascript
// In fixedUpdate (physics timestep):
// Update ball position with velocity
ball.x += ball.vx;
ball.y += ball.vy;

// Apply gravity
ball.vy += physicsConfig.gravity;

// Apply friction
ball.vx *= physicsConfig.friction;

// Check collision with paddle
if (Physics.checkCollision(ball, gameState.player)) {
    ball.vy *= -1;
    Audio.playSound(440, 0.1);
}
```

#### ai.js - AI Opponent
```javascript
// Available after import
AI.evaluateGameState(state, difficulty)  // Get AI move
AI.predictTrajectory(object)              // Predict future position
AI.makeDecision(state, options)           // AI makes decision
```

**Usage in your game:**
```javascript
// In aiStep():
const prediction = AI.predictTrajectory(ball, gameState.opponent);
gameState.opponent.targetX = prediction.x;

// Move towards target
if (gameState.opponent.x < gameState.opponent.targetX) {
    gameState.opponent.x += physicsConfig.playerSpeed;
}
```

#### analytics.js - Game Analytics
```javascript
// Available after import
Analytics.track(eventName, properties)  // Track custom event
Analytics.trackScreen(screenName)       // Track screen view
Analytics.setUserId(userId)            // Identify user
```

**Usage in your game:**
```javascript
// In startGame():
Analytics.track('game_started', {
    difficulty: gameState.stats.currentDifficulty,
    timestamp: new Date().toISOString(),
});

// In endGame():
Analytics.track('game_ended', {
    score: gameState.score,
    opponentScore: gameState.opponentScore,
    duration: gameState.gameTime,
    result: gameState.score > gameState.opponentScore ? 'win' : 'loss',
});
```

#### backend.js - Convex Integration
```javascript
// Available after import
Backend.connect(url)               // Connect to Convex
Backend.call(functionName, args)   // Call Convex function
Backend.submitGameResult(result)   // Shortcut for game results
```

**Usage in your game:**
```javascript
// In endGame():
const result = {
    userId: getUserId(),
    score: gameState.score,
    opponentScore: gameState.opponentScore,
    duration: gameState.gameTime,
    difficulty: gameState.stats.currentDifficulty,
};

Backend.call('submitGameResult', result).then(resultId => {
    console.log('Game result saved:', resultId);
});
```

#### payments.js - Superwall Integration
```javascript
// Available after import
Payments.purchaseProduct(productId)    // Buy item
Payments.restorePurchases()            // Restore old purchases
Payments.isPurchased(productId)        // Check ownership
Payments.getProducts()                 // Get all products
```

**Usage in your game:**
```javascript
// In shop screen, when user taps "Buy Gold Paddle":
Payments.purchaseProduct('PADDLE_GOLD').then(success => {
    if (success) {
        gameState.cosmetics.playerColor = '#d4af37'; // Gold color
        gameState.purchasedProducts['PADDLE_GOLD'] = true;
        Audio.playEffect('purchase');
    }
});
```

#### storage.js - Data Persistence
```javascript
// Available after import
Storage.save(key, value)           // Save data
Storage.load(key)                  // Load data
Storage.remove(key)                // Delete data
Storage.clear()                    // Clear all
```

**Usage in your game:**
```javascript
// In saveGameState():
Storage.save('gameState', JSON.stringify(gameState));
Storage.save('playerStats', gameState.stats);

// In loadGameState():
const saved = Storage.load('gameState');
if (saved) {
    gameState = JSON.parse(saved);
}
```

---

## 2. Game HTML → Expo WebView Wrapper

### How It Works

The Expo app (`App.js`) loads the game HTML in a WebView:

```javascript
<WebView
    source={{ html: gameHtmlContent }}
    ref={webViewRef}
    onMessage={handleWebViewMessage}
    injectedJavaScript={bridgeJavaScript}
/>
```

### Integration Points

#### A. Load Game HTML

In `App.js`, the game HTML is loaded as a string:

```javascript
function getGameHtml() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <!-- Your game HTML head -->
        </head>
        <body>
            <!-- Your game canvas -->
            <canvas id="gameCanvas"></canvas>

            <!-- Your game JavaScript -->
            <script>
                // All your game code here
            </script>
        </body>
        </html>
    `;
}
```

**Alternative: Load from File**

If game is large, load from file instead:

```javascript
import { Asset } from 'expo-asset';

async function loadGameHtml() {
    const asset = Asset.fromModule(require('./assets/game.html'));
    await asset.downloadAsync();
    return fetch(asset.uri).then(res => res.text());
}

// In component:
const [gameHtml, setGameHtml] = useState('');
useEffect(() => {
    loadGameHtml().then(setGameHtml);
}, []);

<WebView source={{ html: gameHtml }} />
```

#### B. Messaging Bridge

The Expo wrapper (`App.js`) establishes a bridge:

```javascript
// From JavaScript in game HTML:
window.ReactNativeWebView.postMessage(
    JSON.stringify({
        type: 'PURCHASE_PRODUCT',
        productId: 'PADDLE_GOLD'
    })
);

// Captured in App.js:
const handleWebViewMessage = (event) => {
    const message = JSON.parse(event.nativeEvent.data);

    if (message.type === 'PURCHASE_PRODUCT') {
        // Handle purchase in native code
        purchaseProductNative(message.productId);
    }
};
```

#### C. Two-Way Communication

To send messages FROM native TO game:

```javascript
// In App.js, send to game:
webViewRef.current.injectJavaScript(`
    window.dispatchEvent(new CustomEvent('native-message', {
        detail: {
            type: 'PURCHASE_COMPLETED',
            productId: '${productId}'
        }
    }));
`);

// In game HTML, listen:
window.addEventListener('native-message', (event) => {
    console.log('Received from native:', event.detail);

    if (event.detail.type === 'PURCHASE_COMPLETED') {
        gameState.purchasedProducts[event.detail.productId] = true;
    }
});
```

---

## 3. Game → Convex Backend Integration

### Setup

1. Initialize Convex in your project:
```bash
npm install convex
npx convex dev
```

2. Create backend functions (`convex/gameResults.js`) - see DEPLOYMENT_PLAYBOOK.md

### HTTP Calls from Game

The game calls Convex via HTTP (not SDK):

```javascript
const CONVEX_URL = 'https://your-project.convex.cloud';

// In game-template.html, SECTION 13:

async function sendGameResultToBackend(userId) {
    const result = {
        userId: userId,
        score: gameState.score,
        opponentScore: gameState.opponentScore,
        duration: gameState.gameTime,
        difficulty: gameState.stats.currentDifficulty,
    };

    try {
        const response = await fetch(`${CONVEX_URL}/api/gameResults/submitGameResult`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(result),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Game result submitted:', data);
        return data;
    } catch (error) {
        console.error('Error submitting game result:', error);
    }
}

// Call when game ends:
function endGame() {
    gameState.gameActive = false;
    gameState.currentScreen = 'gameover';

    // Submit result to backend
    const userId = localStorage.getItem('userId') || 'anonymous';
    sendGameResultToBackend(userId);
}
```

### Get Leaderboard from Backend

```javascript
async function fetchLeaderboard() {
    try {
        const response = await fetch(
            `${CONVEX_URL}/api/gameResults/getLeaderboard?limit=100`
        );
        const leaderboard = await response.json();

        // Display in game
        renderLeaderboard(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
    }
}

function renderLeaderboard(entries) {
    // Render leaderboard UI in your game
    entries.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.userId}: ${entry.score}`);
    });
}
```

---

## 4. Game → Superwall Payments Integration

### Superwall Products

Products are defined in `src/payments.js`:

```javascript
export const PaymentProducts = {
    COSMETICS: {
        PADDLE_GOLD: {
            id: 'com.yourcompany.game.paddle_gold',
            name: 'Gold Paddle',
            price: 0.99,
        },
    },
};
```

### Purchase Flow

In game HTML, when user taps "Buy":

```javascript
// In shop screen render:
drawButton(100, 100, 200, 60, 'BUY GOLD PADDLE ($0.99)', '#ffd700');

// In click handler:
canvas.addEventListener('click', (e) => {
    if (isClickOnButton(e, goldPaddleButton)) {
        initiatePurchase('PADDLE_GOLD');
    }
});

function initiatePurchase(productKey) {
    // Send message to Expo wrapper
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: 'PURCHASE_PRODUCT',
                productKey: productKey,
            })
        );
    } else {
        // Web fallback - show purchase dialog
        console.log('Would purchase:', productKey);
    }
}
```

### Handle Purchase Response (in App.js)

```javascript
const handleWebViewMessage = (event) => {
    const message = JSON.parse(event.nativeEvent.data);

    if (message.type === 'PURCHASE_PRODUCT') {
        purchaseWithSuperwall(message.productKey);
    }
};

async function purchaseWithSuperwall(productKey) {
    try {
        // Import Superwall
        const { Superwall } = require('@superwall/react-native-superwall');

        // Get product from catalog
        const product = PaymentProducts.COSMETICS[productKey] ||
                       PaymentProducts.GAMEPLAY[productKey] ||
                       PaymentProducts.PREMIUM[productKey];

        // Show Superwall paywall
        await Superwall.register(user);
        const result = await Superwall.purchaseProduct(product.id);

        if (result.status === 'purchased') {
            // Purchase successful - notify game
            webViewRef.current.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('native-message', {
                    detail: {
                        type: 'PURCHASE_COMPLETED',
                        productKey: '${productKey}',
                        success: true
                    }
                }));
            `);
        }
    } catch (error) {
        console.error('Purchase error:', error);
    }
}
```

### Handle Purchase in Game

```javascript
// In game HTML, listen for purchase confirmation:

window.addEventListener('native-message', (event) => {
    if (event.detail.type === 'PURCHASE_COMPLETED' && event.detail.success) {
        const { productKey } = event.detail;

        // Apply cosmetic/feature
        if (productKey === 'PADDLE_GOLD') {
            gameState.cosmetics.playerColor = '#d4af37';
            Audio.playEffect('purchase_success');
        }

        // Mark as owned
        gameState.purchasedProducts[productKey] = true;

        // Save to storage
        Storage.save('purchasedProducts', gameState.purchasedProducts);

        // Track analytics
        Analytics.track('product_purchased', {
            productKey: productKey,
        });
    }
});
```

---

## 5. Game → Local Storage & Native Preferences

### localStorage (Web/WebView)

Save game state:

```javascript
// In game-template.html, SECTION 12:

function saveGameState() {
    const state = {
        stats: gameState.stats,
        cosmetics: gameState.cosmetics,
        coins: gameState.coins,
        gems: gameState.gems,
        purchasedProducts: gameState.purchasedProducts,
    };

    try {
        localStorage.setItem('gameState', JSON.stringify(state));
        console.log('Game state saved');
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

// Load on startup:
function loadGameState() {
    try {
        const saved = localStorage.getItem('gameState');
        if (saved) {
            const state = JSON.parse(saved);
            Object.assign(gameState, state);
            console.log('Game state loaded');
        }
    } catch (e) {
        console.error('Error loading state:', e);
    }
}

// Save periodically
setInterval(saveGameState, 5000); // Every 5 seconds

// Load on init
window.addEventListener('load', loadGameState);
```

### Expo Preferences (Native)

For sensitive data, use Capacitor Preferences:

```bash
# Install
expo install @react-native-async-storage/async-storage
```

In `App.js`:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

async function savePlayerData(userId, playerData) {
    try {
        await AsyncStorage.setItem(
            `player_${userId}`,
            JSON.stringify(playerData)
        );
    } catch (e) {
        console.error('Error saving player data:', e);
    }
}

async function loadPlayerData(userId) {
    try {
        const data = await AsyncStorage.getItem(`player_${userId}`);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Error loading player data:', e);
        return null;
    }
}
```

---

## 6. Game → Web Audio API

### Simple Sounds

In game HTML:

```javascript
// SECTION 14: Audio

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, volume = 0.3) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duration);
}

// Use in game:
// Tennis hit sound
if (checkCollision(ball, gameState.player)) {
    playSound(440, 0.1);  // 440 Hz, 100ms
}

// Score sound
if (gameState.score > gameState.opponentScore) {
    playSound(523, 0.2);  // C5 note
}

// Win sound (chord)
function playWinSound() {
    playSound(262, 0.3); // C4
    setTimeout(() => playSound(330, 0.3), 100); // E4
    setTimeout(() => playSound(392, 0.3), 200); // G4
}
```

### Load Audio Files

```javascript
async function loadAudioFile(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

async function playAudioBuffer(buffer, volume = 0.5) {
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();

    source.buffer = buffer;
    source.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.value = volume;
    source.start(0);

    return source;
}

// Load and play background music
let musicBuffer;
loadAudioFile('/assets/music.mp3').then(buffer => {
    musicBuffer = buffer;
});

function playMusic() {
    playAudioBuffer(musicBuffer, 0.3);
}
```

---

## 7. CI/CD → App Stores

### GitHub Actions (Automatic Builds)

Create `.github/workflows/build.yml`:

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
    paths:
      - 'package.json'
      - 'app.json'
      - 'src/**'
      - '.github/workflows/build.yml'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install

      - run: npm run build:ios
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          EAS_BUILD_TOKEN: ${{ secrets.EAS_BUILD_TOKEN }}

      - run: npm run build:android
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          EAS_BUILD_TOKEN: ${{ secrets.EAS_BUILD_TOKEN }}

      - name: Submit to App Store
        run: npm run submit:ios
        if: success()
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}

      - name: Submit to Google Play
        run: npm run submit:android
        if: success()
        env:
          GOOGLE_PLAY_KEY: ${{ secrets.GOOGLE_PLAY_KEY }}
```

### Manual Build Command

```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Both
eas build --platform all --profile production

# Submit after build
eas submit --platform ios
eas submit --platform android
```

### Environment Variables

Store in GitHub Secrets:

```
Settings > Secrets > New repository secret

Name: EXPO_TOKEN
Value: (get from expo.dev account)

Name: EAS_BUILD_TOKEN
Value: (get from eas account)

Name: APPLE_ID
Value: your@apple.com

Name: APPLE_PASSWORD
Value: (app-specific password)

Name: GOOGLE_PLAY_KEY
Value: (service account JSON key)
```

---

## Integration Checklist

Before launching, verify all integrations:

- [ ] Game HTML loads in browser without errors
- [ ] All framework modules imported correctly
- [ ] Input handlers wired (touch/mouse/keyboard)
- [ ] Physics updates working (60 FPS)
- [ ] AI opponent moves and responds
- [ ] Audio plays on events
- [ ] Game state saves to localStorage
- [ ] Game loads previous state on startup
- [ ] Convex backend connected and receiving data
- [ ] Leaderboard displays correctly
- [ ] Shop displays all products
- [ ] Purchase flow initiates (messaging bridge works)
- [ ] Purchase confirmation received from native
- [ ] Game HTML renders correctly in Expo WebView
- [ ] Cosmetics apply correctly
- [ ] Stats persist across app restart
- [ ] Analytics events fire correctly
- [ ] No console errors in WebView
- [ ] App builds for iOS via EAS
- [ ] App builds for Android via EAS
- [ ] App submits to App Store
- [ ] App submits to Google Play
- [ ] Web version deploys to Vercel

---

## Testing Each Integration

### Test Input Integration

```javascript
// In browser console while game runs:
window.gameState.score = 10; // Should update display immediately
console.log(window.inputState); // Should show current touch info
```

### Test Audio Integration

```javascript
// Test sound:
playSound(440, 0.5);  // Should hear beep

// Test if audio context initialized:
console.log(window.audioContext.state); // Should be 'running'
```

### Test Backend Integration

```javascript
// Test Convex connection:
fetch('https://your-project.convex.cloud/api/gameResults/getLeaderboard')
    .then(r => r.json())
    .then(console.log);
```

### Test Payments Integration

```javascript
// Simulate purchase message:
if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PURCHASE_PRODUCT',
        productKey: 'PADDLE_GOLD'
    }));
}
```

### Test Storage Integration

```javascript
// Save test data:
localStorage.setItem('test', 'value');

// Reload page - data should persist:
console.log(localStorage.getItem('test')); // Should print 'value'
```

---

## Common Integration Issues

### Canvas Not Rendering
```javascript
// Check:
const canvas = document.getElementById('gameCanvas');
console.log('Canvas:', canvas);
console.log('Context:', canvas?.getContext('2d'));

// Common cause: wrong canvas ID
// Solution: Verify canvas id="gameCanvas" in HTML
```

### Input Not Working
```javascript
// Check:
console.log('Mouse position:', window.inputState.mouseX, window.inputState.mouseY);

// Common cause: event listener not attached
// Solution: Verify addEventListener calls in input section
```

### Sounds Not Playing
```javascript
// Check:
console.log('Audio context:', window.audioContext);
console.log('Audio state:', window.audioContext?.state);

// Common cause: audio context suspended (user interaction required)
// Solution: Add click-to-start on menu screen

canvas.addEventListener('click', () => {
    if (window.audioContext.state === 'suspended') {
        window.audioContext.resume();
    }
});
```

### Backend Not Receiving Data
```javascript
// Check fetch:
fetch('https://your-project.convex.cloud/api/test')
    .then(r => {
        console.log('Status:', r.status);
        console.log('Headers:', r.headers);
        return r.json();
    })
    .catch(e => console.error('Fetch failed:', e));

// Common cause: wrong URL or CORS
// Solution: Verify Convex URL in code
```

### Messaging Bridge Not Working
```javascript
// Check WebView message posting:
if (window.ReactNativeWebView) {
    console.log('ReactNativeWebView available');
    window.ReactNativeWebView.postMessage('test message');
} else {
    console.log('Not in WebView (testing in browser)');
}

// Common cause: testing in browser instead of app
// Solution: Test actual integration in Expo app
```

---

This guide provides the exact integration points needed to connect all pieces of your game ecosystem. Follow each section carefully for a smooth integration process.

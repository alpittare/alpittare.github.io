import React, { useEffect, useState, useRef } from 'react';
import { View, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

// ============================================================================
// {{GAME_NAME}} - Expo Wrapper
// ============================================================================
// This wrapper handles:
// 1. Loading the game HTML file (local or remote)
// 2. Bridging Superwall payments to the game
// 3. Safe area injection for notch/dynamic island
// 4. Platform detection for iOS/Android
// 5. Event handling and messaging
// ============================================================================

export default function App() {
    const webViewRef = useRef(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        async function prepare() {
            try {
                // Keep the splash screen visible while we load
                await SplashScreen.preventAutoHideAsync();

                // TODO: Load custom fonts if needed
                // await Font.loadAsync({
                //     'custom-font': require('./assets/fonts/CustomFont.ttf'),
                // });

                setIsReady(true);
            } catch (e) {
                console.warn('Error preparing app:', e);
            } finally {
                await SplashScreen.hideAsync();
            }
        }

        prepare();
    }, []);

    if (!isReady) {
        return <ActivityIndicator size="large" color="#ff6b35" />;
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
            <View style={{ flex: 1 }}>
                <GameWebView webViewRef={webViewRef} />
            </View>
        </SafeAreaView>
    );
}

// ============================================================================
// GameWebView Component - Handles WebView Loading and Bridge
// ============================================================================

function GameWebView({ webViewRef }) {
    const [webViewHeight, setWebViewHeight] = useState('100%');

    // Build the game HTML path
    // TODO: Change this to your actual game HTML location
    // For production, this could be a remote URL (e.g., https://cdn.example.com/game.html)
    const gameHtmlSource = Platform.OS === 'web'
        ? require('./assets/game.html')
        : { uri: 'file:///android_asset/game.html' }; // For Android
        // For iOS, use: { uri: 'file:///game.html' }

    // Injected JavaScript to inject safe area and set up messaging bridge
    const injectedJavaScript = `
        (function() {
            // Get safe area insets (notch, home indicator, etc.)
            const safeAreaInsets = {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            };

            // Try to get from StatusBar
            if (window.SafeAreaInsets) {
                Object.assign(safeAreaInsets, window.SafeAreaInsets);
            }

            // Inject safe area CSS
            const style = document.createElement('style');
            style.textContent = \`
                :root {
                    --safe-top: \${safeAreaInsets.top}px;
                    --safe-right: \${safeAreaInsets.right}px;
                    --safe-bottom: \${safeAreaInsets.bottom}px;
                    --safe-left: \${safeAreaInsets.left}px;
                }

                body {
                    padding-top: var(--safe-top);
                    padding-right: var(--safe-right);
                    padding-bottom: var(--safe-bottom);
                    padding-left: var(--safe-left);
                }
            \`;
            document.head.appendChild(style);

            // Set up messaging bridge for Superwall and other services
            window.ReactNativeWebView = {
                postMessage: function(message) {
                    // This will be handled by onMessage in WebView
                    window.parent.postMessage(message, '*');
                }
            };

            // Expose platform info to game
            window.PLATFORM_INFO = {
                platform: '${Platform.OS}',
                version: '${Platform.Version}',
                supportsNotch: ${Platform.OS === 'ios' ? 'true' : 'false'},
            };

            // Expose payment bridge for Superwall
            window.PaymentBridge = {
                purchaseProduct: function(productId) {
                    window.ReactNativeWebView.postMessage(
                        JSON.stringify({
                            type: 'PURCHASE_PRODUCT',
                            productId: productId,
                        })
                    );
                },
                restorePurchases: function() {
                    window.ReactNativeWebView.postMessage(
                        JSON.stringify({
                            type: 'RESTORE_PURCHASES',
                        })
                    );
                },
                getPurchasedProducts: function() {
                    window.ReactNativeWebView.postMessage(
                        JSON.stringify({
                            type: 'GET_PURCHASES',
                        })
                    );
                }
            };

            console.log('React Native bridge initialized');
        })();

        // Return true to stop the script
        true;
    `;

    const handleWebViewMessage = (event) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);

            switch (message.type) {
                case 'PURCHASE_PRODUCT':
                    console.log('Purchase requested for:', message.productId);
                    // TODO: Integrate with Superwall
                    // Superwall.register(user).then(() => {
                    //     Superwall.purchaseProduct(message.productId);
                    // });
                    break;

                case 'RESTORE_PURCHASES':
                    console.log('Restore purchases requested');
                    // TODO: Integrate with Superwall
                    // Superwall.restoreTransactions();
                    break;

                case 'GET_PURCHASES':
                    console.log('Get purchases requested');
                    // TODO: Query local purchases and send back to game
                    break;

                case 'LOG':
                    console.log('[Game]', message.message);
                    break;

                case 'ANALYTICS':
                    console.log('[Analytics]', message.event, message.properties);
                    // TODO: Send to analytics service
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling WebView message:', error);
        }
    };

    return (
        <WebView
            ref={webViewRef}
            source={{
                html: getGameHtml(), // Load embedded HTML
            }}
            style={{
                flex: 1,
                backgroundColor: '#0f0f0f',
                width: '100%',
                height: webViewHeight,
            }}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            scrollEnabled={false}
            injectedJavaScript={injectedJavaScript}
            onMessage={handleWebViewMessage}
            onNavigationStateChange={(navState) => {
                console.log('Navigation state changed:', navState.url);
            }}
            onError={(error) => {
                console.error('WebView error:', error);
            }}
            renderLoading={() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#ff6b35" />
                </View>
            )}
            // Set viewport to match canvas size
            viewportUserScalable={false}
            defaultZoom={100}
            // Allow notifications
            mixedContentMode="always"
        />
    );
}

// ============================================================================
// Helper: Load Game HTML
// ============================================================================

function getGameHtml() {
    // TODO: Replace this with your actual game.html content
    // This is a placeholder that loads a simple test game
    // For production, load from a file or remote URL

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
            <title>{{GAME_NAME}}</title>
            <style>
                * { margin: 0; padding: 0; }
                body {
                    width: 100vw;
                    height: 100vh;
                    overflow: hidden;
                    background: #0f0f0f;
                    font-family: Arial;
                }
                canvas {
                    display: block;
                    width: 100%;
                    height: 100%;
                }
            </style>
        </head>
        <body>
            <canvas id="gameCanvas"></canvas>
            <script>
                // Game initialization code goes here
                const canvas = document.getElementById('gameCanvas');
                const ctx = canvas.getContext('2d');

                canvas.width = 414;
                canvas.height = 896;

                // Test render
                ctx.fillStyle = '#1a472a';
                ctx.fillRect(0, 0, 414, 896);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('{{GAME_NAME}}', 207, 100);

                ctx.font = '16px Arial';
                ctx.fillStyle = '#cccccc';
                ctx.fillText('Loading...', 207, 200);

                // TODO: Load and run the actual game.html content here
                console.log('Game loaded');
            </script>
        </body>
        </html>
    `;
}

// ============================================================================
// Platform Detection Utilities
// ============================================================================

export const getPlatformInfo = () => ({
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    platformVersion: Platform.Version,
    supportsNotch: Platform.OS === 'ios' && Platform.Version >= 11,
});

// ============================================================================
// Superwall Integration Helper
// ============================================================================

export const initializeSuperwall = async (userId) => {
    // TODO: Initialize Superwall with your API key and user ID
    /*
    import { Superwall } from '@superwall/react-native-superwall';

    try {
        await Superwall.configure(
            userId,
            {
                apiKey: '{{SUPERWALL_API_KEY}}',
                options: {
                    isLogLevel: 'debug',
                }
            }
        );
        console.log('Superwall initialized');
    } catch (error) {
        console.error('Error initializing Superwall:', error);
    }
    */
};

// ============================================================================
// Payments Helper
// ============================================================================

export const purchaseProduct = async (productId) => {
    try {
        // TODO: Use actual Superwall/IAP implementation
        console.log('Attempting to purchase:', productId);

        // Send message to game
        if (webViewRef?.current) {
            webViewRef.current.postMessage(JSON.stringify({
                type: 'PURCHASE_STARTED',
                productId: productId,
            }));
        }
    } catch (error) {
        console.error('Purchase error:', error);
    }
};

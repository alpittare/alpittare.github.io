import { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SuperwallProvider, usePlacement } from 'expo-superwall';
import { COIN_PRODUCTS, VIP_PRODUCT, PLACEMENT_REWARDS } from './src/payments';

const GAME_HTML = require('./assets/game/index.html');

const SUPERWALL_API_KEYS = {
  ios: 'pk_SURVIVAL_ARENA_KEY',
};

const BG_COLOR = '#0a0a1a';
const BRIDGE_TAG = 'SurvivalArenaIO';

function GameScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const { registerPlacement } = usePlacement({
    onPresent: (info) => console.log(`[${BRIDGE_TAG}] Paywall presented:`, info),
    onDismiss: (info, result) => {
      console.log(`[${BRIDGE_TAG}] Paywall dismissed:`, info, result);
    },
    onError: (err) => console.error(`[${BRIDGE_TAG}] Paywall error:`, err),
  });

  // Handle messages from WebView game
  const onMessage = useCallback(async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log(`[${BRIDGE_TAG} Bridge]`, data);

      if (data.type === 'purchase') {
        // Check if VIP purchase
        if (data.productId === 'vip_yearly') {
          await registerPlacement({
            placement: VIP_PRODUCT.placement,
            feature() {
              if (webViewRef.current) {
                webViewRef.current.postMessage(JSON.stringify({
                  type: 'purchase_success',
                  productId: 'vip_yearly',
                  isVIP: true,
                }));
              }
            },
          });
          return;
        }

        // Coin pack purchase — trigger Superwall paywall
        const product = COIN_PRODUCTS.find(p => p.id === data.productId);
        if (!product) return;

        await registerPlacement({
          placement: product.placement,
          feature() {
            // Purchase successful — grant coins to game
            const coins = PLACEMENT_REWARDS[product.placement] || product.coins;
            if (webViewRef.current) {
              webViewRef.current.postMessage(JSON.stringify({
                type: 'purchase_success',
                productId: product.id,
                coins: coins,
              }));
            }
          },
        });
      }

      if (data.type === 'restore_purchases') {
        // Handle restore purchases
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'restore_complete',
          }));
        }
      }

      if (data.type === 'get_products') {
        // Game wants to know available products
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'products_list',
            products: COIN_PRODUCTS,
          }));
        }
      }
    } catch (e) {
      // Non-JSON messages, ignore
    }
  }, [registerPlacement]);

  const injectedJS = `
    (function() {
      window.__SAFE_AREA__ = {
        top: ${insets.top},
        bottom: ${insets.bottom},
        left: ${insets.left},
        right: ${insets.right}
      };
      window.__PLATFORM__ = '${Platform.OS}';
      window.__HAS_IAP__ = true;

      // Payment bridge API for game HTML to use
      window.NativePurchase = {
        buy: function(productId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'purchase',
            productId: productId
          }));
        },
        restore: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'restore_purchases'
          }));
        },
        getProducts: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'get_products'
          }));
        }
      };

      // Listen for native purchase results
      document.addEventListener('message', function(e) {
        try {
          var data = JSON.parse(e.data);
          if (data.type === 'purchase_success') {
            window.dispatchEvent(new CustomEvent('purchaseSuccess', { detail: data }));
          }
          if (data.type === 'products_list') {
            window.dispatchEvent(new CustomEvent('productsLoaded', { detail: data }));
          }
          if (data.type === 'restore_complete') {
            window.dispatchEvent(new CustomEvent('restoreComplete', { detail: data }));
          }
        } catch(ex) {}
      });
      // Also handle React Native's message event
      window.addEventListener('message', function(e) {
        try {
          var data = JSON.parse(e.data);
          if (data.type === 'purchase_success') {
            window.dispatchEvent(new CustomEvent('purchaseSuccess', { detail: data }));
          }
          if (data.type === 'products_list') {
            window.dispatchEvent(new CustomEvent('productsLoaded', { detail: data }));
          }
          if (data.type === 'restore_complete') {
            window.dispatchEvent(new CustomEvent('restoreComplete', { detail: data }));
          }
        } catch(ex) {}
      });

      window.dispatchEvent(new Event('nativeBridgeReady'));
    })();
    true;
  `;

  return (
    <View style={[styles.container, { backgroundColor: BG_COLOR }]}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <WebView
        ref={webViewRef}
        source={GAME_HTML}
        style={[styles.webview, {
          marginTop: insets.top,
          marginBottom: insets.bottom,
        }]}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        textInteractionEnabled={false}
        injectedJavaScript={injectedJS}
        onMessage={onMessage}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        renderToHardwareTextureAndroid={true}
        backgroundColor={BG_COLOR}
        allowsFullscreenVideo={true}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SuperwallProvider apiKeys={SUPERWALL_API_KEYS}>
        <GameScreen />
      </SuperwallProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: BG_COLOR },
});

# Infinite Voyager - Expo Setup

## Quick Start

1. Create the assets directory and copy the game:
```bash
mkdir -p assets/game
cp ../06_Infinite_Voyager_2026/dist/index.html assets/game/index.html
```

2. Add app icons (create or copy from another game):
```bash
# Copy placeholder icons from Cricket game
cp ../02_Cricket_AI_2026_Expo/assets/icon.png assets/icon.png
cp ../02_Cricket_AI_2026_Expo/assets/splash-icon.png assets/splash-icon.png
```

3. Install dependencies:
```bash
npm install
```

4. Run on iOS simulator:
```bash
npx expo start --ios
```

## Build for App Store

1. Update `app.json` with your Apple Team ID
2. Update `eas.json` with your App Store Connect App ID
3. Update `App.js` with your Superwall API key
4. Run: `eas build --platform ios --profile production`
5. Submit: `eas submit --platform ios`

# Infinite Voyager iOS Deployment Setup

## Current Status
All iOS deployment configuration files have been created in the root directory. Due to filesystem constraints, the following setup script must be run to organize them into their proper structure.

## Files Created

### Root Directory Files (move these to proper locations):
- **package.json** → Root (stays here)
- **capacitor.config.json** → Root (stays here)  
- **index.html** → Copy to dist/index.html
- **manifest.json** → Move to dist/manifest.json
- **sw.js** → Move to dist/sw.js
- **Contents.json** → Move to dist/AppIcon.appiconset/Contents.json
- **ios-build.yml** → Move to .github/workflows/ios-build.yml
- **SETUP.sh** → Setup script

## Quick Start

### Step 1: Organize Files
Run the provided setup script to move files into the proper directory structure:

```bash
bash SETUP.sh
```

This will create:
```
./
├── package.json
├── capacitor.config.json
├── index.html
├── .github/
│   └── workflows/
│       └── ios-build.yml
└── dist/
    ├── index.html
    ├── manifest.json
    ├── sw.js
    └── AppIcon.appiconset/
        └── Contents.json
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Create Icon Assets
You'll need to generate icon files for the AppIcon.appiconset directory:
- icon-20x20@2x.png (40x40 pixels)
- icon-20x20@3x.png (60x60 pixels)
- icon-29x29@2x.png (58x58 pixels)
- icon-29x29@3x.png (87x87 pixels)
- icon-40x40@2x.png (80x80 pixels)
- icon-40x40@3x.png (120x120 pixels)
- icon-60x60@2x.png (120x120 pixels)
- icon-60x60@3x.png (180x180 pixels)
- icon-76x76@1x.png (76x76 pixels)
- icon-76x76@2x.png (152x152 pixels)
- icon-83.5x83.5@2x.png (167x167 pixels)
- icon-1024x1024@1x.png (1024x1024 pixels)

### Step 4: Initialize Capacitor
```bash
npx cap init InfiniteVoyager com.infinitevoyager.app --web-dir dist
```

### Step 5: Add iOS Platform
```bash
npx cap add ios
npx cap sync ios
```

### Step 6: Copy Icons (if needed)
```bash
cp -r dist/AppIcon.appiconset ios/App/App/Assets.xcassets/
```

### Step 7: Open in Xcode
```bash
npx cap open ios
```

## Configuration Details

### capacitor.config.json
- App ID: com.infinitevoyager.app
- App Name: Infinite Voyager
- Web Directory: dist
- iOS Scheme: InfiniteVoyager
- Status Bar: Dark with #000011 background
- Splash Screen: 2000ms duration with #000011 background

### package.json
Includes dependencies for Capacitor 5.0.0:
- @capacitor/core
- @capacitor/ios
- @capacitor/status-bar
- @capacitor/splash-screen
- @capacitor/cli (dev)

### manifest.json (PWA)
- Display: fullscreen
- Orientation: portrait
- Theme Color: #000011
- Background Color: #000011
- Icons: 192x192 and 512x512 PNG

### sw.js (Service Worker)
- Caches index.html for offline support
- Uses 'infinite-voyager-v1' cache name

### ios-build.yml (GitHub Actions)
Complete CI/CD pipeline for App Store deployment:
- Builds on macOS 14
- Signs with Apple Certificate
- Exports as IPA
- Uploads to App Store Connect
- Requires GitHub Secrets (see GITHUB_SECRETS.md)

## GitHub Secrets Required

For the CI/CD pipeline to work, configure these secrets in GitHub Settings:

- `BUILD_CERTIFICATE_BASE64`: Base64 encoded .p12 certificate
- `P12_PASSWORD`: Password for the .p12 certificate
- `KEYCHAIN_PASSWORD`: Password for the temporary keychain
- `PROVISIONING_PROFILE_BASE64`: Base64 encoded .mobileprovision
- `PROVISIONING_PROFILE_NAME`: Name of provisioning profile
- `APPLE_TEAM_ID`: Apple Developer Team ID
- `APP_STORE_CONNECT_API_KEY_ID`: App Store Connect API Key ID
- `APP_STORE_CONNECT_ISSUER_ID`: App Store Connect Issuer ID
- `APP_STORE_CONNECT_API_KEY_BASE64`: Base64 encoded API Key (.p8)

## Troubleshooting

### If SETUP.sh fails
Manually organize files:
```bash
mkdir -p dist .github/workflows dist/AppIcon.appiconset
cp index.html dist/
mv manifest.json dist/
mv sw.js dist/
mv Contents.json dist/AppIcon.appiconset/
mv ios-build.yml .github/workflows/
```

### Build Issues
- Ensure Xcode Command Line Tools: `xcode-select --install`
- Check Node.js version: `node --version` (should be 18+)
- Clear cache: `rm -rf node_modules package-lock.json && npm install`

## File Sizes Summary
- index.html: 91K (game code)
- ios-build.yml: 5.3K (CI/CD workflow)
- capacitor.config.json: 754 bytes
- Contents.json: 1.5K (icon manifest)
- package.json: 528 bytes
- manifest.json: 468 bytes
- sw.js: 504 bytes

Total: ~109K

## Notes
- All UI elements have safe-area insets for notch handling
- Game uses fullscreen viewport-fit=cover
- Service worker caches for offline play
- Status bar is dark with translucent styling for game immersion

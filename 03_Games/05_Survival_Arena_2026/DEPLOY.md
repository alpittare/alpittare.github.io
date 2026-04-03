# Survival Arena IO — Deployment Guide

## Files Ready for Deploy (`dist/`)
```
dist/
├── index.html                  <- Main game (PWA entry point)
├── survival-arena-engine.html  <- Standalone version (no PWA)
├── manifest.json               <- PWA manifest
├── sw.js                       <- Service worker (offline support)
├── icon-192.png                <- PWA icon (192x192)
├── icon-512.png                <- PWA icon (512x512)
└── AppIcon.appiconset/         <- iOS App Store icons (all sizes)
```

---

## PATH 1: Deploy as PWA (Recommended — Fastest)

### Option A: Vercel (Best for mobile games)

1. Create GitHub repo:
```bash
cd "03_Games/05_Survival_Arena_2026"
git init
git add dist/
git commit -m "Survival Arena IO v1.0 — production build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/survival-arena-io.git
git push -u origin main
```

2. Go to https://vercel.com -> Sign in with GitHub
3. Import your `survival-arena-io` repo
4. Set **Root Directory** to `dist`
5. Click Deploy -> Done!
6. Your game is live at `https://survival-arena-io.vercel.app`

### Option B: Netlify (Drag & Drop)

1. Go to https://app.netlify.com/drop
2. Drag the entire `dist/` folder onto the page
3. Done! Get your URL instantly.

### Option C: GitHub Pages (Free)

1. Push to GitHub (same as step 1 above)
2. Go to repo -> Settings -> Pages
3. Source: Deploy from branch -> `main` -> `/dist`
4. Save -> Your game is at `https://YOUR_USERNAME.github.io/survival-arena-io/`

---

## PATH 2: iOS App Store (Capacitor)

### Prerequisites
- macOS with Xcode installed
- Apple Developer Account ($99/year)
- Node.js 18+

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Add iOS platform
npx cap add ios

# 3. Copy web assets to iOS
npx cap copy ios

# 4. Copy App Icons
cp -r dist/AppIcon.appiconset ios/App/App/Assets.xcassets/AppIcon.appiconset

# 5. Open in Xcode
npx cap open ios
```

In Xcode:
1. Set your Team (Apple Developer account)
2. Set Bundle Identifier: `com.survivalarenaio.app`
3. Select iPhone target
4. Product -> Archive -> Distribute App -> App Store Connect

---

## Quick Start (Fastest path to live)

**Netlify drag-and-drop takes 30 seconds:**
1. Open https://app.netlify.com/drop
2. Drag `dist/` folder
3. Share the URL with anyone — works on all phones instantly

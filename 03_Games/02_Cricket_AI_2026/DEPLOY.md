# CrickBot — Deployment Guide

## Files Ready for Deploy (`dist/`)
```
dist/
├── index.html          ← Main game (PWA entry point)
├── crickbot-standalone.html  ← Standalone version (no PWA)
├── manifest.json       ← PWA manifest
├── sw.js              ← Service worker (offline support)
├── icon-192.png       ← PWA icon (192x192)
└── icon-512.png       ← PWA icon (512x512)
```

---

## PATH 1: Deploy as PWA (Recommended — Fastest)

### Option A: Vercel (Best for mobile games)

1. Create GitHub repo:
```bash
cd "3. Games/CrickBot"
git init
git add dist/
git commit -m "CrickBot v1.0 — production build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/crickbot.git
git push -u origin main
```

2. Go to https://vercel.com → Sign in with GitHub
3. Import your `crickbot` repo
4. Set **Root Directory** to `dist`
5. Click Deploy → Done!
6. Your game is live at `https://crickbot.vercel.app`

### Option B: Netlify (Drag & Drop)

1. Go to https://app.netlify.com/drop
2. Drag the entire `dist/` folder onto the page
3. Done! Get your URL instantly.

### Option C: GitHub Pages (Free)

1. Push to GitHub (same as step 1 above)
2. Go to repo → Settings → Pages
3. Source: Deploy from branch → `main` → `/dist`
4. Save → Your game is at `https://YOUR_USERNAME.github.io/crickbot/`

---

## PATH 2: iOS App Store (Capacitor)

### Prerequisites
- macOS with Xcode installed
- Apple Developer Account ($99/year)
- Node.js 18+

### Steps

```bash
# 1. Create Capacitor project
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios

# 2. Initialize Capacitor
npx cap init CrickBot com.yourname.crickbot --web-dir dist

# 3. Add iOS platform
npx cap add ios

# 4. Copy web assets to iOS
npx cap copy ios

# 5. Open in Xcode
npx cap open ios
```

In Xcode:
1. Set your Team (Apple Developer account)
2. Set Bundle Identifier: `com.yourname.crickbot`
3. Select iPhone target
4. Product → Archive → Distribute App → App Store Connect

---

## Supabase (Only if you need backend)

You do NOT need Supabase for the current game. It uses localStorage.

Use Supabase only if you want to add:
- Global leaderboards
- Cloud save sync across devices
- User authentication
- Analytics

---

## Quick Start (Fastest path to live)

**Netlify drag-and-drop takes 30 seconds:**
1. Open https://app.netlify.com/drop
2. Drag `dist/` folder
3. Share the URL with anyone — works on all phones instantly

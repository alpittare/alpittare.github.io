# iOS App Store Deployment Guide (Windows + GitHub Actions)

## Prerequisites
- Apple Developer Account ($99/year) — https://developer.apple.com/programs/
- GitHub account (free)

---

## Step 1: Create App Store Connect API Key

1. Go to https://appstoreconnect.apple.com/access/integrations/api
2. Click **Generate API Key**
3. Name: `GitHub Actions`
4. Access: `App Manager`
5. Download the `.p8` file — save it securely (you can only download once)
6. Note down: **Key ID** and **Issuer ID** (shown on the page)

---

## Step 2: Create Distribution Certificate

Since you're on Windows, use Apple's web portal:

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click **+** to create a new certificate
3. Select **Apple Distribution**
4. You need a CSR (Certificate Signing Request). On Windows:
   - Install OpenSSL (via Git Bash or standalone)
   - Run: `openssl req -new -newkey rsa:2048 -nodes -keyout distribution.key -out distribution.csr`
   - Fill in your details when prompted
5. Upload the CSR to Apple's portal
6. Download the `.cer` file
7. Convert to `.p12`:
   ```bash
   openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
   openssl pkcs12 -export -out distribution.p12 -inkey distribution.key -in distribution.pem
   ```
   Set a password when prompted — note it down

---

## Step 3: Create Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles/list
2. Click **+** → **App Store Connect** (under Distribution)
3. Select your App ID (create one if needed):
   - CrickBot: `com.crickbot.app`
   - GoalBot: `com.goalbot.app`
4. Select your Distribution Certificate
5. Name the profile (e.g., `CrickBot App Store`)
6. Download the `.mobileprovision` file

---

## Step 4: Create App IDs (if not done in Step 3)

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click **+** → **App IDs** → **App**
3. Description: `CrickBot` / `GoalBot`
4. Bundle ID: `com.crickbot.app` / `com.goalbot.app`
5. Capabilities: check **In-App Purchase**
6. Register

---

## Step 5: Encode Secrets as Base64

On Windows (Git Bash or PowerShell):

```bash
# Certificate (.p12)
base64 -i distribution.p12 | tr -d '\n' > cert_base64.txt

# Provisioning Profile (.mobileprovision)
base64 -i CrickBot_AppStore.mobileprovision | tr -d '\n' > pp_base64.txt

# API Key (.p8)
base64 -i AuthKey_XXXXXXXX.p8 | tr -d '\n' > apikey_base64.txt
```

Or in PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("distribution.p12")) | Out-File cert_base64.txt -NoNewline
[Convert]::ToBase64String([IO.File]::ReadAllBytes("CrickBot_AppStore.mobileprovision")) | Out-File pp_base64.txt -NoNewline
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXX.p8")) | Out-File apikey_base64.txt -NoNewline
```

---

## Step 6: Add GitHub Secrets

For each repo (CrickBot and GoalBot), go to:
**Settings → Secrets and variables → Actions → New repository secret**

Add these 7 secrets:

| Secret Name | Value |
|---|---|
| `BUILD_CERTIFICATE_BASE64` | Contents of `cert_base64.txt` |
| `P12_PASSWORD` | The password you set when exporting .p12 |
| `KEYCHAIN_PASSWORD` | Any random string (e.g., `gh-actions-keychain-2026`) |
| `PROVISIONING_PROFILE_BASE64` | Contents of `pp_base64.txt` |
| `PROVISIONING_PROFILE_NAME` | Name of the profile (e.g., `CrickBot App Store`) |
| `APPLE_TEAM_ID` | Your 10-character Team ID (find at developer.apple.com/account) |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID from Step 1 |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from Step 1 |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Contents of `apikey_base64.txt` |

---

## Step 7: Push Code & Build

```bash
git push origin main
```

The GitHub Actions workflow will:
1. Install Node.js + npm dependencies
2. Initialize Capacitor iOS project
3. Copy app icons
4. Build the Xcode project
5. Sign with your certificate
6. Export IPA
7. Upload to App Store Connect

---

## Step 8: Submit for Review

1. Go to https://appstoreconnect.apple.com
2. Select your app
3. The build should appear under **TestFlight** or **App Store** tab
4. Fill in:
   - App description, keywords, screenshots
   - Privacy Policy URL: `https://exafabs.ai/privacy-policy/`
   - Age Rating: 4+ (no objectionable content)
   - Category: Games → Sports
5. Submit for Review

---

## Troubleshooting

- **Build fails**: Check Actions tab on GitHub for logs
- **Code signing error**: Verify certificate + profile match the same Team ID and App ID
- **Upload fails**: Ensure API Key has App Manager access
- **Manual trigger**: Go to Actions tab → iOS Build & Deploy → Run workflow

---

## File Structure

```
CrickBot/
├── .github/workflows/ios-build.yml  ← CI/CD pipeline
├── dist/                            ← Production web app
│   ├── index.html                   ← PWA entry point
│   ├── crickbot-standalone.html     ← Standalone game
│   ├── manifest.json                ← PWA manifest
│   ├── sw.js                        ← Service worker
│   ├── icon-192.png                 ← PWA icon
│   ├── icon-512.png                 ← PWA icon
│   └── AppIcon.appiconset/          ← Full iOS icon set + Contents.json
├── capacitor.config.json            ← Capacitor config
├── package.json                     ← Dependencies
├── DEPLOY.md                        ← Deployment docs
└── .gitignore
```

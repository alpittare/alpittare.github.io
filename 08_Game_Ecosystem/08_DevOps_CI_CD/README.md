# DevOps & CI/CD Documentation

**Game Ecosystem DevOps Guide**
CrickBot AI | GoalBot AI | BaseHit AI

---

## Table of Contents

1. [Repository Structure](#repository-structure)
2. [Branching Strategy](#branching-strategy)
3. [Commit Conventions](#commit-conventions)
4. [Pull Request Workflow](#pull-request-workflow)
5. [CI/CD Pipeline Overview](#cicd-pipeline-overview)
6. [Deployment Procedures](#deployment-procedures)
7. [Environment Setup](#environment-setup)
8. [Troubleshooting](#troubleshooting)

---

## Repository Structure

### Multi-Repo Architecture

Each game has its own GitHub repository with shared DevOps infrastructure:

```
ecosystem/
├── 00_template_game/          # Base template for new games
├── cricket-ai-2026/           # Cricket game repo (separate GitHub repo)
│   ├── src/                   # Game source code
│   ├── ios/                   # iOS platform code
│   ├── .github/workflows/     # CI/CD pipelines
│   └── package.json
├── football-ai-2026/          # Football game repo (separate GitHub repo)
│   └── [same structure]
├── baseball-ai-2026/          # Baseball game repo (separate GitHub repo)
│   └── [same structure]
└── 08_DevOps_CI_CD/           # Shared DevOps config (this folder)
    ├── workflows/             # GitHub Actions templates
    ├── configs/               # Environment & build config
    └── scripts/               # Automation scripts
```

### Ecosystem Folder Structure

```
08_Game_Ecosystem/
├── 00_Game_Source/            # Consolidated source files
├── 01_UI_Framework/           # Shared UI components
├── 02_AI_System/              # Shared AI engine
├── 03_Audio_Engine/           # Shared audio system
├── 04_Physics_Engine/         # Shared physics
├── 05_Database_Integration/   # Convex schema & queries
├── 06_Mobile_Deployment/      # iOS/Android configs
├── 07_Privacy_Legal/          # Privacy policy & legal docs
├── 08_DevOps_CI_CD/           # This folder: CI/CD pipelines
└── 09_QA_Testing/             # Test suites & QA docs
```

---

## Branching Strategy

We use a modified Git Flow with main/dev/feature branches.

### Branch Types

#### `main` (Production)
- **Purpose:** Production-ready code
- **Protection:** Requires PR review + CI pass
- **Deployment:** Automatic iOS App Store upload
- **Commit Status:** Release tags (v1.0.0, v1.0.1, etc.)

#### `dev` (Development/Staging)
- **Purpose:** Integration branch for features
- **Protection:** Requires PR review
- **Deployment:** Optional staging deployment
- **Source:** Feature branches merge here first

#### `feature/*` (Feature Branches)
- **Purpose:** Individual feature development
- **Naming:** `feature/game-mechanic`, `feature/fix-ai-bug`
- **Source:** Branch from `dev`
- **Target:** PR to `dev`, then `dev` merges to `main`

#### `hotfix/*` (Emergency Fixes)
- **Purpose:** Critical production fixes
- **Naming:** `hotfix/crash-fix`, `hotfix/payment-issue`
- **Source:** Branch directly from `main`
- **Target:** PR to `main` AND `dev`
- **Deployment:** Immediate to production

#### `release/*` (Release Preparation)
- **Purpose:** Release candidate testing
- **Naming:** `release/v1.0.0`
- **Source:** Branch from `dev`
- **Target:** PR to `main`
- **Deployment:** TestFlight/staging

### Branch Naming Convention

```
feature/brief-description       # New feature
bugfix/brief-description        # Bug fix
hotfix/brief-description        # Critical production fix
release/v1.0.0                  # Release candidate
chore/brief-description         # Maintenance/refactor
docs/brief-description          # Documentation
```

### Branch Creation Example

```bash
# Create feature branch from dev
git checkout dev
git pull origin dev
git checkout -b feature/new-game-mode
# ... make changes ...
git push -u origin feature/new-game-mode

# Create PR to dev on GitHub
# After review & merge, dev is merged to main via separate PR
```

---

## Commit Conventions

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type (Required)
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `style`: Code style (formatting, missing semicolons)
- `test`: Test additions/changes
- `docs`: Documentation
- `ci`: CI/CD configuration
- `chore`: Build, dependencies, configuration

### Scope (Optional)
Game subsystem or file affected:
- `ai-engine`, `physics`, `audio`, `ui`, `convex`, `payment`, `leaderboard`

### Subject (Required)
- Imperative, present tense: "add feature" not "added feature"
- No period at end
- Maximum 50 characters
- First letter capitalized

### Body (Optional)
- Explain **what** and **why**, not how
- Wrap at 72 characters
- Separate from subject with blank line

### Footer (Optional)
Reference issues and breaking changes:
- `Fixes #123`
- `Breaks: Previous API compatibility`

### Examples

```
feat(ai-engine): add phase 2 player modeling

Implements dynamic difficulty based on player performance metrics.
Tracks running average of player decisions to adjust AI strategy.

Fixes #456
```

```
fix(physics): resolve ball clipping through walls

Updated collision detection to use margin-based approach
instead of ray-casting to prevent physics tunneling.

Fixes #789
```

```
refactor(ui): consolidate button components

Merged ButtonPrimary and ButtonSecondary into single Button
with variant prop for reduced duplication.
```

---

## Pull Request Workflow

### Creating a Pull Request

1. **Push feature branch to GitHub**
   ```bash
   git push -u origin feature/my-feature
   ```

2. **Open PR on GitHub**
   - Use PR template (auto-populated)
   - Link related issues: `Fixes #123`
   - Add description of changes
   - Request 1-2 reviewers

3. **PR Template Fields**
   ```markdown
   ## Description
   What does this PR do?

   ## Type of Change
   - [ ] New feature
   - [ ] Bug fix
   - [ ] Breaking change
   - [ ] Documentation update

   ## How Has This Been Tested?
   What tests verify this change?

   ## Checklist
   - [ ] Tests pass locally
   - [ ] No console errors
   - [ ] Code reviewed by me
   - [ ] Privacy/security implications considered
   ```

### PR Review Process

1. **Automated Checks**
   - GitHub Actions CI runs (build, tests, lint)
   - Code coverage analysis
   - Security scanning

2. **Manual Review**
   - At least 1 reviewer required
   - Look for: logic, style, edge cases, performance
   - Request changes if needed

3. **Approval & Merge**
   - Approve PR after addressing feedback
   - Use "Squash and merge" for clean history
   - Delete branch after merge

### PR Status Rules

| Status | Action |
|--------|--------|
| ❌ CI Failed | Fix issues, push new commit |
| ⏳ Awaiting Review | Wait for reviewer |
| 📝 Changes Requested | Address feedback, push new commit |
| ✅ Approved | Merge to target branch |
| 🚀 Main Branch | Auto-deploy to production |

---

## CI/CD Pipeline Overview

### Workflow Triggers

| Workflow | Trigger | Target |
|----------|---------|--------|
| `ios-build.yml` | Push to main | iOS App Store |
| `web-deploy.yml` | Push to main | Vercel |
| `web-deploy.yml` | PR to main | Vercel preview |
| `eas-build.yml` | Push to main | TestFlight |

### iOS Build Pipeline

```
Code Push to main
    ↓
Checkout code
    ↓
Install npm dependencies
    ↓
Sync Capacitor platform
    ↓
Setup Xcode environment
    ↓
Import signing certificate
    ↓
Build iOS archive
    ↓
Export for App Store
    ↓
Upload to App Store Connect
    ↓
Notify Slack
```

**Duration:** 90-120 minutes
**Status:** Check GitHub Actions tab

### Web Deployment Pipeline

```
Code Push to main
    ↓
Checkout code
    ↓
Install dependencies
    ↓
Build Next.js app
    ↓
Upload artifacts
    ↓
Deploy to Vercel
    ↓
Smoke test
    ↓
Create deployment record
```

**Duration:** 20-30 minutes
**Live URL:** Auto-posted in PR comments

### EAS Build Pipeline

```
Code Push to main
    ↓
Checkout code
    ↓
Install dependencies
    ↓
Login to Expo
    ↓
Build iOS with EAS
    ↓
(Optional) Submit to App Store
    ↓
Notify Slack
```

**Duration:** 60-90 minutes
**Build Status:** View in EAS dashboard

---

## Deployment Procedures

### Deploying to Production

#### Step 1: Prepare Release Branch
```bash
git checkout dev
git pull origin dev
git checkout -b release/v1.0.0
```

#### Step 2: Update Version
- Update `package.json`: `"version": "1.0.0"`
- Update `ios/App/App.xcodeproj`: Build version
- Update `app.json`: `expo.version`

#### Step 3: Create Changelog
Create `CHANGELOG.md`:
```markdown
## [1.0.0] - 2026-03-30

### Added
- New game mode
- Improved AI

### Fixed
- Physics bug #123
- Payment issue #456
```

#### Step 4: Open PR to Main
```bash
git commit -m "chore(release): v1.0.0"
git push -u origin release/v1.0.0
# Open PR on GitHub
```

#### Step 5: Code Review & Merge
- Get 2 approvals minimum for releases
- Merge PR to `main`
- CI/CD automatically deploys

#### Step 6: Create Release Tag
```bash
git checkout main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

#### Step 7: Monitor Deployment
- Watch GitHub Actions: https://github.com/alpittare/[game]/actions
- Check App Store Connect for build status
- Verify Vercel deployment: https://[game].vercel.app

### Hotfix Deployment (Emergency)

For critical production bugs:

```bash
# Branch from main
git checkout main
git checkout -b hotfix/critical-crash

# Fix bug
git commit -m "fix(physics): resolve crash in level 5"

# Push and open PR
git push -u origin hotfix/critical-crash

# After merge to main:
git checkout main
git tag -a v1.0.1-hotfix -m "Hotfix for crash"
git push origin v1.0.1-hotfix
```

---

## Environment Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Xcode 15+ (for iOS development)
- GitHub account with SSH keys
- Apple Developer account
- Expo/EAS account

### Local Development Setup

```bash
# Clone repository
git clone git@github.com:alpittare/cricket-ai-2026.git
cd cricket-ai-2026

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev

# Start iOS development (Capacitor)
npm run dev:ios
```

### GitHub Secrets Configuration

Each game repository needs these secrets in **Settings > Secrets and variables > Actions**:

```
CONVEX_URL                  # https://your-project.convex.cloud
CONVEX_DEPLOY_KEY          # From Convex dashboard
APPLE_TEAM_ID              # From Apple Developer account
ASC_APP_ID                 # From App Store Connect
CERTIFICATE_BASE64         # base64-encoded .p12 signing cert
CERTIFICATE_PASSWORD       # Password for certificate
PROVISIONING_PROFILE       # base64-encoded .mobileprovision
SUPERWALL_API_KEY          # From Superwall dashboard
APP_STORE_CONNECT_API_KEY  # From App Store Connect
APP_STORE_ISSUER_ID        # From App Store Connect
APP_STORE_KEY_ID           # From App Store Connect
VERCEL_TOKEN               # From Vercel dashboard
VERCEL_PROJECT_ID          # From Vercel project
VERCEL_ORG_ID              # From Vercel account
EXPO_TOKEN                 # From Expo account
EXPO_ACCOUNT               # Expo account username
SLACK_WEBHOOK              # (Optional) Slack webhook URL
```

### How to Add GitHub Secrets

```bash
# Using GitHub CLI
gh secret set CONVEX_URL --body "https://your-project.convex.cloud"
gh secret set APPLE_TEAM_ID --body "ABC123DEFG"

# Or via GitHub web UI:
# Settings > Secrets and variables > Actions > New repository secret
```

### Environment Variables (.env)

```bash
# Copy template
cp configs/.env.example .env

# Edit with your values
VITE_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=your-key
APPLE_TEAM_ID=ABC123
# ... etc
```

---

## Troubleshooting

### CI/CD Failures

#### iOS Build Fails with "Certificate not found"
```
Solution:
1. Verify CERTIFICATE_BASE64 secret is set correctly
2. Regenerate certificate:
   - Apple Developer Account > Certificates, Identifiers & Profiles
   - Download new .p12 file
   - base64 encode: base64 -i cert.p12 | pbcopy
   - Update GitHub secret
3. Re-run workflow
```

#### Web Deployment Fails with "Vercel token invalid"
```
Solution:
1. Verify VERCEL_TOKEN is current (not expired)
2. Generate new token:
   - Vercel dashboard > Settings > Tokens
   - Copy new token
   - Update GitHub secret VERCEL_TOKEN
3. Re-run deployment
```

#### EAS Build Fails with "Expo login required"
```
Solution:
1. Verify EXPO_TOKEN secret is set
2. Generate token from Expo:
   - npm login (local)
   - Run: eas token create --name github-actions
   - Copy token to GitHub secret
3. Re-run build
```

### Local Development Issues

#### Port 3000 Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

#### Node modules corrupted
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Capacitor sync fails
```bash
# Reinstall Capacitor
npm uninstall @capacitor/core @capacitor/ios
npm install @capacitor/core @capacitor/ios
npx cap sync ios
```

### Debugging CI/CD Logs

```bash
# View logs on GitHub Actions tab
# Settings > Actions > Workflow runs > [workflow name]

# Local testing (act tool)
# Install: brew install act
act -l                    # List available jobs
act push                  # Simulate push trigger
act -j ios_build          # Run specific job
```

---

## Useful Commands

### Build & Deploy
```bash
npm run build               # Build web app
npm run build:ios          # Build iOS archive
npm run deploy:app-store   # Deploy to App Store
npm run deploy:web         # Deploy web to Vercel
```

### Testing & Validation
```bash
npm test                    # Run tests
npm run lint               # Lint code
npm run type-check         # TypeScript validation
```

### Git Operations
```bash
git log --oneline          # View commit history
git diff main dev          # Compare branches
git cherry-pick [commit]   # Apply specific commit
```

### Scripts
```bash
./scripts/push-all-games.sh main           # Push all games to GitHub
./scripts/new-game-setup.sh tennis         # Scaffold new game
```

---

## Support & Contact

For DevOps issues:
- **Email:** alpit@exafabs.ai
- **GitHub:** @alpittare

For specific game deployments:
- Check GitHub Actions logs: `github.com/alpittare/[game]/actions`
- Check Vercel dashboard: `vercel.com/[team]/[project]`
- Check EAS dashboard: `expo.dev/accounts/[account]/projects`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-30 | Initial CI/CD setup for three games |

---

**Last Updated:** March 30, 2026
**Maintained By:** Alpit Tare (alpit@exafabs.ai)

#!/bin/bash

# ============================================================================
# Game Ecosystem - New Game Scaffold Script
# ============================================================================
# Sets up a new game from the ecosystem template
#
# Usage: ./new-game-setup.sh <game-name> [github-repo-url]
# Example: ./new-game-setup.sh tennis https://github.com/alpittare/tennis-ai-2026.git
# ============================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECOSYSTEM_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE_DIR="$ECOSYSTEM_ROOT/00_template_game"

# Game configuration from arguments
GAME_NAME="${1:-}"
GITHUB_REPO="${2:-}"

# Validate inputs
if [ -z "$GAME_NAME" ]; then
  echo -e "${RED}Error: Game name required${NC}"
  echo "Usage: $0 <game-name> [github-repo-url]"
  echo "Example: $0 tennis https://github.com/alpittare/tennis-ai-2026.git"
  exit 1
fi

# Normalize game name (lowercase, replace spaces with hyphens)
GAME_NAME_NORMALIZED=$(echo "$GAME_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
GAME_DIR="$ECOSYSTEM_ROOT/$GAME_NAME_NORMALIZED"

# ============================================================================
# Functions
# ============================================================================

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
}

# Verify template exists
verify_template() {
  if [ ! -d "$TEMPLATE_DIR" ]; then
    log_error "Template directory not found: $TEMPLATE_DIR"
    exit 1
  fi
  if [ ! -f "$TEMPLATE_DIR/package.json" ]; then
    log_error "Template package.json not found"
    exit 1
  fi
  log_info "Template verified at: $TEMPLATE_DIR"
}

# Check if game directory already exists
check_game_exists() {
  if [ -d "$GAME_DIR" ]; then
    log_error "Game directory already exists: $GAME_DIR"
    exit 1
  fi
  log_info "Game directory available: $GAME_DIR"
}

# Copy template files
copy_template() {
  log_step "Copying template files..."
  cp -r "$TEMPLATE_DIR" "$GAME_DIR"
  log_info "Template copied to: $GAME_DIR"
}

# Initialize git repository
init_git() {
  log_step "Initializing Git repository..."
  cd "$GAME_DIR"

  git init
  log_info "Git repository initialized"

  # Create initial commit
  git add .
  git commit -m "Initial commit: Game scaffolded from template" || true

  # Add GitHub remote if provided
  if [ -n "$GITHUB_REPO" ]; then
    log_info "Adding remote: $GITHUB_REPO"
    git remote add origin "$GITHUB_REPO"
  fi
}

# Setup npm dependencies
setup_npm() {
  log_step "Setting up npm dependencies..."
  cd "$GAME_DIR"

  # Check if Node.js is installed
  if ! command -v node &> /dev/null; then
    log_warn "Node.js not found. Skipping npm install."
    log_warn "Run 'npm install' manually in $GAME_DIR"
    return 1
  fi

  npm install
  log_info "Dependencies installed"
}

# Initialize Capacitor
init_capacitor() {
  log_step "Initializing Capacitor..."
  cd "$GAME_DIR"

  # Copy Capacitor config template
  if [ -f "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/configs/capacitor.config.template.json" ]; then
    cp "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/configs/capacitor.config.template.json" capacitor.config.json
    log_info "Capacitor config created"
  fi

  # Sync Capacitor (if npm was installed)
  if command -v npm &> /dev/null; then
    npx cap sync ios 2>/dev/null || log_warn "Capacitor sync skipped (may require iOS platform setup)"
  fi
}

# Setup Expo wrapper
setup_expo() {
  log_step "Setting up Expo configuration..."
  cd "$GAME_DIR"

  if [ -f "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/configs/eas.template.json" ]; then
    cp "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/configs/eas.template.json" eas.json
    log_info "EAS config created"
  fi

  if [ -f "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/configs/.env.example" ]; then
    cp "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/configs/.env.example" .env.example
    log_info "Environment template copied"
  fi
}

# Create GitHub repository (if GitHub CLI available)
create_github_repo() {
  if [ -z "$GITHUB_REPO" ]; then
    return 0
  fi

  log_step "Setting up GitHub repository..."

  if ! command -v gh &> /dev/null; then
    log_warn "GitHub CLI not found. Skipping automatic GitHub repo creation."
    log_warn "Create repository manually at: $GITHUB_REPO"
    return 1
  fi

  # Extract repo name from URL
  REPO_NAME=$(basename "$GITHUB_REPO" .git)

  log_info "GitHub repo configured: $REPO_NAME"
}

# Setup CI/CD pipelines
setup_cicd() {
  log_step "Setting up CI/CD pipelines..."
  cd "$GAME_DIR"

  mkdir -p .github/workflows

  # Copy workflow templates
  if [ -f "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/workflows/ios-build.yml" ]; then
    cp "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/workflows/ios-build.yml" .github/workflows/
    log_info "iOS build workflow added"
  fi

  if [ -f "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/workflows/web-deploy.yml" ]; then
    cp "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/workflows/web-deploy.yml" .github/workflows/
    log_info "Web deployment workflow added"
  fi

  if [ -f "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/workflows/eas-build.yml" ]; then
    cp "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/workflows/eas-build.yml" .github/workflows/
    log_info "EAS build workflow added"
  fi

  # Copy .gitignore
  if [ -f "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/configs/.gitignore" ]; then
    cp "$ECOSYSTEM_ROOT/08_DevOps_CI_CD/configs/.gitignore" .gitignore
    log_info ".gitignore configured"
  fi
}

# Create README
create_readme() {
  log_step "Creating README..."
  cd "$GAME_DIR"

  cat > README.md << 'EOF'
# $(GAME_NAME) AI 2026

Part of the Game Ecosystem by Alpit Tare

## Quick Start

### Development
```bash
npm install
npm run dev
```

### Build iOS
```bash
npm run build
npx cap sync ios
npm run build:ios
```

### Deploy to App Store
```bash
npm run deploy:app-store
```

## Folder Structure
- `/src` - Game source code
- `/public` - Static assets
- `/ios` - iOS native code (Capacitor)
- `/.github/workflows` - CI/CD pipelines

## Documentation
See `../../README.md` for full ecosystem documentation.
EOF

  # Replace placeholder
  sed -i.bak "s/\$(GAME_NAME)/$GAME_NAME/g" README.md
  rm -f README.md.bak

  log_info "README created"
}

# Print setup summary
print_summary() {
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Game Setup Complete!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "Game: $GAME_NAME"
  echo "Directory: $GAME_DIR"
  echo ""
  echo "Next steps:"
  echo "  1. cd $GAME_DIR"
  echo "  2. npm install (if not already done)"
  echo "  3. Update app.json with game-specific configuration"
  echo "  4. Customize game mechanics in /src"
  echo "  5. Configure GitHub secrets for CI/CD"
  echo ""
  if [ -n "$GITHUB_REPO" ]; then
    echo "GitHub: $GITHUB_REPO"
    echo "  1. Create the GitHub repository"
    echo "  2. Add GitHub secrets (see CI/CD docs)"
    echo "  3. Push: git push -u origin main"
  fi
  echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
  log_info "Starting new game setup: $GAME_NAME"
  echo ""

  verify_template
  check_game_exists
  copy_template
  init_git
  setup_npm
  init_capacitor
  setup_expo
  create_github_repo
  setup_cicd
  create_readme

  print_summary
}

# ============================================================================
# Error Handling
# ============================================================================

trap 'log_error "Setup interrupted"; exit 1' INT TERM

# ============================================================================
# Execute
# ============================================================================

main "$@"
exit 0

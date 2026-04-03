#!/bin/bash

# ============================================================================
# Multi-Repo Git Push Script
# ============================================================================
# Pushes all three game repositories to their respective GitHub remotes
# with separate origin URLs
#
# Usage: ./push-all-games.sh [branch]
# Example: ./push-all-games.sh main
# ============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Default branch
BRANCH="${1:-main}"

# Define game repositories with their GitHub URLs
declare -A GAMES=(
  ["cricket"]="git@github.com:alpittare/cricket-ai-2026.git"
  ["football"]="git@github.com:alpittare/football-ai-2026.git"
  ["baseball"]="git@github.com:alpittare/baseball-ai-2026.git"
)

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

check_git_installed() {
  if ! command -v git &> /dev/null; then
    log_error "Git is not installed"
    exit 1
  fi
  log_info "Git version: $(git --version)"
}

check_branch_exists() {
  local branch=$1
  if ! git show-ref --verify --quiet refs/heads/"$branch"; then
    log_error "Branch '$branch' does not exist"
    return 1
  fi
  return 0
}

push_game_repo() {
  local game=$1
  local repo_url=$2
  local game_dir="$PROJECT_ROOT/$game"

  log_info "Processing: $game"

  # Verify game directory exists
  if [ ! -d "$game_dir" ]; then
    log_warn "Game directory not found: $game_dir"
    return 1
  fi

  # Navigate to game directory
  cd "$game_dir"

  # Verify it's a git repository
  if [ ! -d ".git" ]; then
    log_error "$game is not a git repository"
    return 1
  fi

  # Check current branch
  local current_branch=$(git rev-parse --abbrev-ref HEAD)
  log_info "  Current branch: $current_branch"

  # Verify branch exists
  if ! check_branch_exists "$BRANCH"; then
    return 1
  fi

  # Check if remote exists
  if git remote | grep -q "origin"; then
    # Update existing origin
    log_info "  Updating remote origin to: $repo_url"
    git remote set-url origin "$repo_url"
  else
    # Add new origin
    log_info "  Adding remote origin: $repo_url"
    git remote add origin "$repo_url"
  fi

  # Verify remote is reachable
  log_info "  Verifying remote accessibility..."
  if ! git ls-remote --heads "$repo_url" > /dev/null 2>&1; then
    log_warn "  Could not verify remote. Continuing anyway..."
  fi

  # Push to remote
  log_info "  Pushing branch '$BRANCH' to origin..."
  if git push -u origin "$BRANCH" --no-verify; then
    log_info "  ✓ Successfully pushed $game"
    return 0
  else
    log_error "  Failed to push $game"
    return 1
  fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
  log_info "Starting multi-repo push script"
  log_info "Target branch: $BRANCH"
  echo ""

  check_git_installed

  # Verify script is not being run from individual game directories
  if [ -f "package.json" ] && [ -d ".git" ]; then
    log_warn "Running from a game directory. This script should run from ecosystem root."
  fi

  local success_count=0
  local fail_count=0

  # Push each game repository
  for game in "${!GAMES[@]}"; do
    if push_game_repo "$game" "${GAMES[$game]}"; then
      ((success_count++))
    else
      ((fail_count++))
    fi
    echo ""
  done

  # Summary
  log_info "Push Summary:"
  log_info "  Successful: $success_count/${#GAMES[@]}"
  log_info "  Failed: $fail_count/${#GAMES[@]}"

  if [ $fail_count -eq 0 ]; then
    log_info "All repositories pushed successfully!"
    return 0
  else
    log_error "$fail_count repository/repositories failed to push"
    return 1
  fi
}

# ============================================================================
# Error Handling
# ============================================================================

trap 'log_error "Script interrupted"; exit 1' INT TERM

# ============================================================================
# Execute
# ============================================================================

main "$@"
exit $?

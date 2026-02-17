#!/bin/bash

#############################################
# Email Loop Agent - Auto Update Script
#############################################
# This script checks for updates from GitHub
# and automatically pulls and restarts the service
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_URL="https://github.com/dongchenxie/agent.git"
SERVICE_NAME="email-loop-agent"
LOG_FILE="$SCRIPT_DIR/auto-update.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗ $1${NC}" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] → $1${NC}" | tee -a "$LOG_FILE"
}

# Change to script directory
cd "$SCRIPT_DIR"

log_info "Checking for updates..."

# Fetch latest changes from remote
git fetch origin master 2>&1 | tee -a "$LOG_FILE"

# Get current and remote commit hashes
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/master)

log_info "Local commit: $LOCAL_COMMIT"
log_info "Remote commit: $REMOTE_COMMIT"

# Check if update is needed
if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    log_success "Already up to date"
    exit 0
fi

log_info "New version available, updating..."

# Backup current .env file
if [ -f .env ]; then
    cp .env .env.backup
    log_success "Backed up .env file"
fi

# Pull latest changes
log_info "Pulling latest changes..."
git pull origin master 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    log_error "Failed to pull updates"
    # Restore .env if backup exists
    if [ -f .env.backup ]; then
        mv .env.backup .env
        log_info "Restored .env from backup"
    fi
    exit 1
fi

# Restore .env file (in case it was overwritten)
if [ -f .env.backup ]; then
    mv .env.backup .env
    log_success "Restored .env file"
fi

# Install/update dependencies
log_info "Installing dependencies..."
bun install 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    log_error "Failed to install dependencies"
    exit 1
fi

log_success "Dependencies installed"

# Update completed - the agent process will exit and systemd will restart it automatically
log_success "Update completed! New version: $REMOTE_COMMIT"
log_info "Agent will exit and systemd will restart automatically"

# Clean up old logs (keep last 100 lines)
if [ -f "$LOG_FILE" ]; then
    tail -n 100 "$LOG_FILE" > "$LOG_FILE.tmp"
    mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

exit 0

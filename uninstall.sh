#!/bin/bash

#############################################
# Email Loop Agent - Uninstaller
#############################################
# Usage: curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/master/uninstall.sh | bash
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_header "Email Loop Agent Uninstaller"

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    print_error "Unsupported OS: $OSTYPE"
    exit 1
fi

print_info "Detected OS: $OS"

# Confirm uninstallation
echo ""
print_info "This will remove Email Loop Agent from your system."
read -p "Are you sure you want to continue? (y/N): " -n 1 -r < /dev/tty
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Uninstallation cancelled"
    exit 0
fi

INSTALL_DIR="$HOME/email-loop-agent"

# Stop and remove service
if [ "$OS" == "linux" ]; then
    print_header "Step 1: Removing systemd service"

    SERVICE_NAME="email-loop-agent"
    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

    if [ -f "$SERVICE_FILE" ]; then
        print_info "Stopping service..."
        sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

        print_info "Disabling service..."
        sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true

        print_info "Removing service file..."
        sudo rm -f "$SERVICE_FILE"

        sudo systemctl daemon-reload

        print_success "Systemd service removed"
    else
        print_info "No systemd service found, skipping"
    fi
else
    print_header "Step 1: Removing launchd service"

    PLIST_NAME="com.emailloop.agent"
    PLIST_FILE="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

    if [ -f "$PLIST_FILE" ]; then
        print_info "Stopping service..."
        launchctl unload "$PLIST_FILE" 2>/dev/null || true

        print_info "Removing service file..."
        rm -f "$PLIST_FILE"

        print_success "Launchd service removed"
    else
        print_info "No launchd service found, skipping"
    fi
fi

# Remove installation directory
print_header "Step 2: Removing installation directory"

if [ -d "$INSTALL_DIR" ]; then
    print_info "Removing $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    print_success "Installation directory removed"
else
    print_info "Installation directory not found, skipping"
fi

# Optional: Remove Bun
print_header "Step 3: Bun.js (optional)"

echo ""
read -p "Do you want to remove Bun.js as well? (y/N): " -n 1 -r < /dev/tty
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v bun &> /dev/null; then
        print_info "Removing Bun.js..."
        rm -rf "$HOME/.bun"

        # Remove from shell profiles
        if [ -f "$HOME/.bashrc" ]; then
            sed -i '/BUN_INSTALL/d' "$HOME/.bashrc" 2>/dev/null || true
        fi

        if [ -f "$HOME/.zshrc" ]; then
            sed -i '/BUN_INSTALL/d' "$HOME/.zshrc" 2>/dev/null || true
        fi

        print_success "Bun.js removed"
        print_info "Please restart your shell or run: source ~/.bashrc (or ~/.zshrc)"
    else
        print_info "Bun.js not found, skipping"
    fi
else
    print_info "Keeping Bun.js installed"
fi

# Final summary
print_header "Uninstallation Complete!"

echo ""
print_success "Email Loop Agent has been removed from your system."
echo ""
print_info "Thank you for using Email Loop Agent!"
echo ""

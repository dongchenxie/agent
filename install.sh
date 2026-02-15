#!/bin/bash

#############################################
# Email Loop Agent - One-Click Installer
#############################################
# Usage: curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/refs/heads/master/install.sh | bash
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

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
fi

print_header "Email Loop Agent Installer"

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

# Install Git if not present
print_header "Step 0: Checking Git installation"

if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    print_success "Git is already installed ($GIT_VERSION)"
else
    print_info "Git not found, installing..."

    if [ "$OS" == "linux" ]; then
        # Detect Linux distribution
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            DISTRO=$ID
        else
            print_error "Cannot detect Linux distribution"
            exit 1
        fi

        case $DISTRO in
            ubuntu|debian)
                print_info "Installing Git on Ubuntu/Debian..."
                sudo apt-get update
                sudo apt-get install -y git
                ;;
            centos|rhel|fedora)
                print_info "Installing Git on CentOS/RHEL/Fedora..."
                sudo yum install -y git
                ;;
            arch)
                print_info "Installing Git on Arch Linux..."
                sudo pacman -S --noconfirm git
                ;;
            *)
                print_error "Unsupported Linux distribution: $DISTRO"
                print_info "Please install Git manually: sudo apt-get install git (or equivalent)"
                exit 1
                ;;
        esac
    else
        # macOS
        print_info "Installing Git on macOS..."
        if command -v brew &> /dev/null; then
            brew install git
        else
            print_error "Homebrew not found. Please install Git manually:"
            print_info "  1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            print_info "  2. Install Git: brew install git"
            exit 1
        fi
    fi

    print_success "Git installed successfully"
fi

# Install Bun if not already installed
print_header "Step 1: Installing Bun.js"

if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    print_success "Bun is already installed (version $BUN_VERSION)"
else
    print_info "Installing Bun.js..."
    curl -fsSL https://bun.sh/install | bash

    # Add Bun to PATH for current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    # Add to shell profile
    if [ -f "$HOME/.bashrc" ]; then
        echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.bashrc"
        echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.bashrc"
    fi

    if [ -f "$HOME/.zshrc" ]; then
        echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.zshrc"
        echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.zshrc"
    fi

    print_success "Bun installed successfully"
fi

# Clone repository
print_header "Step 2: Cloning repository"

INSTALL_DIR="$HOME/email-loop-agent"
REPO_URL="https://github.com/dongchenxie/agent.git"

if [ -d "$INSTALL_DIR" ]; then
    print_info "Directory $INSTALL_DIR already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r < /dev/tty
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
        print_success "Removed existing directory"
    else
        print_error "Installation cancelled"
        exit 1
    fi
fi

print_info "Cloning from $REPO_URL..."
git clone "$REPO_URL" "$INSTALL_DIR"

if [ $? -ne 0 ]; then
    print_error "Failed to clone repository"
    exit 1
fi

cd "$INSTALL_DIR"
print_success "Repository cloned successfully"

# Install dependencies
print_header "Step 3: Installing dependencies"

bun install
print_success "Dependencies installed"

# Interactive configuration
print_header "Step 4: Configuration"

echo ""
print_info "Please provide the following configuration:"
echo ""

# Master URL
read -p "Master Server URL (e.g., https://your-server.com:9988): " MASTER_URL < /dev/tty
while [ -z "$MASTER_URL" ]; do
    print_error "Master URL cannot be empty"
    read -p "Master Server URL: " MASTER_URL < /dev/tty
done

# Agent Secret
read -p "Agent Secret (from server .env): " AGENT_SECRET < /dev/tty
while [ -z "$AGENT_SECRET" ]; do
    print_error "Agent Secret cannot be empty"
    read -p "Agent Secret: " AGENT_SECRET < /dev/tty
done

# Agent Nickname
DEFAULT_NICKNAME="agent-$(hostname)-$(date +%s)"
read -p "Agent Nickname (default: $DEFAULT_NICKNAME): " AGENT_NICKNAME < /dev/tty
AGENT_NICKNAME=${AGENT_NICKNAME:-$DEFAULT_NICKNAME}

# Create .env file
cat > .env << EOF
# Email Loop Agent Configuration
MASTER_URL=$MASTER_URL
AGENT_SECRET=$AGENT_SECRET
AGENT_NICKNAME=$AGENT_NICKNAME
EOF

print_success "Configuration saved to .env"

# Setup systemd service (Linux only)
if [ "$OS" == "linux" ]; then
    print_header "Step 5: Setting up systemd service"

    read -p "Do you want to set up auto-restart with systemd? (Y/n): " -n 1 -r < /dev/tty
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        SERVICE_NAME="email-loop-agent"
        SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

        print_info "Creating systemd service..."

        sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Email Loop Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$HOME/.bun/bin/bun run index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=email-loop-agent

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable "$SERVICE_NAME"

        print_success "Systemd service created: $SERVICE_NAME"
        print_info "Service will auto-restart on failure"

        read -p "Do you want to start the service now? (Y/n): " -n 1 -r < /dev/tty
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            sudo systemctl start "$SERVICE_NAME"
            print_success "Service started"

            echo ""
            print_info "Useful commands:"
            echo "  - Check status: sudo systemctl status $SERVICE_NAME"
            echo "  - View logs: sudo journalctl -u $SERVICE_NAME -f"
            echo "  - Stop service: sudo systemctl stop $SERVICE_NAME"
            echo "  - Restart service: sudo systemctl restart $SERVICE_NAME"
        fi
    else
        print_info "Skipping systemd setup"
        print_info "You can start the agent manually with: cd $INSTALL_DIR && bun run index.ts"
    fi
else
    # macOS - use launchd
    print_header "Step 5: Setting up launchd service"

    read -p "Do you want to set up auto-restart with launchd? (Y/n): " -n 1 -r < /dev/tty
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        PLIST_NAME="com.emailloop.agent"
        PLIST_FILE="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

        mkdir -p "$HOME/Library/LaunchAgents"

        print_info "Creating launchd service..."

        cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HOME/.bun/bin/bun</string>
        <string>run</string>
        <string>index.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/agent.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/agent.error.log</string>
</dict>
</plist>
EOF

        launchctl load "$PLIST_FILE"

        print_success "Launchd service created: $PLIST_NAME"
        print_info "Service will auto-restart on failure"

        echo ""
        print_info "Useful commands:"
        echo "  - Check status: launchctl list | grep emailloop"
        echo "  - View logs: tail -f $INSTALL_DIR/agent.log"
        echo "  - Stop service: launchctl unload $PLIST_FILE"
        echo "  - Restart service: launchctl unload $PLIST_FILE && launchctl load $PLIST_FILE"
    else
        print_info "Skipping launchd setup"
        print_info "You can start the agent manually with: cd $INSTALL_DIR && bun run index.ts"
    fi
fi

# Final summary
print_header "Installation Complete!"

echo ""
print_success "Email Loop Agent has been installed successfully!"
echo ""
print_info "Installation directory: $INSTALL_DIR"
print_info "Configuration file: $INSTALL_DIR/.env"
echo ""
print_info "Agent Details:"
echo "  - Master URL: $MASTER_URL"
echo "  - Nickname: $AGENT_NICKNAME"
echo ""

if [ "$OS" == "linux" ]; then
    print_info "To check agent status: sudo systemctl status email-loop-agent"
    print_info "To view logs: sudo journalctl -u email-loop-agent -f"
else
    print_info "To check agent status: launchctl list | grep emailloop"
    print_info "To view logs: tail -f $INSTALL_DIR/agent.log"
fi

echo ""
print_success "Happy emailing! 🚀"

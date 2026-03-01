#!/bin/bash

#############################################
# Email Loop Agent - User Setup Script
#############################################
# This script creates a new sudo user and sets up the agent
# Usage: curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/refs/heads/master/setup-user.sh | sudo bash
# Or: sudo bash setup-user.sh
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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if stdin is a terminal (interactive mode)
if [ -t 0 ]; then
    INTERACTIVE=true
else
    INTERACTIVE=false
fi

# If running through pipe (curl | bash), download and re-execute with proper stdin
if [ "$INTERACTIVE" = false ] && [ -z "$REEXECUTED" ]; then
    print_info "Detected pipe mode, downloading script for interactive execution..."

    TEMP_SCRIPT=$(mktemp /tmp/setup-user-XXXXXX.sh)

    # Download the script
    if command -v curl &> /dev/null; then
        curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/refs/heads/master/setup-user.sh -o "$TEMP_SCRIPT"
    elif command -v wget &> /dev/null; then
        wget -qO "$TEMP_SCRIPT" https://raw.githubusercontent.com/dongchenxie/agent/refs/heads/master/setup-user.sh
    else
        # If we can't download, try to use the current script
        cat > "$TEMP_SCRIPT" << 'SCRIPTEOF'
#!/bin/bash
# Script content will be here
SCRIPTEOF
    fi

    chmod +x "$TEMP_SCRIPT"

    # Re-execute with proper stdin
    export REEXECUTED=1
    exec bash "$TEMP_SCRIPT" < /dev/tty

    # Cleanup (won't reach here due to exec)
    rm -f "$TEMP_SCRIPT"
    exit 0
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root"
    echo "Please run: sudo bash setup-user.sh"
    exit 1
fi

print_header "Email Loop Agent - User Setup"

# Get username from environment variable or prompt
if [ -n "$AGENT_USERNAME" ]; then
    USERNAME="$AGENT_USERNAME"
    print_info "Using username from environment: $USERNAME"
else
    echo ""
    read -p "Enter username to create (default: agent): " USERNAME < /dev/tty
    USERNAME=${USERNAME:-agent}
fi

# Check if user already exists
if id "$USERNAME" &>/dev/null; then
    print_warning "User '$USERNAME' already exists"

    if [ -n "$AGENT_SKIP_EXISTING" ]; then
        print_info "Skipping user creation (AGENT_SKIP_EXISTING is set)"
    else
        read -p "Do you want to continue and switch to this user? (y/n): " CONTINUE < /dev/tty
        if [ "$CONTINUE" != "y" ]; then
            print_info "Exiting..."
            exit 0
        fi
    fi
else
    # Get password
    echo ""
    print_info "Creating user '$USERNAME'..."

    # Create user with home directory
    useradd -m -s /bin/bash "$USERNAME"

    # Set password
    if [ -n "$AGENT_PASSWORD" ]; then
        echo "$USERNAME:$AGENT_PASSWORD" | chpasswd
        print_success "Password set from environment variable"
    else
        echo ""
        print_info "Please set a password for user '$USERNAME':"
        passwd "$USERNAME" < /dev/tty
    fi

    # Add user to sudo group
    usermod -aG sudo "$USERNAME"

    print_success "User '$USERNAME' created successfully"
    print_success "User added to sudo group"
fi

# Create agent directory in user's home
USER_HOME="/home/$USERNAME"
AGENT_DIR="$USER_HOME/agent"

print_info "Setting up agent directory at $AGENT_DIR..."

# Create agent directory if it doesn't exist
if [ ! -d "$AGENT_DIR" ]; then
    mkdir -p "$AGENT_DIR"
    print_success "Created agent directory"
fi

# Copy current directory contents to user's agent directory (if running from agent folder)
CURRENT_DIR=$(pwd)
if [ -f "$CURRENT_DIR/install.sh" ]; then
    print_info "Copying agent files to $AGENT_DIR..."
    cp -r "$CURRENT_DIR"/* "$AGENT_DIR/" 2>/dev/null || true
    print_success "Agent files copied"
fi

# Set ownership
chown -R "$USERNAME:$USERNAME" "$AGENT_DIR"
print_success "Set ownership to $USERNAME"

# Create a helper script to switch to the user
SWITCH_SCRIPT="/usr/local/bin/switch-to-$USERNAME"
cat > "$SWITCH_SCRIPT" << SWITCHEOF
#!/bin/bash
USERNAME="$USERNAME"
echo "Switching to user '\$USERNAME'..."
echo "Agent directory: /home/\$USERNAME/agent"
echo ""
exec su - "\$USERNAME"
SWITCHEOF

chmod +x "$SWITCH_SCRIPT"

print_success "Created switch script at $SWITCH_SCRIPT"

# Print summary
echo ""
print_header "Setup Complete!"
echo ""
print_success "User '$USERNAME' is ready"
print_info "Agent directory: $AGENT_DIR"
echo ""
print_info "To switch to this user, run:"
echo -e "  ${GREEN}su - $USERNAME${NC}"
echo ""
print_info "Or use the helper command:"
echo -e "  ${GREEN}switch-to-$USERNAME${NC}"
echo ""
print_info "After switching, go to agent directory:"
echo -e "  ${GREEN}cd ~/agent${NC}"
echo ""
print_info "Then run the agent installer:"
echo -e "  ${GREEN}bash install.sh${NC}"
echo ""

# Ask if user wants to switch now (only in interactive mode)
if [ "$INTERACTIVE" = true ] || [ -t 0 ]; then
    read -p "Do you want to switch to user '$USERNAME' now? (y/n): " SWITCH_NOW < /dev/tty
    if [ "$SWITCH_NOW" = "y" ]; then
        echo ""
        print_info "Switching to user '$USERNAME'..."
        echo ""
        exec su - "$USERNAME"
    fi
fi

print_success "Done!"

# Cleanup temp script if it exists
if [ -n "$REEXECUTED" ] && [ -f "$TEMP_SCRIPT" ]; then
    rm -f "$TEMP_SCRIPT"
fi

# Email Loop Agent - Installation Guide

## One-Line Installation

On a fresh server, run:

```bash
curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/main/install.sh | bash
```

## What the Installer Does

1. **Checks and Installs Git** (if not present)
   - Ubuntu/Debian: `apt-get install git`
   - CentOS/RHEL/Fedora: `yum install git`
   - Arch Linux: `pacman -S git`
   - macOS: `brew install git`

2. **Installs Bun.js** (if not already installed)
   - Latest version from https://bun.sh
   - Adds to PATH automatically

3. **Clones Repository**
   - Clones from https://github.com/dongchenxie/agent
   - Installation directory: `~/email-loop-agent`

4. **Interactive Configuration**
   - Master Server URL (e.g., `https://your-server.com:9988`)
   - Agent Secret (from server's `.env` file)
   - Agent Nickname (auto-generated or custom)

5. **Installs Dependencies**
   - `nodemailer` for email sending
   - Type definitions

6. **Sets Up Auto-Restart Service**
   - **Linux**: systemd service
   - **macOS**: launchd service
   - Auto-restart on failure
   - Starts on boot

## Installation Directory

Default: `~/email-loop-agent`

## Service Management

### Linux (systemd)

```bash
# Check status
sudo systemctl status email-loop-agent

# View logs (real-time)
sudo journalctl -u email-loop-agent -f

# Restart
sudo systemctl restart email-loop-agent

# Stop
sudo systemctl stop email-loop-agent

# Disable auto-start
sudo systemctl disable email-loop-agent
```

### macOS (launchd)

```bash
# Check status
launchctl list | grep emailloop

# View logs (real-time)
tail -f ~/email-loop-agent/agent.log

# Restart
launchctl unload ~/Library/LaunchAgents/com.emailloop.agent.plist
launchctl load ~/Library/LaunchAgents/com.emailloop.agent.plist

# Stop
launchctl unload ~/Library/LaunchAgents/com.emailloop.agent.plist
```

## Updating the Agent

```bash
cd ~/email-loop-agent

# Download latest version
curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/main/index.ts -o index.ts
curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/main/package.json -o package.json

# Update dependencies
bun install

# Restart service
# Linux:
sudo systemctl restart email-loop-agent

# macOS:
launchctl unload ~/Library/LaunchAgents/com.emailloop.agent.plist
launchctl load ~/Library/LaunchAgents/com.emailloop.agent.plist
```

## Troubleshooting

### Agent not connecting to master

1. Check if agent is running
2. Check logs for errors
3. Verify configuration in `~/email-loop-agent/.env`
4. Test master server connectivity

### Uninstalling

```bash
# Stop and disable service
# Linux:
sudo systemctl stop email-loop-agent
sudo systemctl disable email-loop-agent
sudo rm /etc/systemd/system/email-loop-agent.service
sudo systemctl daemon-reload

# macOS:
launchctl unload ~/Library/LaunchAgents/com.emailloop.agent.plist
rm ~/Library/LaunchAgents/com.emailloop.agent.plist

# Remove installation directory
rm -rf ~/email-loop-agent
```

# Email Loop Agent

A lightweight distributed email sending agent for Email Loop.

## Quick Start (One-Line Install)

```bash
curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/main/install.sh | bash
```

This will:
- ✓ Install Bun.js (if not already installed)
- ✓ Download the agent
- ✓ Interactive configuration setup
- ✓ Install dependencies
- ✓ Set up auto-restart service (systemd/launchd)

## Manual Installation

```bash
# Clone the repository
git clone https://github.com/dongchenxie/agent.git
cd agent

# Install dependencies
bun install

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MASTER_URL` | URL of the Email Loop master server | `http://localhost:3000` |
| `AGENT_SECRET` | Shared secret for registration | Required |
| `AGENT_NICKNAME` | Unique name for this agent | `agent-{timestamp}` |

## Usage

```bash
# Start the agent
bun start

# Development mode (auto-reload)
bun dev
```

## How It Works

1. Agent registers with the master server using the shared secret
2. Polls the master server periodically for email tasks
3. Sends emails via SMTP credentials provided by master
4. Reports results back to master

## Auto-Restart Service

The installer sets up automatic restart on failure:

### Linux (systemd)
```bash
# Check status
sudo systemctl status email-loop-agent

# View logs
sudo journalctl -u email-loop-agent -f

# Restart
sudo systemctl restart email-loop-agent

# Stop
sudo systemctl stop email-loop-agent
```

### macOS (launchd)
```bash
# Check status
launchctl list | grep emailloop

# View logs
tail -f ~/email-loop-agent/agent.log

# Restart
launchctl unload ~/Library/LaunchAgents/com.emailloop.agent.plist
launchctl load ~/Library/LaunchAgents/com.emailloop.agent.plist

# Stop
launchctl unload ~/Library/LaunchAgents/com.emailloop.agent.plist
```

## Updating

```bash
cd ~/email-loop-agent
curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/main/index.ts -o index.ts
curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/main/package.json -o package.json
bun install

# Restart the service
# Linux: sudo systemctl restart email-loop-agent
# macOS: launchctl unload ~/Library/LaunchAgents/com.emailloop.agent.plist && launchctl load ~/Library/LaunchAgents/com.emailloop.agent.plist
```

## License

MIT

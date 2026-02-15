# Email Loop Agent

A lightweight distributed email sending agent for Email Loop.

## Requirements

- [Bun](https://bun.sh/) runtime

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/email-loop-agent.git
cd email-loop-agent

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
| `WEBHOOK_DOMAIN` | Domain for email tracking | `http://localhost:3001` |

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

## Updating

```bash
git pull
bun install
# Restart the agent
```

## License

MIT

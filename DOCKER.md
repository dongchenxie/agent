# Docker Deployment Guide

This guide explains how to run the Email Loop Agent using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- A configured `.env` file with your agent credentials

## Quick Start

### 1. Configure Environment Variables

Make sure your `.env` file is properly configured:

```bash
# Copy example if you don't have .env yet
cp .env.example .env

# Edit with your credentials
nano .env
```

Required variables:
```env
MASTER_URL=https://email-admin.rankscaleai.com/
AGENT_SECRET=your-secret-here
AGENT_NICKNAME=agent-name
```

### 2. Build and Start the Agent

```bash
# Build and start in detached mode
docker-compose up -d

# Or build first, then start
docker-compose build
docker-compose up -d
```

### 3. Check Status

```bash
# View logs
docker-compose logs -f

# Check container status
docker-compose ps

# Check health
docker-compose exec email-agent bun run -e "console.log('Agent is running')"
```

## Docker Commands

### Basic Operations

```bash
# Start the agent
docker-compose up -d

# Stop the agent
docker-compose down

# Restart the agent
docker-compose restart

# View logs (follow mode)
docker-compose logs -f

# View last 100 lines of logs
docker-compose logs --tail=100

# Stop and remove everything (including volumes)
docker-compose down -v
```

### Building

```bash
# Build the image
docker-compose build

# Build without cache (force rebuild)
docker-compose build --no-cache

# Pull latest base image and rebuild
docker-compose build --pull
```

### Debugging

```bash
# Execute commands inside the container
docker-compose exec email-agent sh

# Check environment variables
docker-compose exec email-agent env

# View container resource usage
docker stats email-loop-agent

# Inspect container
docker inspect email-loop-agent
```

## Configuration

### Environment Variables

All environment variables are loaded from `.env` file:

- `MASTER_URL` - Master server URL
- `AGENT_SECRET` - Shared secret for authentication
- `AGENT_NICKNAME` - Unique agent identifier
- `UPDATE_CHECK_INTERVAL` - Auto-update check interval (optional)
- `AUTO_UPDATE` - Enable/disable auto-updates (optional)
- `POLL_INTERVAL` - Task polling interval (optional)
- `SEND_INTERVAL` - Email sending interval (optional)
- `BATCH_SIZE` - Emails per batch (optional)

### Volume Mounts

The following directories are mounted for persistence:

- `./logs:/app/logs` - Agent logs
- `./auto-update.log:/app/auto-update.log` - Auto-update logs

### Resource Limits

Default resource limits (can be adjusted in `docker-compose.yml`):

- CPU: 1.0 core (limit), 0.5 core (reservation)
- Memory: 512MB (limit), 256MB (reservation)

To adjust:
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
```

### Network Mode

The agent uses `host` network mode for better connectivity. This means:
- Container shares the host's network stack
- No port mapping needed
- Better performance for network-intensive operations

To use bridge mode instead:
```yaml
# Remove network_mode: host
# Add port mapping if needed
ports:
  - "3000:3000"
```

## Updating the Agent

### Manual Update

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Auto-Update

The agent supports auto-updates when running in Docker:

1. Set `AUTO_UPDATE=true` in `.env`
2. The agent will check for updates periodically
3. When an update is available, it will:
   - Download the new version
   - Restart the container automatically

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker-compose logs

# Check if port is already in use
netstat -tulpn | grep :3000

# Verify .env file exists and is readable
ls -la .env
cat .env
```

### Agent Not Connecting to Master

```bash
# Check network connectivity
docker-compose exec email-agent ping -c 3 email-admin.rankscaleai.com

# Verify environment variables
docker-compose exec email-agent env | grep MASTER

# Check DNS resolution
docker-compose exec email-agent nslookup email-admin.rankscaleai.com
```

### High Memory Usage

```bash
# Check current usage
docker stats email-loop-agent

# Adjust memory limits in docker-compose.yml
# Then restart
docker-compose down
docker-compose up -d
```

### Logs Not Persisting

```bash
# Check volume mounts
docker inspect email-loop-agent | grep -A 10 Mounts

# Verify logs directory permissions
ls -la logs/

# Fix permissions if needed
sudo chown -R $(id -u):$(id -g) logs/
```

## Production Deployment

### Using Docker Swarm

```bash
# Initialize swarm (if not already)
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml email-agent

# Check services
docker stack services email-agent

# View logs
docker service logs -f email-agent_email-agent
```

### Using Kubernetes

Convert docker-compose.yml to Kubernetes manifests:

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.31.2/kompose-linux-amd64 -o kompose
chmod +x kompose
sudo mv kompose /usr/local/bin/

# Convert
kompose convert

# Deploy
kubectl apply -f .
```

### Security Best Practices

1. **Don't commit .env file**
   ```bash
   # Add to .gitignore
   echo ".env" >> .gitignore
   ```

2. **Use Docker secrets** (for Swarm/Kubernetes)
   ```bash
   # Create secret
   echo "your-secret" | docker secret create agent_secret -

   # Reference in docker-compose.yml
   secrets:
     - agent_secret
   ```

3. **Run as non-root user**
   ```dockerfile
   # Add to Dockerfile
   USER bun
   ```

4. **Scan for vulnerabilities**
   ```bash
   docker scan email-loop-agent
   ```

## Monitoring

### Health Checks

The container includes a health check that runs every 30 seconds:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' email-loop-agent

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' email-loop-agent
```

### Prometheus Metrics (Optional)

To expose metrics for Prometheus:

1. Add metrics endpoint to agent code
2. Expose port in docker-compose.yml:
   ```yaml
   ports:
     - "9090:9090"
   ```

## Backup and Recovery

### Backup

```bash
# Backup logs
tar -czf agent-logs-$(date +%Y%m%d).tar.gz logs/

# Backup configuration
cp .env .env.backup
```

### Recovery

```bash
# Restore logs
tar -xzf agent-logs-20260301.tar.gz

# Restore configuration
cp .env.backup .env

# Restart agent
docker-compose restart
```

## Multi-Agent Deployment

To run multiple agents on the same host:

```bash
# Create separate directories
mkdir -p agent1 agent2 agent3

# Copy files to each directory
for i in 1 2 3; do
  cp -r agent/* agent$i/
  cd agent$i
  # Edit .env with unique AGENT_NICKNAME
  sed -i "s/AGENT_NICKNAME=.*/AGENT_NICKNAME=agent-$i/" .env
  # Edit docker-compose.yml with unique container name
  sed -i "s/container_name: .*/container_name: email-loop-agent-$i/" docker-compose.yml
  cd ..
done

# Start all agents
for i in 1 2 3; do
  cd agent$i && docker-compose up -d && cd ..
done
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review this guide
- Check main README.md
- Contact support

## Example: Complete Setup

```bash
# 1. Clone repository
git clone https://github.com/dongchenxie/agent.git
cd agent

# 2. Configure environment
cp .env.example .env
nano .env  # Edit with your credentials

# 3. Build and start
docker-compose up -d

# 4. Check status
docker-compose ps
docker-compose logs -f

# 5. Verify agent is running
curl http://localhost:3000/health

# Done! Agent is now running in Docker
```

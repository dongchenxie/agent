# Use official Bun image
FROM oven/bun:1.1.38-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application files
COPY . .

# Create logs directory
RUN mkdir -p logs

# Set environment variables (will be overridden by docker-compose)
ENV NODE_ENV=production

# Health check - verify the process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep -f "bun.*index.ts" > /dev/null || exit 1

# Run the agent
CMD ["bun", "run", "index.ts"]

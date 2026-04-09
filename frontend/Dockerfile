# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies
RUN npm install 

# Copy source code
COPY . .

# Build for production
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/.output ./.output

USER nodejs

# Expose port
EXPOSE 3000

# Environment variable for config (can be overridden at runtime)
ENV BUNKER_CONFIG=/app/config.toml

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", ".output/server/index.mjs"]

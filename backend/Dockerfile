# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Copy game data files (JSON files are not copied by tsc)
RUN cp -r src/game/data dist/game/data

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files with ownership
COPY --chown=nodejs:nodejs package*.json ./

# Install production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy built application from builder stage with ownership
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy Prisma files for migrations
COPY --chown=nodejs:nodejs prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nodejs

# Expose port
EXPOSE 3001

# Environment variable for config (can be overridden at runtime)
ENV BUNKER_CONFIG=/app/config.toml

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Run migrations and start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

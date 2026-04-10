import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { SocketHandlers } from './socket/handlers';
import { GameLogic } from './game/gameLogic';
import { authenticateSocketWithFallback } from './auth/middleware';
import { logger } from './utils/logger';
import { getConfig } from './config';

const app = express();
app.set('trust proxy', true);
const server = createServer(app);
const config = getConfig();
const io = new Server(server, {
  path: process.env.WS_PATH,
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  perMessageDeflate: {
    threshold: config.server.compression_threshold,
    zlibDeflateOptions: {
      level: config.server.compression_level,
      memLevel: config.server.compression_mem_level
    },
    zlibInflateOptions: {
      level: config.server.compression_level,
      memLevel: config.server.compression_mem_level
    }
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: config.server.rate_limit_window_ms,
  max: config.server.rate_limit_max,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }, // Skip trust proxy validation
});
app.use('/auth', limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Error logging middleware
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Server error:', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database
import { prisma } from './auth/database';

// Create singleton GameLogic instance
const gameLogic = new GameLogic();

// Export gameLogic for use in routes and middleware
export { gameLogic };

// Basic health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      casdoor: 'unknown'
    }
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  // Check Casdoor connectivity (non-critical, doesn't fail health check)
  try {
    const casdoorUrl = process.env.CASDOOR_URL || process.env.CASDOOR_ENDPOINT;
    if (casdoorUrl) {
      const response = await fetch(`${casdoorUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(config.server.health_check_timeout_ms)
      }).catch(() => null);
      health.checks.casdoor = response && response.ok ? 'ok' : 'error';
      // Casdoor failure doesn't degrade overall health status
    } else {
      health.checks.casdoor = 'skipped';
    }
  } catch (error) {
    health.checks.casdoor = 'error';
    // Casdoor failure doesn't degrade overall health status
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Auth routes
import authRoutes from './auth/routes';
import roomRoutes, { setSocketIO as setRoomSocketIO } from './auth/roomRoutes';
import { verifyRoomJoin } from './auth/middleware';
const apiPrefix = process.env.API_PREFIX || '/api';
setRoomSocketIO(io);
app.use(`${apiPrefix}/auth`, authRoutes);

// Socket.io handlers with authentication
const socketHandlers = new SocketHandlers(io, gameLogic);

// Create /ws/game namespace for room-specific connections
const gameNamespace = io.of('/ws/game');

// Apply authentication middleware to the namespace
gameNamespace.use(authenticateSocketWithFallback);

// Apply room join verification middleware
gameNamespace.use(verifyRoomJoin);

// Handle connections to the /ws/game namespace
gameNamespace.on('connection', (socket) => {
  logger.info(`User connected to /ws/game: ${(socket as any).userId} (${(socket as any).profile?.isGuest ? 'guest' : 'authenticated'})`);
  socketHandlers.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;

// Configure server timeouts to prevent hung connections
server.setTimeout(config.server.server_timeout_ms);
server.keepAliveTimeout = config.server.keep_alive_timeout_ms;
server.headersTimeout = config.server.headers_timeout_ms;

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close Socket.IO connections
  io.close(() => {
    logger.info('Socket.IO server closed');
  });
  
  // Force close after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, config.server.graceful_shutdown_timeout_ms);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, () => {
  logger.info(`Bunker server running on port ${PORT}`);
  logger.info(`Casdoor URL: ${process.env.CASDOOR_URL}`);
});

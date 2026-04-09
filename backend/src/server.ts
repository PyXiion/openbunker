import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { SocketHandlers } from './socket/handlers';
import { GameLogic } from './game/gameLogic';
import { initializeDatabase } from './auth/database';
import { authenticateSocketWithFallback } from './auth/middleware';
import { logger } from './utils/logger';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  path: process.env.WS_PATH,
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  perMessageDeflate: {
    threshold: 1024, // Compress messages >1KB
    zlibDeflateOptions: {
      level: 3,
      memLevel: 7
    },
    zlibInflateOptions: {
      level: 3,
      memLevel: 7
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
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
initializeDatabase();

// Create singleton GameLogic instance
const gameLogic = new GameLogic();

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
    const { initializeDatabase } = await import('./auth/database');
    const db = initializeDatabase();
    await db.query('SELECT 1');
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
        signal: AbortSignal.timeout(3000)
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
app.use('/auth', authRoutes);

// Socket.io handlers with authentication
const socketHandlers = new SocketHandlers(io, gameLogic);

// Apply authentication middleware to all socket connections
io.use(authenticateSocketWithFallback);

io.on('connection', (socket) => {
  logger.info(`User connected: ${(socket as any).userId} (${(socket as any).profile?.is_guest ? 'guest' : 'authenticated'})`);
  socketHandlers.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;

// Configure server timeouts to prevent hung connections
server.setTimeout(30000); // 30 second timeout for requests
server.keepAliveTimeout = 65000; // 65 seconds for keep-alive
server.headersTimeout = 66000; // Slightly longer than keepAliveTimeout

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
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, () => {
  logger.info(`Bunker server running on port ${PORT}`);
  logger.info(`Casdoor URL: ${process.env.CASDOOR_URL}`);
});

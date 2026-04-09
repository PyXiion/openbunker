import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
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
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.log(`${req.method} ${req.path}`);
  next();
});

// Error logging middleware
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database
initializeDatabase();

// Create singleton GameLogic instance
const gameLogic = new GameLogic();

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
import authRoutes from './auth/routes';
app.use('/auth', authRoutes);

// Socket.io handlers with authentication
const socketHandlers = new SocketHandlers(io, gameLogic);

// Apply authentication middleware to all socket connections
io.use(authenticateSocketWithFallback);

io.on('connection', (socket) => {
  logger.log(`User connected: ${(socket as any).userId} (${(socket as any).profile?.is_guest ? 'guest' : 'authenticated'})`);
  socketHandlers.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  logger.log(`Bunker server running on port ${PORT}`);
  logger.log(`Casdoor URL: ${process.env.CASDOOR_URL}`);
});

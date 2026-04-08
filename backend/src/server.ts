import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { SocketHandlers } from './socket/handlers';
import { GameLogic } from './game/gameLogic';
import { initializeDatabase } from './auth/database';
import { authenticateSocketWithFallback } from './auth/middleware';

// Load environment variables
dotenv.config();

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
app.use(cors());
app.use(express.json());

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
  console.log(`User connected: ${(socket as any).userId} (${(socket as any).profile?.is_guest ? 'guest' : 'authenticated'})`);
  socketHandlers.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Bunker server running on port ${PORT}`);
  console.log(`Zitadel URL: ${process.env.ZITADEL_URL}`);
});

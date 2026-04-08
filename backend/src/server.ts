import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { SocketHandlers } from './socket/handlers';
import { GameLogic } from './game/gameLogic';

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

// Create singleton GameLogic instance
const gameLogic = new GameLogic();

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io handlers
const socketHandlers = new SocketHandlers(io, gameLogic);

io.on('connection', (socket) => {
  socketHandlers.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Bunker server running on port ${PORT}`);
});

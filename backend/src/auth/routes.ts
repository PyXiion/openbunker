import express from 'express';
import { Server } from 'socket.io';
import * as CasdoorSDK from 'casdoor-nodejs-sdk';
import { createProfile, updateProfile, getProfile, getGameHistory, getUserStats } from './database';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { CreateRoomSettings } from '../types';
import { gameLogic } from '../server';

const router = express.Router();
let io: Server | null = null;

// Set Socket.IO server instance for broadcasting
export function setSocketIO(socketIO: Server) {
  io = socketIO;
}

// Helper function to authenticate REST requests
async function authenticateRequest(req: express.Request): Promise<{ userId: string; isGuest: boolean } | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const guestUserId = req.headers['x-guest-user-id'] as string;

  if (token) {
    // JWT authentication
    try {
      const casdoor = getCasdoor();
      const user = await casdoor.parseJwtToken(token);
      if (user && user.id) {
        return { userId: user.id, isGuest: false };
      }
    } catch (error) {
      logger.error('JWT authentication failed:', error);
    }
  } else if (guestUserId) {
    // Guest authentication
    const profile = await getProfile(guestUserId);
    if (profile && profile.isGuest) {
      return { userId: guestUserId, isGuest: true };
    }
  }

  return null;
}

// Validation schemas
const guestAuthSchema = z.object({
  username: z.string().min(1).max(50).trim()
});

const callbackSchema = z.object({
  code: z.string().min(1)
});

const upgradeSchema = z.object({
  shadowUserId: z.string().min(1),
  realToken: z.string().min(1)
});

const usernameSchema = z.object({
  username: z.string().min(1).max(50).trim()
});

const createRoomSchema = z.object({
  playerName: z.string().min(1).max(50).trim(),
  language: z.string().optional().default('en'),
  settings: z.object({
    bunkerCapacity: z.number().min(2).max(10).optional(),
    firstTraitToReveal: z.enum(['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact']).optional(),
    enableContentFilter: z.boolean().optional(),
  }).optional()
});

const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(20),
  playerName: z.string().min(1).max(50).trim()
});

const leaveRoomSchema = z.object({
  roomId: z.string().min(1).max(20)
});

// Initialize Casdoor SDK lazily to ensure environment variables are loaded
let casdoorInstance: any = null;

function getCasdoor() {
  if (!casdoorInstance) {
    const certificate = process.env.CASDOOR_CERT || '';

    const cleanedCert = certificate
      .split(/\\n|\n/)
      .map(line => line.trim())
      .join('\n');

    const requiredEnvVars = [
      'CASDOOR_URL',
      'CASDOOR_CLIENT_ID',
      'CASDOOR_CLIENT_SECRET',
      'CASDOOR_CERT',
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required Casdoor environment variables: ${missingEnvVars.join(', ')}`);
    }

    const casdoorConfig = {
      endpoint: process.env.CASDOOR_URL || process.env.CASDOOR_ENDPOINT || 'http://localhost:8000',
      clientId: process.env.CASDOOR_CLIENT_ID || '',
      clientSecret: process.env.CASDOOR_CLIENT_SECRET || '',
      appName: process.env.CASDOOR_APP_NAME || 'bunker',
      orgName: process.env.CASDOOR_ORG_NAME || 'bunker',
      certificate: cleanedCert,
    };

    casdoorInstance = new CasdoorSDK.SDK(casdoorConfig);
  }
  return casdoorInstance;
}

// Guest authentication endpoint
router.post('/guest', async (req, res) => {
  try {
    const result = guestAuthSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid username', details: result.error.issues });
    }

    const { username } = result.data;

    // Generate a guest user ID
    const guestUserId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Persist guest profile to database immediately
    const profile = await createProfile({
      id: guestUserId,
      username: username,
      email: null,
      avatarUrl: null,
      isGuest: true,
      lastLogin: new Date(),
    });
    
    res.json({
      userId: guestUserId,
      username,
      isGuest: true,
    });
  } catch (error) {
    logger.error('Guest auth error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const casdoor = getCasdoor();
    const user = await casdoor.parseJwtToken(token);
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    let profile = await getProfile(user.id);
    
    if (!profile) {
      // Create profile if it doesn't exist
      profile = await createProfile({
        id: user.id,
        username: user.name || user.displayName || 'Unknown',
        email: user.email,
        avatarUrl: user.avatar,
        isGuest: false,
        lastLogin: new Date(),
      });
    } else {
      // Update last login and verification status
      profile = await updateProfile(user.id, {
        lastLogin: new Date(),
        avatarUrl: user.avatar || profile.avatarUrl,
      });
    }

    res.json({
      profile,
      user: {
        userId: user.id,
        username: user.name,
        email: user.email,
        avatarUrl: user.avatar,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// OAuth callback endpoint - exchange code for token and sync with database
router.post('/callback', async (req, res) => {
  try {
    const result = callbackSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid authorization code', details: result.error.issues });
    }

    const { code } = result.data;

    const casdoor = getCasdoor();
    const tokenResponse = await casdoor.getAuthToken(code);
    
    const token = tokenResponse.access_token;
    
    if (!token) {
      console.error('Token is empty after extraction');
      return res.status(400).json({ error: 'Failed to get access token' });
    }

    // Parse JWT token to get user info
    const claims = casdoor.parseJwtToken(token) as any;
    
    // Casdoor JWT contains user info directly in claims, not nested User property
    const user = claims;
    
    if (!user || !user.id) {
      console.error('Failed to parse JWT token or missing user info');
      return res.status(400).json({ error: 'Failed to parse JWT token' });
    }

    // Get or create user profile
    let profile = await getProfile(user.id);
    
    if (!profile) {
      profile = await createProfile({
        id: user.id,
        username: user.name || user.displayName || 'Unknown',
        email: user.email,
        avatarUrl: user.avatar,
        isGuest: false,
        lastLogin: new Date(),
      });
    } else {
      profile = await updateProfile(user.id, {
        lastLogin: new Date(),
        avatarUrl: user.avatar || profile.avatarUrl,
      });
    }

    if (!profile) {
      return res.status(500).json({ error: 'Failed to create or update profile' });
    }

    res.json({
      userId: user.id,
      username: profile.username,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      token: token,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
});

// Link shadow user to real account (upgrade from guest)
router.post('/upgrade', async (req, res) => {
  try {
    const result = upgradeSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid upgrade data', details: result.error.issues });
    }

    const { shadowUserId, realToken } = result.data;

    const casdoor = getCasdoor();
    const realUser = await casdoor.parseJwtToken(realToken);
    
    if (!realUser || !realUser.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Update profile to mark as not a guest
    const profile = await updateProfile(shadowUserId, {
      isGuest: false,
      email: realUser.email,
      avatarUrl: realUser.avatar,
    });

    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Account upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade account' });
  }
});

// Update username endpoint
router.put('/username', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const result = usernameSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid username', details: result.error.issues });
    }

    const { username } = result.data;

    const casdoor = getCasdoor();
    const user = await casdoor.parseJwtToken(token);
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Update Casdoor first (IdP is source of truth)
    try {
      await casdoor.updateUser({
        id: user.id,
        name: username.trim(),
      });
    } catch (casdoorError) {
      logger.error('Failed to update Casdoor username:', { error: casdoorError instanceof Error ? casdoorError.message : String(casdoorError) });
      return res.status(500).json({ error: 'Failed to update username in Casdoor' });
    }
    
    // Update local database after Casdoor succeeds
    const profile = await updateProfile(user.id, {
      username: username.trim(),
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      username: profile.username,
    });
  } catch (error) {
    console.error('Username update error:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// Casdoor webhook endpoint for bidirectional sync (Casdoor → DB)
router.post('/casdoor/webhook', async (req, res) => {
  try {
    const { eventType, user } = req.body;

    if (!user || !user.id) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Handle user update events
    if (eventType === 'updateUser') {
      const profile = await getProfile(user.id);

      if (profile) {
        // Sync username, email, avatar from Casdoor
        await updateProfile(user.id, {
          username: user.name || profile.username,
          email: user.email,
          avatarUrl: user.avatar,
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Casdoor webhook error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Get game history for authenticated user
router.get('/game-history', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const casdoor = getCasdoor();
    const user = await casdoor.parseJwtToken(token);

    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const history = await getGameHistory(user.id, limit);

    res.json({ history });
  } catch (error) {
    logger.error('Game history fetch error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

// Get user statistics for authenticated user
router.get('/stats', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const casdoor = getCasdoor();
    const user = await casdoor.parseJwtToken(token);

    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const stats = await getUserStats(user.id);

    res.json({ stats });
  } catch (error) {
    logger.error('User stats fetch error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// Room routes

// POST /api/rooms/create - Create a new room
router.post('/rooms/create', async (req, res) => {
  try {
    const result = createRoomSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request data', details: result.error.issues });
    }

    const { playerName, language, settings } = result.data;

    // Authenticate request
    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    // Fetch avatar URL from database
    let avatarUrl: string | undefined;
    try {
      const profile = await getProfile(auth.userId);
      avatarUrl = profile?.avatarUrl ?? undefined;
    } catch (error) {
      logger.error('Failed to fetch profile for avatar:', error);
    }

    // Create room using GameLogic (pass userId as temporary socketId placeholder)
    const room = gameLogic.createRoom(
      auth.userId, // socketId placeholder, will be updated when WebSocket connects
      playerName,
      auth.userId,
      language,
      settings,
      avatarUrl,
      auth.isGuest
    );

    // Return initial room state for optimistic UI updates
    res.json({
      roomId: room.roomId,
      settings: room.settings,
      players: Object.values(room.players).map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isReady: p.isReady,
        avatarUrl: p.avatarUrl,
        isGuest: p.isGuest
      })),
      status: room.status
    });
  } catch (error) {
    logger.error('Create room error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to create room', code: 'INTERNAL_ERROR' });
  }
});

// POST /api/rooms/join - Join an existing room
router.post('/rooms/join', async (req, res) => {
  try {
    const result = joinRoomSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request data', details: result.error.issues });
    }

    const { roomId, playerName } = result.data;

    // Authenticate request
    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    // Check if room exists before attempting to join
    const existingRoom = gameLogic.getRoom(roomId);
    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found', code: 'ROOM_NOT_FOUND' });
    }

    // Check if room is in LOBBY state
    if (existingRoom.status !== 'LOBBY') {
      return res.status(400).json({ error: 'Game already started', code: 'GAME_STARTED' });
    }

    // Check if room is full
    if (Object.keys(existingRoom.players).length >= 10) {
      return res.status(400).json({ error: 'Room is full', code: 'ROOM_FULL' });
    }

    // Fetch avatar URL from database
    let avatarUrl: string | undefined;
    try {
      const profile = await getProfile(auth.userId);
      avatarUrl = profile?.avatarUrl ?? undefined;
    } catch (error) {
      logger.error('Failed to fetch profile for avatar:', error);
    }

    // Join room using GameLogic (pass userId as temporary socketId placeholder)
    const room = gameLogic.joinRoom(
      roomId,
      auth.userId, // socketId placeholder, will be updated when WebSocket connects
      playerName,
      auth.userId,
      avatarUrl,
      auth.isGuest
    );

    if (!room) {
      return res.status(400).json({ error: 'Failed to join room', code: 'JOIN_FAILED' });
    }

    // Return current room state for optimistic UI updates
    res.json({
      success: true,
      room: {
        roomId: room.roomId,
        status: room.status,
        settings: room.settings,
        players: Object.values(room.players).map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          isReady: p.isReady,
          avatarUrl: p.avatarUrl,
          isGuest: p.isGuest
        })),
        round: room.round
      }
    });

    // Broadcast room state to WebSocket room so other players get update
    if (io) {
      const gameNamespace = io.of('/ws/game');
      // Broadcast to all connected sockets in the room
      gameNamespace.to(roomId).emit('ROOM_STATE_UPDATE', room);
    }
  } catch (error) {
    logger.error('Join room error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to join room', code: 'INTERNAL_ERROR' });
  }
});

// POST /api/rooms/leave - Leave a room (for explicit exit button)
router.post('/rooms/leave', async (req, res) => {
  try {
    const result = leaveRoomSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request data', details: result.error.issues });
    }

    const { roomId } = result.data;

    // Authenticate request
    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    // Get room
    const room = gameLogic.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found', code: 'ROOM_NOT_FOUND' });
    }

    // Find player by userId
    const player = Object.values(room.players).find(p => p.id === auth.userId);
    if (!player) {
      return res.status(400).json({ error: 'Player not in room', code: 'NOT_IN_ROOM' });
    }

    // Remove player from room
    const success = gameLogic.removePlayer(roomId, auth.userId);
    if (!success) {
      return res.status(400).json({ error: 'Failed to leave room', code: 'LEAVE_FAILED' });
    }

    res.json({ success: true });

    // Broadcast room state to WebSocket room so other players get update
    const updatedRoom = gameLogic.getRoom(roomId);
    if (io && updatedRoom) {
      const gameNamespace = io.of('/ws/game');
      // Broadcast to all connected sockets in the room
      gameNamespace.to(roomId).emit('ROOM_STATE_UPDATE', updatedRoom);
    }
  } catch (error) {
    logger.error('Leave room error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to leave room', code: 'INTERNAL_ERROR' });
  }
});

export default router;

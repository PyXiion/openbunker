import express from 'express';
import { Server } from 'socket.io';
import { getProfile } from './database';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { gameLogic } from '../server';
import { casdoorService } from '../services/casdoorService';

const router = express.Router();
let io: Server | null = null;

export function setSocketIO(socketIO: Server) {
  io = socketIO;
}

async function authenticateRequest(req: express.Request): Promise<{ userId: string; isGuest: boolean } | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const guestUserId = req.headers['x-guest-user-id'] as string;

  if (token) {
    try {
      const user = await casdoorService.parseJwtToken(token);
      if (user && user.id) {
        return { userId: user.id, isGuest: false };
      }
    } catch (error) {
      logger.error('JWT authentication failed:', error);
    }
  } else if (guestUserId) {
    const profile = await getProfile(guestUserId);
    if (profile && profile.isGuest) {
      return { userId: guestUserId, isGuest: true };
    }
  }

  return null;
}

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
  roomCode: z.string().min(1).max(10),
  playerName: z.string().min(1).max(50).trim()
});

const leaveRoomSchema = z.object({
  roomId: z.string().min(1).max(20)
});

router.post('/rooms/create', async (req, res) => {
  try {
    const result = createRoomSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request data', details: result.error.issues });
    }

    const { playerName, language, settings } = result.data;

    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    let avatarUrl: string | undefined;
    try {
      const profile = await getProfile(auth.userId);
      avatarUrl = profile?.avatarUrl ?? undefined;
    } catch (error) {
      logger.error('Failed to fetch profile for avatar:', error);
    }

    const room = await gameLogic.createRoom(
      auth.userId,
      playerName,
      language,
      settings,
      avatarUrl,
      auth.isGuest
    );

    res.json({
      roomId: room.roomId,
      roomCode: room.roomCode,
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

router.post('/rooms/join', async (req, res) => {
  try {
    const result = joinRoomSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request data', details: result.error.issues });
    }

    const { roomCode, playerName } = result.data;

    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    // Find room by roomCode
    const allRooms = gameLogic.getRooms();
    const existingRoom = Array.from(allRooms.values()).find((room): room is typeof room => room.roomCode === roomCode);
    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found', code: 'ROOM_NOT_FOUND' });
    }

    // Check if player is already in room (reconnection)
    const existingPlayer = Object.values(existingRoom.players).find(p => p.id === auth.userId);
    const isReconnection = !!existingPlayer;

    // Only enforce LOBBY status for new players, not reconnections
    if (!isReconnection && existingRoom.status !== 'LOBBY') {
      return res.status(400).json({ error: 'Game already started', code: 'GAME_STARTED' });
    }

    // Only enforce room capacity for new players
    if (!isReconnection && Object.keys(existingRoom.players).length >= 10) {
      return res.status(400).json({ error: 'Room is full', code: 'ROOM_FULL' });
    }

    let avatarUrl: string | undefined;
    try {
      const profile = await getProfile(auth.userId);
      avatarUrl = profile?.avatarUrl ?? undefined;
    } catch (error) {
      logger.error('Failed to fetch profile for avatar:', error);
    }

    const room = await gameLogic.joinRoom(
      existingRoom.roomId,
      auth.userId,
      playerName,
      avatarUrl,
      auth.isGuest
    );

    if (!room) {
      return res.status(400).json({ error: 'Failed to join room', code: 'JOIN_FAILED' });
    }

    res.json({
      success: true,
      room: {
        roomId: room.roomId,
        roomCode: room.roomCode,
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

    if (io) {
      const gameNamespace = io.of('/ws/game');
      gameNamespace.to(existingRoom.roomId).emit('ROOM_STATE_UPDATE', room);
    }
  } catch (error) {
    logger.error('Join room error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to join room', code: 'INTERNAL_ERROR' });
  }
});

router.post('/rooms/leave', async (req, res) => {
  try {
    const result = leaveRoomSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request data', details: result.error.issues });
    }

    const { roomId } = result.data;

    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const room = gameLogic.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found', code: 'ROOM_NOT_FOUND' });
    }

    const player = Object.values(room.players).find(p => p.id === auth.userId);
    if (!player) {
      return res.status(400).json({ error: 'Player not in room', code: 'NOT_IN_ROOM' });
    }

    const success = gameLogic.removePlayer(roomId, auth.userId);
    if (!success) {
      return res.status(400).json({ error: 'Failed to leave room', code: 'LEAVE_FAILED' });
    }

    res.json({ success: true });

    const updatedRoom = gameLogic.getRoom(roomId);
    if (io && updatedRoom) {
      const gameNamespace = io.of('/ws/game');
      gameNamespace.to(roomId).emit('ROOM_STATE_UPDATE', updatedRoom);
    }
  } catch (error) {
    logger.error('Leave room error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to leave room', code: 'INTERNAL_ERROR' });
  }
});

export default router;

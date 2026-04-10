import { Socket } from 'socket.io';
import { getProfile, createProfile, updateProfile } from './database';
import { logger } from '../utils/logger';
import { gameLogic } from '../server';
import { casdoorService } from '../services/casdoorService';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: any;
  profile: any;
}

export interface GuestUserInfo {
  userId: string;
  username: string;
  isGuest: true;
}

export async function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('No authentication token provided'));
    }

    const user = await casdoorService.parseJwtToken(token);
    
    if (!user || !user.id) {
      return next(new Error('Invalid token'));
    }
    
    // Get or create user profile
    let profile = await getProfile(user.id);
    
    if (!profile) {
      // Create new profile for authenticated user
      profile = await createProfile({
        id: user.id,
        username: user.name || user.displayName || 'Unknown',
        email: user.email ?? null,
        avatarUrl: user.avatar ?? null,
        isGuest: false,
        lastLogin: new Date(),
      });
    } else {
      // Update last login
      profile = await updateProfile(user.id, {
        lastLogin: new Date(),
        avatarUrl: user.avatar || profile.avatarUrl,
      });
    }

    // Extend socket with user information
    (socket as AuthenticatedSocket).userId = user.id;
    (socket as AuthenticatedSocket).user = user;
    (socket as AuthenticatedSocket).profile = profile;

    next();
  } catch (error) {
    logger.error('Socket authentication failed:', error);
    next(new Error('Authentication failed'));
  }
}

export async function authenticateGuest(socket: Socket, next: (err?: Error) => void) {
  try {
    const guestInfo = socket.handshake.auth.guest as GuestUserInfo;
    
    if (!guestInfo || !guestInfo.userId || !guestInfo.username) {
      return next(new Error('Invalid guest information'));
    }

    // Get or create guest profile
    let profile = await getProfile(guestInfo.userId);
    
    if (!profile) {
      profile = await createProfile({
        id: guestInfo.userId,
        username: guestInfo.username,
        email: null,
        avatarUrl: null,
        isGuest: true,
        lastLogin: new Date(),
      });
    } else {
      // Update last login and ensure is_guest is set to true
      profile = await updateProfile(guestInfo.userId, {
        lastLogin: new Date(),
        isGuest: true,
      });
    }

    // Extend socket with guest information
    (socket as AuthenticatedSocket).userId = guestInfo.userId;
    (socket as AuthenticatedSocket).user = {
      id: guestInfo.userId,
      name: guestInfo.username,
      displayName: guestInfo.username,
    };
    (socket as AuthenticatedSocket).profile = profile;

    next();
  } catch (error) {
    logger.error('Guest authentication failed:', error);
    next(new Error('Guest authentication failed'));
  }
}

export async function authenticateSocketWithFallback(socket: Socket, next: (err?: Error) => void) {
  // Try JWT authentication first
  if (socket.handshake.auth.token) {
    return authenticateSocket(socket, next);
  }
  
  // Fall back to guest authentication
  if (socket.handshake.auth.guest) {
    return authenticateGuest(socket, next);
  }
  
  next(new Error('No valid authentication provided'));
}

export function requireAuthentication(socket: Socket): AuthenticatedSocket {
  const authSocket = socket as AuthenticatedSocket;
  
  if (!authSocket.userId || !authSocket.user) {
    throw new Error('Socket not authenticated');
  }
  
  return authSocket;
}

export function isGuest(socket: Socket): boolean {
  const authSocket = socket as AuthenticatedSocket;
  // Check if socket authenticated via guest flow (no token, but guest info present)
  const hasGuestAuth = socket.handshake.auth.guest;
  const hasToken = socket.handshake.auth.token;
  return !!hasGuestAuth && !hasToken;
}


export function canAccessRoom(socket: Socket, roomId: string): boolean {
  // For now, allow all authenticated users to access any room
  // In the future, you might implement room-specific permissions
  const authSocket = socket as AuthenticatedSocket;
  return !!authSocket.userId;
}

export function requireRoomAccess(socket: Socket, roomId: string): AuthenticatedSocket {
  const authSocket = requireAuthentication(socket);

  if (!canAccessRoom(socket, roomId)) {
    throw new Error('Access denied to room');
  }

  return authSocket;
}

/**
 * Middleware to verify user has joined room via REST API before allowing WebSocket connection.
 * This ensures the WebSocket connection is only accepted after successful REST join/create.
 */
export async function verifyRoomJoin(socket: Socket, next: (err?: Error) => void) {
  try {
    const roomId = socket.handshake.auth.roomId as string;
    const authSocket = socket as AuthenticatedSocket;

    if (!roomId) {
      return next(new Error('Room ID required in auth payload'));
    }

    if (!authSocket.userId) {
      return next(new Error('Authentication required'));
    }

    // Verify room exists
    const room = gameLogic.getRoom(roomId);
    if (!room) {
      return next(new Error('Room not found'));
    }

    // Verify user is in the room (via REST join/create)
    const player = Object.values(room.players).find(p => p.id === authSocket.userId);
    if (!player) {
      return next(new Error('User not in room. Please join via REST API first.'));
    }

    next();
  } catch (error) {
    logger.error('Room join verification failed:', error);
    next(new Error('Room join verification failed'));
  }
}

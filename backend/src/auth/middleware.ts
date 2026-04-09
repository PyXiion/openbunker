import { Socket } from 'socket.io';
import * as CasdoorSDK from 'casdoor-nodejs-sdk';
import { getProfile, createProfile, updateProfile } from './database';
import { logger } from '../utils/logger';

// Validate required Casdoor configuration
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

// Clean certificate format
const certificate = process.env.CASDOOR_CERT || '';
const cleanedCert = certificate
  .split(/\\n|\n/)
  .map(line => line.trim())
  .join('\n');

// Initialize Casdoor SDK
const casdoor = new CasdoorSDK.SDK({
  endpoint: process.env.CASDOOR_URL || process.env.CASDOOR_ENDPOINT || 'http://localhost:8000',
  clientId: process.env.CASDOOR_CLIENT_ID || '',
  clientSecret: process.env.CASDOOR_CLIENT_SECRET || '',
  appName: process.env.CASDOOR_APP_NAME || 'bunker',
  orgName: process.env.CASDOOR_ORG_NAME || 'bunker',
  certificate: cleanedCert,
});

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

    const user = await casdoor.parseJwtToken(token);
    
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
        email: user.email,
        avatar_url: user.avatar,
        is_guest: false,
        last_login: new Date(),
      });
    } else {
      // Update last login
      profile = await updateProfile(user.id, {
        last_login: new Date(),
        avatar_url: user.avatar || profile.avatar_url,
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
        is_guest: true,
        last_login: new Date(),
      });
    } else {
      // Update last login
      profile = await updateProfile(guestInfo.userId, {
        last_login: new Date(),
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
  return authSocket.profile?.is_guest || false;
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

import { Socket } from 'socket.io';
import { getZitadelClient, ZitadelUser } from './zitadel';
import { getProfile, createProfile, updateProfile } from './database';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: ZitadelUser;
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

    const zitadelClient = getZitadelClient();
    const user = await zitadelClient.verifyToken(token);
    
    // Get or create user profile
    let profile = await getProfile(user.userId);
    
    if (!profile) {
      // Create new profile for authenticated user
      profile = await createProfile({
        id: user.userId,
        username: user.displayName || user.loginName || user.preferredLoginName || 'Unknown',
        email: user.email,
        avatar_url: user.avatarUrl,
        is_guest: false,
        is_verified: user.isEmailVerified,
        last_login: new Date(),
      });
    } else {
      // Update last login
      profile = await updateProfile(user.userId, {
        last_login: new Date(),
        is_verified: user.isEmailVerified,
        avatar_url: user.avatarUrl || profile.avatar_url,
      });
    }

    // Extend socket with user information
    (socket as AuthenticatedSocket).userId = user.userId;
    (socket as AuthenticatedSocket).user = user;
    (socket as AuthenticatedSocket).profile = profile;

    next();
  } catch (error) {
    console.error('Socket authentication failed:', error);
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
        is_verified: false,
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
      userId: guestInfo.userId,
      loginName: guestInfo.username,
      displayName: guestInfo.username,
      isEmailVerified: false,
    } as ZitadelUser;
    (socket as AuthenticatedSocket).profile = profile;

    next();
  } catch (error) {
    console.error('Guest authentication failed:', error);
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

export function isVerified(socket: Socket): boolean {
  const authSocket = socket as AuthenticatedSocket;
  return authSocket.profile?.is_verified || false;
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

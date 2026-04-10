import { useRuntimeConfig } from '#app/nuxt';
import { useAuth } from '~/composables/useAuth';
import type { CreateRoomSettings } from '~/types/settings';
import { logger } from '~/utils/logger';

export interface CreateRoomResponse {
  roomId: string;
  settings: any;
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isReady: boolean;
    avatarUrl?: string;
    isGuest: boolean;
  }>;
  status: string;
}

export interface JoinRoomResponse {
  success: boolean;
  room: {
    roomId: string;
    status: string;
    settings: any;
    players: Array<{
      id: string;
      name: string;
      isHost: boolean;
      isReady: boolean;
      avatarUrl?: string;
      isGuest: boolean;
    }>;
    round: number;
  };
}

export interface RoomErrorResponse {
  error: string;
  code?: string;
  details?: any;
}

export const useRoomService = () => {
  const config = useRuntimeConfig();
  const auth = useAuth();

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth.isAuthenticated.value) {
      const token = auth.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } else if (auth.isGuest.value) {
      const guestUser = auth.getGuestUser();
      if (guestUser) {
        headers['x-guest-user-id'] = guestUser.userId;
      }
    }

    return headers;
  };

  const createRoom = async (
    playerName: string,
    language?: string,
    settings?: CreateRoomSettings
  ): Promise<CreateRoomResponse> => {
    try {
      const response = await fetch(`${config.public.backendUrl}/api/auth/rooms/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ playerName, language, settings }),
      });

      if (!response.ok) {
        const errorData: RoomErrorResponse = await response.json();
        throw new Error(errorData.error || 'Failed to create room');
      }

      return await response.json();
    } catch (error) {
      logger.error('Create room error:', error);
      throw error;
    }
  };

  const joinRoom = async (
    roomId: string,
    playerName: string
  ): Promise<JoinRoomResponse> => {
    try {
      const response = await fetch(`${config.public.backendUrl}/api/auth/rooms/join`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomId, playerName }),
      });

      if (!response.ok) {
        const errorData: RoomErrorResponse = await response.json();
        throw new Error(errorData.error || 'Failed to join room');
      }

      return await response.json();
    } catch (error) {
      logger.error('Join room error:', error);
      throw error;
    }
  };

  const leaveRoom = async (roomId: string): Promise<{ success: boolean }> => {
    try {
      const response = await fetch(`${config.public.backendUrl}/api/auth/rooms/leave`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomId }),
      });

      if (!response.ok) {
        const errorData: RoomErrorResponse = await response.json();
        throw new Error(errorData.error || 'Failed to leave room');
      }

      return await response.json();
    } catch (error) {
      logger.error('Leave room error:', error);
      throw error;
    }
  };

  return {
    createRoom,
    joinRoom,
    leaveRoom,
  };
};

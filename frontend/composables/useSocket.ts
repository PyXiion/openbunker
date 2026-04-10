import { io, Socket } from 'socket.io-client';
import { useGameStore } from '~/stores/game';
import { useRuntimeConfig } from '#app/nuxt';
import { useI18n, navigateTo } from '#imports';
import { useAuth } from './useAuth';
import type { CreateRoomSettings, UpdateRoomSettings } from '~/types/settings';
import { logger } from '~/utils/logger';
import { applyDelta } from '~/utils/delta';

// Room-specific socket instance
let roomSocket: Socket | null = null;
let initialStateTimeout: NodeJS.Timeout | null = null;
const INITIAL_STATE_TIMEOUT_MS = 10000; // 10 seconds timeout for INITIAL_STATE

/**
 * Composable for managing room-specific Socket.io connection and game events.
 * Creates WebSocket connection only when entering a room.
 * Handles room state synchronization via INITIAL_STATE event.
 */
export const useSocket = () => {
  const config = useRuntimeConfig();
  const gameStore = useGameStore();
  const { locale } = useI18n();

  /**
   * Connects to a specific room via WebSocket.
   * Creates room-specific connection with roomId in auth payload.
   * Waits for INITIAL_STATE event before resolving.
   */
  const connectToRoom = async (roomId: string): Promise<void> => {
    // Disconnect existing connection if any
    if (roomSocket) {
      disconnectFromRoom();
    }

    // Wait for auth service to be available (client-side only)
    if (!import.meta.client) {
      logger.warn('Socket connection deferred - not available during SSR');
      return;
    }

    const auth = useAuth();
    
    // Prepare authentication data
    let authData: any = {
      roomId, // Pass roomId in auth payload
    };
    
    if (auth.isAuthenticated.value) {
      // Authenticated user - use JWT token
      const token = auth.getAuthToken();
      if (token) {
        authData.token = token;
      }
    } else if (auth.isGuest.value) {
      // Guest user - use guest credentials
      const guestUser = auth.getGuestUser();
      if (guestUser) {
        authData.guest = {
          userId: guestUser.userId,
          username: guestUser.username,
          isGuest: true,
        };
      }
    }

    if (!authData.token && !authData.guest) {
      logger.error('No authentication available - socket will not connect');
      throw new Error('Authentication required');
    }

    logger.log('Connecting to room:', roomId, 'with auth:', authData.token ? 'JWT' : 'Guest');

    // Create socket connection to /ws/game namespace
    roomSocket = io(`${config.public.wsUrl}/ws/game`, {
      autoConnect: true,
      transports: ['websocket'],
      path: config.public.wsPath,
      auth: authData,
    });

    // Set up timeout for INITIAL_STATE event
    initialStateTimeout = setTimeout(() => {
      logger.error('INITIAL_STATE timeout - connection failed');
      disconnectFromRoom();
      throw new Error('Connection timeout - did not receive initial state');
    }, INITIAL_STATE_TIMEOUT_MS);

    // Set up event handlers
    roomSocket.on('connect', () => {
      logger.log('Connected to room:', roomId, 'with socket ID:', roomSocket!.id);
    });

    roomSocket.on('connect_error', (error) => {
      logger.error('Socket connection error:', error);
      if (initialStateTimeout) {
        clearTimeout(initialStateTimeout);
        initialStateTimeout = null;
      }
      disconnectFromRoom();
      throw error;
    });

    roomSocket.on('disconnect', () => {
      logger.log('Disconnected from room:', roomId);
      if (initialStateTimeout) {
        clearTimeout(initialStateTimeout);
        initialStateTimeout = null;
      }
      gameStore.setReconnecting(true);
    });

    roomSocket.on('INITIAL_STATE', (room: any) => {
      logger.log('Received INITIAL_STATE for room:', room.roomId);
      if (initialStateTimeout) {
        clearTimeout(initialStateTimeout);
        initialStateTimeout = null;
      }
      
      // Find current player by matching userId
      const currentPlayer = Object.values(room.players).find((p: any) => p.id === auth.currentUser.value?.userId || p.id === auth.guestUser.value?.userId) as any;
      if (currentPlayer) {
        gameStore.setPlayerId(currentPlayer.id);
      }
      
      gameStore.setRoom(room);
      gameStore.setReconnecting(false);
    });

    roomSocket.on('ROOM_STATE_UPDATE', (room: any) => {
      gameStore.setRoom(room);
    });

    roomSocket.on('ROOM_STATE_DELTA', (delta: any) => {
      gameStore.applyRoomDelta(delta);
    });

    roomSocket.on('ERROR', (data: any) => {
      logger.error('[Socket] ERROR received:', data);
      gameStore.setError(data.message);
      const toast = useToast();
      const message = data.message || 'An error occurred';
      if (message.includes('reveal') || message.includes('Reveal')) {
        toast.error(`${message}. You can only reveal cards during your turn.`, 6000);
      } else {
        toast.error(message, 5000);
      }
    });

    roomSocket.on('PLAYER_EXILED', (data: any) => {
      logger.log('Player exiled:', data.playerId);
    });

    roomSocket.on('PLAYER_LEFT', (data: any) => {
      logger.log('Player left room:', data.playerId, data.playerName);
    });

    roomSocket.on('KICKED', (data: any) => {
      logger.log('Kicked from room:', data.roomId, data.reason);
      gameStore.setKickedMessage('errors.kicked');
      gameStore.clearRoomState();
      disconnectFromRoom();
      navigateTo('/');
    });

    roomSocket.on('ROOM_CODE_REGENERATED', (data: any) => {
      logger.log('Room code regenerated:', data.oldRoomId, '->', data.newRoomId);
      const savedRoom = localStorage.getItem('gameRoom');
      if (savedRoom) {
        try {
          const room = JSON.parse(savedRoom);
          if (room.roomId === data.oldRoomId) {
            room.roomId = data.newRoomId;
            localStorage.setItem('gameRoom', JSON.stringify(room));
          }
        } catch (error) {
          logger.error('Failed to update saved room:', error);
        }
      }
    });

    roomSocket.on('CHAT_MESSAGE', (message: any) => {
      logger.log('[FRONTEND] Chat message received:', JSON.stringify(message));
      gameStore.addChatMessage(message);
    });
  };

  /**
   * Disconnects from the current room.
   * Performs thorough cleanup to prevent memory leaks.
   */
  const disconnectFromRoom = () => {
    if (roomSocket) {
      logger.log('Disconnecting from room');
      
      // Clear initial state timeout if exists
      if (initialStateTimeout) {
        clearTimeout(initialStateTimeout);
        initialStateTimeout = null;
      }
      
      // Remove all event listeners
      roomSocket.removeAllListeners();
      
      // Disconnect socket
      roomSocket.disconnect();
      
      // Clear reference
      roomSocket = null;
      
      gameStore.setReconnecting(false);
    }
  };

  const startGame = (roomId: string) => {
    if (!roomSocket) {
      logger.log('No socket available for startGame');
      return;
    }
    roomSocket.emit('START_GAME', { roomId });
  };

  const revealCard = (roomId: string, traitType: string) => {
    if (!roomSocket) return;
    roomSocket.emit('REVEAL_CARD', { roomId, traitType });
  };

  const endTurn = (roomId: string) => {
    if (!roomSocket) return;
    roomSocket.emit('END_TURN', { roomId });
  };

  const submitVote = (roomId: string, targetId: string) => {
    if (!roomSocket) return;
    roomSocket.emit('SUBMIT_VOTE', { roomId, targetId });
  };

  const leaveRoom = (roomId: string) => {
    if (!roomSocket) return;
    roomSocket.emit('LEAVE_ROOM', { roomId });
  };

  const kickPlayer = (roomId: string, targetId: string) => {
    if (!roomSocket) return;
    roomSocket.emit('KICK_PLAYER', { roomId, targetId });
  };

  const regenerateRoomCode = (roomId: string) => {
    if (!roomSocket) return;
    roomSocket.emit('REGENERATE_ROOM_CODE', { roomId });
  };

  const updateSettings = (roomId: string, settings: UpdateRoomSettings) => {
    if (!roomSocket) return;
    roomSocket.emit('UPDATE_SETTINGS', { roomId, settings });
  };

  const sendChatMessage = (roomId: string, message: string) => {
    if (!roomSocket) return;
    roomSocket.emit('SEND_CHAT_MESSAGE', { roomId, message });
  };

  const toggleReady = (roomId: string) => {
    if (!roomSocket) return;
    roomSocket.emit('TOGGLE_READY', { roomId });
  };

  return {
    connectToRoom,
    disconnectFromRoom,
    startGame,
    revealCard,
    endTurn,
    submitVote,
    leaveRoom,
    kickPlayer,
    regenerateRoomCode,
    updateSettings,
    sendChatMessage,
    toggleReady
  };
};

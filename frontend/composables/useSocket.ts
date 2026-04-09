import { io, Socket } from 'socket.io-client';
import { useGameStore } from '~/stores/game';
import { useRuntimeConfig } from '#app/nuxt';
import { useI18n, navigateTo } from '#imports';
import { useAuth } from './useAuth';
import type { CreateRoomSettings, UpdateRoomSettings } from '~/types/settings';
import { logger } from '~/utils/logger';
import { applyDelta } from '~/utils/delta';

// Global socket instance that persists across composable calls
let globalSocket: Socket | null = null;
let isJoiningRoom = false; // Prevent duplicate join requests
let isConnecting = false; // Prevent duplicate connection attempts
let connectionRetries = 0; // Track connection retries
const MAX_RETRIES = 10; // Maximum retry attempts
const INITIAL_RETRY_DELAY = 1000; // Initial retry delay in ms
const MAX_RETRY_DELAY = 30000; // Maximum retry delay in ms

// Calculate exponential backoff delay
function getRetryDelay(retryCount: number): number {
  return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
}

/**
 * Composable for managing Socket.io connection and game events.
 * Uses a global socket instance to maintain connection across component lifecycles.
 * Handles automatic reconnection and room state restoration on reconnect.
 */
export const useSocket = () => {
  const config = useRuntimeConfig();
  const gameStore = useGameStore();
  const { locale } = useI18n(); // Move to top level
  
  /**
   * Establishes Socket.io connection and sets up event handlers.
   * If saved room exists in localStorage, attempts to rejoin on connect.
   * Reuses existing socket if already connected.
   */
  const connect = async () => {
    // If socket instance already exists, don't create a new one
    if (globalSocket) {
      if (globalSocket.connected) {
        logger.log('Socket already connected, skipping reconnection');
      } else {
        logger.log('Socket instance exists but disconnected, skipping duplicate creation');
      }
      return;
    }

    // If connection is already in progress, skip to prevent duplicate attempts
    if (isConnecting) {
      logger.log('Connection already in progress, skipping duplicate attempt');
      return;
    }

    isConnecting = true;

    const auth = useAuth();
    
    // Wait for auth service to be available (client-side only)
    if (!import.meta.client) {
      logger.warn('Socket connection deferred - not available during SSR');
      isConnecting = false;
      return;
    }

    logger.log('Creating new socket connection...');
    logger.log('Auth state check:');
    logger.log('- isAuthenticated.value:', auth.isAuthenticated.value);
    logger.log('- isGuest.value:', auth.isGuest.value);
    logger.log('- currentUser.value:', auth.currentUser.value);
    logger.log('- guestUser.value:', auth.guestUser.value);
    
    // Prepare authentication data
    let authData: any = {};
    
    if (auth.isAuthenticated.value) {
      // Authenticated user - use JWT token
      const token = auth.getAuthToken();
      logger.log('Token found:', !!token);
      if (token) {
        authData.token = token;
      }
    } else if (auth.isGuest.value) {
      // Guest user - use guest credentials
      const guestUser = auth.getGuestUser();
      logger.log('Guest user found:', !!guestUser);
      if (guestUser) {
        authData.guest = {
          userId: guestUser.userId,
          username: guestUser.username,
          isGuest: true,
        };
      }
    }

    if (!authData.token && !authData.guest) {
      logger.log('No authentication available - socket will not connect');
      isConnecting = false;
      return;
    }

    // Reset retry counter on successful auth data preparation
    connectionRetries = 0;
    logger.log('Socket authentication data prepared:', authData.token ? 'JWT token' : 'Guest credentials');

    globalSocket = io(config.public.wsUrl, {
      autoConnect: false,
      transports: ['websocket'],
      path: config.public.wsPath,
      auth: authData, // Use auth option for secure handshake
    });

    // Manually connect the socket
    globalSocket.connect();

    globalSocket.on('connect', () => {
      logger.log('Socket connected with ID:', globalSocket!.id);
      gameStore.setConnected(true);
      connectionRetries = 0; // Reset retry counter on successful connection
      isConnecting = false; // Reset connection flag
      // Don't set playerId here - it will come from server in ROOM_STATE_UPDATE

      // If we have persisted room data, attempt to rejoin
      const savedRoom = localStorage.getItem('gameRoom');
      const savedPlayerName = localStorage.getItem('playerName');

      if (savedRoom && savedPlayerName && !isJoiningRoom) {
        try {
          const room = JSON.parse(savedRoom);
          logger.log('Attempting to rejoin room:', room.roomId, 'as', savedPlayerName);
          globalSocket!.emit('JOIN_ROOM', { roomId: room.roomId, playerName: savedPlayerName });
        } catch (error) {
          logger.error('Failed to parse saved room data:', error);
        }
      }
    });

    globalSocket.on('connect_error', (error) => {
      logger.error('Socket connection error:', error);
      isConnecting = false; // Reset connection flag on error
    });

    globalSocket.on('disconnect', () => {
      logger.log('Socket disconnected in composable');
      gameStore.setConnected(false);
      isConnecting = false; // Reset connection flag
    });

    globalSocket.on('ROOM_STATE_UPDATE', (room) => {
      // Find current player by matching socket ID to get player.id
      const currentPlayer = Object.values(room.players).find((p: any) => p.socketId === globalSocket?.id) as any;
      if (currentPlayer) {
        if (!gameStore.playerId) {
          gameStore.setPlayerId(currentPlayer.id);
        }
        // Save persistentId if not already saved
        if (!gameStore.persistentId) {
          gameStore.setPersistentId(currentPlayer.id);
        }
      }
      gameStore.setRoom(room);
      isJoiningRoom = false; // Reset join flag on successful room update
    });

    globalSocket.on('ROOM_STATE_DELTA', (delta) => {
      // Apply delta to existing room state
      gameStore.applyRoomDelta(delta);
      isJoiningRoom = false; // Reset join flag on successful delta update
    });

    globalSocket.on('ROOM_CREATED', (data) => {
      logger.log('Room created:', data.roomId);
      // Save userId from server response
      if (data.userId) {
        gameStore.setPlayerId(data.userId);
      }
      // Store guest status for UI
      if (data.isGuest !== undefined) {
        gameStore.setIsGuest(data.isGuest);
      }
      // Player ID will be set when ROOM_STATE_UPDATE arrives
      isJoiningRoom = false; // Reset join flag
    });

    globalSocket.on('JOIN_ERROR', (data) => {
      console.error('[Socket] JOIN_ERROR received', data);
      isJoiningRoom = false; // Reset join flag on error
      // Clear persisted room state and redirect to home
      gameStore.clearRoomState();
      // Set error after clearing to ensure it persists
      gameStore.setError(data.message);
      navigateTo('/');
    });

    globalSocket.on('ERROR', (data) => {
      console.error('[Socket] ERROR received', data);
      gameStore.setError(data.message);
      // Show toast notification for errors with more context
      const toast = useToast();
      const message = data.message || 'An error occurred';
      // Add context for reveal errors
      if (message.includes('reveal') || message.includes('Reveal')) {
        toast.error(`${message}. You can only reveal cards during your turn.`, 6000);
      } else {
        toast.error(message, 5000);
      }
    });

    globalSocket.on('PLAYER_EXILED', (data) => {
      logger.log('Player exiled:', data.playerId);
    });

    globalSocket.on('PLAYER_LEFT', (data) => {
      logger.log('Player left room:', data.playerId, data.playerName);
    });

    globalSocket.on('KICKED', (data) => {
      console.error('[Socket] KICKED received', data);
      logger.log('You were kicked from room:', data.roomId, data.reason);
      gameStore.setKickedMessage('errors.kicked');
      gameStore.clearRoomState();
      navigateTo('/');
    });

    globalSocket.on('ROOM_CODE_REGENERATED', (data) => {
      logger.log('Room code regenerated:', data.oldRoomId, '->', data.newRoomId);
      // Update local storage with new room ID
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

    globalSocket.on('CHAT_MESSAGE', (message) => {
      logger.log('[FRONTEND] Chat message received:', JSON.stringify(message));
      logger.log('[FRONTEND] Current chat history length:', gameStore.chatHistory.length);
      gameStore.addChatMessage(message);
      logger.log('[FRONTEND] After adding, chat history length:', gameStore.chatHistory.length);
    });
  };

  const disconnect = () => {
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
    }
  };

  const createRoom = (playerName: string, settings?: CreateRoomSettings) => {
    if (!globalSocket) return;
    globalSocket.emit('CREATE_ROOM', { playerName, language: locale.value, settings });
  };

  /**
   * Joins a room with duplicate request protection.
   * Uses 5-second timeout to prevent permanent blocking if join fails.
   * @param roomId - 6-character room code
   * @param playerName - Display name for the player
   */
  const joinRoom = (roomId: string, playerName: string) => {
    if (!globalSocket || isJoiningRoom) {
      logger.log('Join room skipped - no socket or already joining');
      return;
    }
    
    isJoiningRoom = true;
    logger.log('Joining room:', roomId, 'as', playerName);
    
    globalSocket.emit('JOIN_ROOM', { roomId, playerName });
    
    // Reset flag after a timeout to prevent permanent blocking
    setTimeout(() => {
      isJoiningRoom = false;
    }, 5000);
  };

  const startGame = (roomId: string) => {
    logger.log('socket.startGame called with roomId:', roomId);
    logger.log('socket exists:', !!globalSocket);
    logger.log('socket connected:', globalSocket?.connected);
    
    if (!globalSocket) {
      logger.log('No socket available');
      return;
    }
    globalSocket.emit('START_GAME', { roomId });
  };

  const revealCard = (roomId: string, traitType: string) => {
    if (!globalSocket) return;
    globalSocket.emit('REVEAL_CARD', { roomId, traitType });
  };

  const endTurn = (roomId: string) => {
    if (!globalSocket) return;
    globalSocket.emit('END_TURN', { roomId });
  };

  const submitVote = (roomId: string, targetId: string) => {
    if (!globalSocket) return;
    globalSocket.emit('SUBMIT_VOTE', { roomId, targetId });
  };

  const leaveRoom = (roomId: string) => {
    if (!globalSocket) return;
    globalSocket.emit('LEAVE_ROOM', { roomId });
  };

  const kickPlayer = (roomId: string, targetId: string) => {
    if (!globalSocket) return;
    globalSocket.emit('KICK_PLAYER', { roomId, targetId });
  };

  const regenerateRoomCode = (roomId: string) => {
    if (!globalSocket) return;
    globalSocket.emit('REGENERATE_ROOM_CODE', { roomId });
  };

  const updateSettings = (roomId: string, settings: UpdateRoomSettings) => {
    if (!globalSocket) return;
    globalSocket.emit('UPDATE_SETTINGS', { roomId, settings });
  };

  const sendChatMessage = (roomId: string, message: string) => {
    if (!globalSocket) return;
    globalSocket.emit('SEND_CHAT_MESSAGE', { roomId, message });
  };

  const toggleReady = (roomId: string) => {
    if (!globalSocket) return;
    globalSocket.emit('TOGGLE_READY', { roomId });
  };

  return {
    connect,
    disconnect,
    createRoom,
    joinRoom,
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

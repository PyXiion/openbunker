import { io, Socket } from 'socket.io-client';
import { useGameStore } from '~/stores/game';
import { useRuntimeConfig } from '#app/nuxt';
import { useI18n, navigateTo } from '#imports';
import type { CreateRoomSettings, UpdateRoomSettings } from '~/types/settings';

// Global socket instance that persists across composable calls
let globalSocket: Socket | null = null;
let isJoiningRoom = false; // Prevent duplicate join requests

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
  const connect = () => {
    if (globalSocket) {
      console.log('Socket already exists, reconnecting...');
      return;
    }

    console.log('Creating new socket connection...');
    globalSocket = io(config.public.wsUrl, {
      autoConnect: true,
      forceNew: true,
      transports: ['websocket']
    });

    globalSocket.on('connect', () => {
      console.log('Socket connected with ID:', globalSocket!.id);
      gameStore.setConnected(true);
      // Don't set playerId here - it will come from server in ROOM_STATE_UPDATE
      
      // If we have persisted room data, attempt to rejoin
      const savedRoom = localStorage.getItem('gameRoom');
      const savedPlayerName = localStorage.getItem('playerName');
      const savedPersistentId = localStorage.getItem('persistentId');
      
      if (savedRoom && savedPlayerName && !isJoiningRoom) {
        try {
          const room = JSON.parse(savedRoom);
          
          // Use saved persistentId if available, otherwise get from store
          const persistentId = savedPersistentId || gameStore.getOrCreatePersistentId();
          
          if (persistentId) {
            console.log('Attempting to rejoin room:', room.roomId, 'with persistentId:', persistentId);
            globalSocket!.emit('JOIN_ROOM', { roomId: room.roomId, playerName: savedPlayerName, persistentId });
          } else {
            console.warn('No persistentId available for reconnection');
          }
        } catch (error) {
          console.error('Failed to parse saved room data:', error);
        }
      }
    });

    globalSocket.on('disconnect', () => {
      console.log('Socket disconnected in composable');
      gameStore.setConnected(false);
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

    globalSocket.on('ROOM_CREATED', (data) => {
      console.log('Room created:', data.roomId);
      // Save persistentId from server response
      if (data.persistentId) {
        gameStore.setPersistentId(data.persistentId);
      }
      // Player ID will be set when ROOM_STATE_UPDATE arrives
      isJoiningRoom = false; // Reset join flag
    });

    globalSocket.on('JOIN_ERROR', (data) => {
      gameStore.setError(data.message);
      isJoiningRoom = false; // Reset join flag on error
      // Clear persisted room state and redirect to home
      gameStore.clearRoomState();
      navigateTo('/');
    });

    globalSocket.on('ERROR', (data) => {
      gameStore.setError(data.message);
    });

    globalSocket.on('PLAYER_EXILED', (data) => {
      console.log('Player exiled:', data.playerId);
    });

    globalSocket.on('PLAYER_LEFT', (data) => {
      console.log('Player left room:', data.playerId, data.playerName);
    });

    globalSocket.on('KICKED', (data) => {
      console.log('You were kicked from room:', data.roomId, data.reason);
      gameStore.setKickedMessage('errors.kicked');
      gameStore.clearRoomState();
      navigateTo('/');
    });

    globalSocket.on('ROOM_CODE_REGENERATED', (data) => {
      console.log('Room code regenerated:', data.oldRoomId, '->', data.newRoomId);
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
          console.error('Failed to update saved room:', error);
        }
      }
    });

    globalSocket.on('CHAT_MESSAGE', (message) => {
      console.log('[FRONTEND] Chat message received:', JSON.stringify(message));
      console.log('[FRONTEND] Current chat history length:', gameStore.chatHistory.length);
      gameStore.addChatMessage(message);
      console.log('[FRONTEND] After adding, chat history length:', gameStore.chatHistory.length);
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
    const persistentId = gameStore.getOrCreatePersistentId();

    globalSocket.emit('CREATE_ROOM', { playerName, persistentId, language: locale.value, settings });
  };

  /**
   * Joins a room with duplicate request protection.
   * Uses 5-second timeout to prevent permanent blocking if join fails.
   * @param roomId - 6-character room code
   * @param playerName - Display name for the player
   */
  const joinRoom = (roomId: string, playerName: string) => {
    if (!globalSocket || isJoiningRoom) {
      console.log('Join room skipped - no socket or already joining');
      return;
    }
    
    // Get persistent ID if available (for rejoining), server will create new one if not
    const persistentId = gameStore.getOrCreatePersistentId();
    
    isJoiningRoom = true;
    console.log('Joining room with persistent ID:', persistentId);
    
    globalSocket.emit('JOIN_ROOM', { roomId, playerName, persistentId });
    
    // Reset flag after a timeout to prevent permanent blocking
    setTimeout(() => {
      isJoiningRoom = false;
    }, 5000);
  };

  const startGame = (roomId: string) => {
    console.log('socket.startGame called with roomId:', roomId);
    console.log('socket exists:', !!globalSocket);
    console.log('socket connected:', globalSocket?.connected);
    
    if (!globalSocket) {
      console.log('No socket available');
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
    sendChatMessage
  };
};

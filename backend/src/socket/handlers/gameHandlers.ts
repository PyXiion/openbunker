import { Server, Socket } from 'socket.io';
import { GameLogic } from '../../game/gameLogic';
import { TraitType } from '../../game/types';
import { requireRoomAccess } from '../../auth/middleware';
import { recordGameHistory } from '../../auth/database';
import { logger } from '../../utils/logger';

/**
 * Game action handlers for Socket.IO events.
 * Handles game flow: start, reveal cards, end turn, vote, toggle ready.
 */
export class GameHandlers {
  constructor(
    private io: Server,
    private gameLogic: GameLogic,
    private broadcastRoomState: (roomId: string) => void,
    private broadcastChatMessage: (roomId: string, message: any) => void
  ) {}

  private get gameNamespace() {
    return this.io.of('/ws/game');
  }

  handleStartGame(socket: Socket, roomId: string): void {
    try {
      const authSocket = requireRoomAccess(socket, roomId);
      
      console.log('handleStartGame called with roomId:', roomId);
      console.log('socket.id:', socket.id);
      
      const room = this.gameLogic.getRoom(roomId);
      console.log('room exists:', !!room);
      console.log('room status:', room?.status);
      
      const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
      if (!room || !player?.isHost) {
        console.log('Failed: Room not found or player not host');
        socket.emit('ERROR', { message: 'Only host can start the game' });
        return;
      }

      const success = this.gameLogic.startGame(roomId);
      console.log('startGame success:', success);
      
      if (!success) {
        console.log('GameLogic.startGame failed');
        socket.emit('ERROR', { message: 'Failed to start game' });
        return;
      }

      console.log('Game started successfully, broadcasting room state');
      
      const eventMessage = this.gameLogic.addLocalizedSystemEvent(
        roomId,
        'GAME_STARTED',
        'events.game_started',
        { round: 1 },
        { round: 1 }
      );
      if (eventMessage) {
        this.broadcastChatMessage(roomId, eventMessage);
      }

      const welcomeTitle = this.gameLogic.getLocalizedMessage(roomId, 'welcome.title');
      const welcomeMessage = this.gameLogic.getLocalizedMessage(roomId, 'welcome.message');
      const fullWelcomeMessage = `${welcomeTitle} ${welcomeMessage}`;
      
      const welcomeChatMessage = this.gameLogic.addSystemEvent(
        roomId,
        'GAME_STARTED',
        fullWelcomeMessage,
        { type: 'welcome' }
      );
      if (welcomeChatMessage) {
        this.broadcastChatMessage(roomId, welcomeChatMessage);
      }

      this.broadcastRoomState(roomId);
    } catch (error) {
      console.error('Start game error:', error);
      socket.emit('ERROR', { message: 'Authentication failed' });
    }
  }

  handleRevealCard(socket: Socket, roomId: string, traitType: string): void {
    console.log(`handleRevealCard called with roomId: ${roomId}, traitType: ${traitType}`);
    
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.id === socket.data.playerId);
    
    if (!room || !player) {
      console.log('Failed: Room not found or player not found');
      socket.emit('ERROR', { message: 'Failed to reveal card' });
      return;
    }
    
    const success = this.gameLogic.revealCard(roomId, player.id, traitType as any);
    
    if (!success) {
      console.log('GameLogic.revealCard failed');
      socket.emit('ERROR', { message: 'Failed to reveal card' });
      return;
    }

    console.log('Card revealed successfully, broadcasting room state');
    
    if (player) {
      const eventMessage = this.gameLogic.addSystemEvent(
        roomId,
        'CARD_REVEALED',
        `${player.name} revealed their ${traitType}`,
        { playerId: player.id, playerName: player.name, traitType }
      );
      if (eventMessage) {
        this.broadcastChatMessage(roomId, eventMessage);
      }
    }

    this.broadcastRoomState(roomId);
  }

  handleEndTurn(socket: Socket, roomId: string): void {
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('ERROR', { message: 'Player not found' });
      return;
    }
    
    const success = this.gameLogic.endTurn(roomId, player.id);
    
    if (!success) {
      socket.emit('ERROR', { message: 'Failed to end turn' });
      return;
    }

    this.broadcastRoomState(roomId);
  }

  handleSubmitVote(socket: Socket, roomId: string, targetId: string): void {
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('ERROR', { message: 'Player not found' });
      return;
    }

    const result = this.gameLogic.submitVote(roomId, player.id, targetId);

    if (!result.success) {
      socket.emit('ERROR', { message: 'Failed to submit vote' });
      return;
    }

    for (const event of result.events) {
      if (event) {
        this.broadcastChatMessage(roomId, event);
      }
    }

    this.broadcastRoomState(roomId);

    if (room && room.status === 'PLAYING') {
      const exiledPlayer = Object.values(room.players).find(p => p.isExiled && p.votesReceived > 0);
      if (exiledPlayer) {
        this.gameNamespace.to(roomId).emit('PLAYER_EXILED', { playerId: exiledPlayer.id });

        const eventMessage = this.gameLogic.addSystemEvent(
          roomId,
          'PLAYER_EXILED',
          `${exiledPlayer.name} has been exiled from the bunker`,
          { playerId: exiledPlayer.id, playerName: exiledPlayer.name, round: room.round }
        );
        if (eventMessage) {
          this.broadcastChatMessage(roomId, eventMessage);
        }
      }
    }

    if (room && room.status === 'FINISHED' && room.gameStartedAt) {
      logger.debug('[GAME_HISTORY] Game finished, recording history for all players');
      const durationMinutes = Math.round((Date.now() - room.gameStartedAt) / 60000);

      for (const player of Object.values(room.players)) {
        logger.debug(`[GAME_HISTORY] Player: ${player.name}, isGuest: ${player.isGuest}, id: ${player.id}`);
        if (!player.isGuest) {
          logger.debug(`[GAME_HISTORY] Recording history for player ${player.id}`);
          recordGameHistory({
            roomId: room.roomId,
            roomCode: room.roomCode,
            profileId: player.id,
            playerName: player.name,
            gameStatus: 'FINISHED',
            wasExiled: player.isExiled,
            survived: !player.isExiled,
            finalRound: room.round,
            playersCount: Object.keys(room.players).length,
            bunkerCapacity: room.bunker?.capacity || 0,
            catastropheId: room.catastrophe?.id,
            durationMinutes,
          }).catch((error) => {
            console.error(`Failed to record game history for player ${player.id}:`, error);
          });
        } else {
          logger.debug(`[GAME_HISTORY] Skipping guest player ${player.id}`);
        }
      }
    } else {
      logger.debug(`[GAME_HISTORY] Not recording - room: ${!!room}, status: ${room?.status}, gameStartedAt: ${!!room?.gameStartedAt}`);
    }
  }

  handleToggleReady(socket: Socket, roomId: string): void {
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);

    if (!room) {
      socket.emit('ERROR', { message: 'Room not found' });
      return;
    }

    if (!player) {
      socket.emit('ERROR', { message: 'Player not found' });
      return;
    }

    player.isReady = !player.isReady;
    console.log(`Player ${player.name} toggled ready status to ${player.isReady}`);

    this.broadcastRoomState(roomId);
  }
}

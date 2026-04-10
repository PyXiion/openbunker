import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameLogic } from '../../game/gameLogic';
import { GameRoom, TraitType } from '../../game/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs');
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

describe('GameLogic', () => {
  let gameLogic: GameLogic;

  beforeEach(() => {
    gameLogic = new GameLogic();
    vi.clearAllMocks();
    
    // Mock file system reads for game data
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    // Mock different return values based on file path
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      const pathStr = String(filePath);
      if (pathStr.includes('data/catastrophes')) {
        return JSON.stringify([{ id: 'c1', title: 'Nuclear War', description: 'Test', duration: 'Permanent' }]);
      } else if (pathStr.includes('data/bunker')) {
        return JSON.stringify([{ id: 'r1', name: 'Medical Bay', description: 'Test' }]);
      } else if (pathStr.includes('data/traits')) {
        return JSON.stringify({
          profession: [{ id: 'p1', name: 'Doctor', description: 'Heals' }],
          biology: [{ id: 'b1', name: 'Young', description: 'Age 25' }],
          hobby: [{ id: 'h1', name: 'Gaming', description: 'Plays games' }],
          phobia: [{ id: 'ph1', name: 'Spiders', description: 'Scary' }],
          baggage: [{ id: 'bg1', name: 'Laptop', description: 'Tech' }],
          fact: [{ id: 'f1', name: 'Left-handed', description: 'Fact' }],
        });
      } else if (pathStr.includes('data/messages')) {
        return JSON.stringify({ test: 'message' });
      }
      return '{}';
    });
  });

  describe('generateRoomCode', () => {
    it('should generate a 6-character room code', () => {
      const roomCode = gameLogic.generateRoomCode();
      expect(roomCode).toHaveLength(6);
      expect(roomCode).toMatch(/^[A-Z0-9]+$/);
    });

    it('should generate unique room codes', () => {
      const code1 = gameLogic.generateRoomCode();
      const code2 = gameLogic.generateRoomCode();
      expect(code1).not.toBe(code2);
    });
  });

  describe('generateRoomId', () => {
    it('should generate a UUID room ID', () => {
      const roomId = gameLogic.generateRoomId();
      expect(roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should generate unique room IDs', () => {
      const id1 = gameLogic.generateRoomId();
      const id2 = gameLogic.generateRoomId();
      expect(id1).not.toBe(id2);
    });
  });


  describe('createRoom', () => {
    it('should create a room with host', async () => {
      const room = await gameLogic.createRoom('user1', 'HostPlayer');
      
      expect(room).toBeTruthy();
      expect(room.status).toBe('LOBBY');
      expect(room.players).toBeDefined();
      expect(Object.keys(room.players)).toHaveLength(1);
      expect(room.turnOrder).toHaveLength(1);
    });

    it('should set host as first player', async () => {
      const room = await gameLogic.createRoom('user1', 'HostPlayer');
      const hostId = room.turnOrder[0];
      const host = room.players[hostId];
      
      expect(host.isHost).toBe(true);
      expect(host.name).toBe('HostPlayer');
      expect(host.socketId).toBe('');
    });


    it('should accept custom settings', async () => {
      const settings = { bunkerCapacity: 5 };
      const room = await gameLogic.createRoom('user1', 'HostPlayer', 'en', settings);
      
      expect(room.settings).toEqual(settings);
    });

    it('should store room in rooms map', async () => {
      const room = await gameLogic.createRoom('user1', 'HostPlayer');
      const retrieved = gameLogic.getRoom(room.roomId);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.roomId).toBe(room.roomId);
    });

    it('should accept avatar URL', async () => {
      const avatarUrl = 'https://example.com/avatar.png';
      const room = await gameLogic.createRoom('user1', 'HostPlayer', 'en', undefined, avatarUrl);
      
      const hostId = room.turnOrder[0];
      expect(room.players[hostId].avatarUrl).toBe(avatarUrl);
    });
  });

  describe('joinRoom', () => {
    let roomId: string;

    beforeEach(async () => {
      const room = await gameLogic.createRoom('user1', 'HostPlayer');
      roomId = room.roomId;
    });

    it('should allow player to join existing room in LOBBY', async () => {
      const result = await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      
      expect(result).toBeTruthy();
      expect(Object.keys(result!.players)).toHaveLength(2);
    });

    it('should return null for non-existent room', async () => {
      const result = await gameLogic.joinRoom('INVALID', 'user2', 'Player2');
      expect(result).toBeNull();
    });

    it('should return null if room is not in LOBBY', async () => {
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      gameLogic.startGame(roomId);
      const result = await gameLogic.joinRoom(roomId, 'user3', 'Player3');
      expect(result).toBeNull();
    });


    it('should accept avatar URL for joining player', async () => {
      const avatarUrl = 'https://example.com/avatar2.png';
      const result = await gameLogic.joinRoom(roomId, 'user2', 'Player2', avatarUrl);
      
      expect(result).toBeTruthy();
      const newPlayerId = Object.keys(result!.players).find(id => result!.players[id].name === 'Player2');
      expect(result!.players[newPlayerId!].avatarUrl).toBe(avatarUrl);
    });
  });

  describe('startGame', () => {
    let roomId: string;

    beforeEach(async () => {
      const room = await gameLogic.createRoom('user1', 'HostPlayer');
      roomId = room.roomId;
    });

    it('should start game with minimum players', async () => {
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      const result = gameLogic.startGame(roomId);
      
      expect(result).toBe(true);
      const room = gameLogic.getRoom(roomId);
      expect(room?.status).toBe('PLAYING');
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.startGame('INVALID');
      expect(result).toBe(false);
    });

    it('should return false if room not in LOBBY', async () => {
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      gameLogic.startGame(roomId);
      const result = gameLogic.startGame(roomId);
      expect(result).toBe(false);
    });

    it('should return false with insufficient players', () => {
      const result = gameLogic.startGame(roomId);
      expect(result).toBe(false);
    });

    it('should initialize catastrophe and bunker', async () => {
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      gameLogic.startGame(roomId);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.catastrophe).toBeTruthy();
      expect(room?.bunker).toBeTruthy();
    });

    it('should deal traits to all players', async () => {
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      gameLogic.startGame(roomId);
      
      const room = gameLogic.getRoom(roomId);
      for (const player of Object.values(room!.players)) {
        expect(player.traits.profession.id).toBeTruthy();
        expect(player.traits.biology.id).toBeTruthy();
        expect(player.traits.hobby.id).toBeTruthy();
      }
    });
  });

  describe('revealCard', () => {
    let roomId: string;
    let playerId: string;

    beforeEach(async () => {
      const room = await gameLogic.createRoom('user1', 'Player1', 'en');
      roomId = room.roomId;
      playerId = 'user1';
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      gameLogic.startGame(roomId);
    });

    it('should reveal card for current player', () => {
      const result = gameLogic.revealCard(roomId, playerId, 'profession');
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.players[playerId].traits.profession.isRevealed).toBe(true);
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.revealCard('INVALID', playerId, 'profession');
      expect(result).toBe(false);
    });

    it('should return false if room not in PLAYING', async () => {
      const room = await gameLogic.createRoom('user3', 'Player3');
      const roomId2 = room.roomId;
      const result = gameLogic.revealCard(roomId2, 'user3', 'profession');
      expect(result).toBe(false);
    });

    it('should return false if not current player turn', () => {
      const result = gameLogic.revealCard(roomId, 'user2', 'profession');
      expect(result).toBe(false);
    });

    it('should return false if card already revealed', () => {
      gameLogic.revealCard(roomId, playerId, 'profession');
      const result = gameLogic.revealCard(roomId, playerId, 'profession');
      expect(result).toBe(false);
    });

    it('should enforce first trait rule when configured', async () => {
      const room = await gameLogic.createRoom('user3', 'Player3', 'en', { firstTraitToReveal: 'profession' as TraitType });
      const roomId2 = room.roomId;
      await gameLogic.joinRoom(roomId2, 'user4', 'Player4');
      gameLogic.startGame(roomId2);
      
      // Try to reveal biology before profession
      const result = gameLogic.revealCard(roomId2, 'user3', 'biology');
      expect(result).toBe(false);
    });
  });

  describe('endTurn', () => {
    let roomId: string;
    let playerId: string;

    beforeEach(async () => {
      const room = await gameLogic.createRoom('user1', 'Player1');
      roomId = room.roomId;
      playerId = 'user1';
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      gameLogic.startGame(roomId);
    });

    it('should end turn for current player', () => {
      const revealResult = gameLogic.revealCard(roomId, playerId, 'profession');
      expect(revealResult).toBe(true);
      
      const result = gameLogic.endTurn(roomId, playerId);
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.currentTurnIndex).toBe(1);
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.endTurn('INVALID', playerId);
      expect(result).toBe(false);
    });

    it('should return false if not current player turn', () => {
      const result = gameLogic.endTurn(roomId, 'user2');
      expect(result).toBe(false);
    });

    it('should return false if first trait not revealed when required', async () => {
      const room = await gameLogic.createRoom('user3', 'Player3', 'en', { firstTraitToReveal: 'profession' as TraitType });
      const roomId2 = room.roomId;
      await gameLogic.joinRoom(roomId2, 'user4', 'Player4');
      gameLogic.startGame(roomId2);
      
      const result = gameLogic.endTurn(roomId2, 'user3');
      expect(result).toBe(false);
    });

    it('should return false if not enough cards revealed', () => {
      const result = gameLogic.endTurn(roomId, playerId);
      expect(result).toBe(false);
    });

    it('should start voting phase when all players have taken turn', () => {
      gameLogic.revealCard(roomId, playerId, 'profession');
      gameLogic.endTurn(roomId, playerId);
      
      gameLogic.revealCard(roomId, 'user2', 'profession');
      gameLogic.endTurn(roomId, 'user2');
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.status).toBe('VOTING');
    });
  });

  describe('submitVote', () => {
    let roomId: string;

    beforeEach(async () => {
      const room = await gameLogic.createRoom('user1', 'Player1');
      roomId = room.roomId;
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
      await gameLogic.joinRoom(roomId, 'user3', 'Player3');
      gameLogic.startGame(roomId);
      
      // Advance to voting phase
      gameLogic.revealCard(roomId, 'user1', 'profession');
      gameLogic.endTurn(roomId, 'user1');
      gameLogic.revealCard(roomId, 'user2', 'profession');
      gameLogic.endTurn(roomId, 'user2');
      gameLogic.revealCard(roomId, 'user3', 'profession');
      gameLogic.endTurn(roomId, 'user3');
    });

    it('should accept vote from active player', () => {
      const result = gameLogic.submitVote(roomId, 'user1', 'user2');
      expect(result.success).toBe(true);
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.submitVote('INVALID', 'user1', 'user2');
      expect(result.success).toBe(false);
    });

    it('should return false if room not in VOTING', async () => {
      const room = await gameLogic.createRoom('user4', 'Player4');
      const roomId2 = room.roomId;
      const result = gameLogic.submitVote(roomId2, 'user4', 'user4');
      expect(result.success).toBe(false);
    });

    it('should return false if player already voted', () => {
      gameLogic.submitVote(roomId, 'user1', 'user2');
      const result = gameLogic.submitVote(roomId, 'user1', 'user3');
      expect(result.success).toBe(false);
    });

    it('should return false if voter is exiled', () => {
      const room = gameLogic.getRoom(roomId);
      if (room) room.players['user1'].isExiled = true;
      
      const result = gameLogic.submitVote(roomId, 'user1', 'user2');
      expect(result.success).toBe(false);
    });

    it('should return false if target is exiled', () => {
      const room = gameLogic.getRoom(roomId);
      if (room) room.players['user2'].isExiled = true;
      
      const result = gameLogic.submitVote(roomId, 'user1', 'user2');
      expect(result.success).toBe(false);
    });

    it('should process voting when all players have voted', () => {
      gameLogic.submitVote(roomId, 'user1', 'user2');
      gameLogic.submitVote(roomId, 'user2', 'user1');
      const result = gameLogic.submitVote(roomId, 'user3', 'user1');
      
      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  describe('removePlayer', () => {
    let roomId: string;

    beforeEach(async () => {
      const room = await gameLogic.createRoom('user1', 'HostPlayer');
      roomId = room.roomId;
      await gameLogic.joinRoom(roomId, 'user2', 'Player2');
    });

    it('should remove player from room', () => {
      const result = gameLogic.removePlayer(roomId, 'user2');
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.players['user2']).toBeUndefined();
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.removePlayer('INVALID', 'user2');
      expect(result).toBe(false);
    });

    it('should transfer host immediately on voluntary leave', () => {
      const result = gameLogic.removePlayer(roomId, 'user1', true);
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.players['user2'].isHost).toBe(true);
    });

    it('should transfer host immediately when host is removed', () => {
      const result = gameLogic.removePlayer(roomId, 'user1', false);
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.players['user2'].isHost).toBe(true);
    });

    it('should delete room when empty', () => {
      gameLogic.removePlayer(roomId, 'user2');
      gameLogic.removePlayer(roomId, 'user1');
      
      const room = gameLogic.getRoom(roomId);
      expect(room).toBeNull();
    });

    it('should adjust turn order when removing current player', () => {
      gameLogic.startGame(roomId);
      const room = gameLogic.getRoom(roomId);
      const originalTurnIndex = room?.currentTurnIndex;
      
      gameLogic.removePlayer(roomId, 'user1');
      const updatedRoom = gameLogic.getRoom(roomId);
      expect(updatedRoom?.currentTurnIndex).toBe(0);
    });
  });

  describe('getMaskedRoom', () => {
    let roomId: string;
    let playerId: string;

    beforeEach(async () => {
      const room = await gameLogic.createRoom('user1', 'Player1');
      roomId = room.roomId;
      playerId = 'user1';
      gameLogic.joinRoom(roomId, 'user2', 'Player2');
      gameLogic.startGame(roomId);
    });

    it('should return masked room for player', () => {
      const masked = gameLogic.getMaskedRoom(roomId, playerId);
      expect(masked).toBeTruthy();
      expect(masked?.roomId).toBe(roomId);
    });

    it('should return null for non-existent room', () => {
      const masked = gameLogic.getMaskedRoom('INVALID', playerId);
      expect(masked).toBeNull();
    });

    it('should hide other players unrevealed traits', () => {
      const masked = gameLogic.getMaskedRoom(roomId, 'user2');
      const p1Traits = masked?.players['user1'].traits;
      
      expect(p1Traits?.profession.name).toBe('???');
      expect(p1Traits?.profession.description).toBe('This card has not been revealed yet.');
    });

    it('should show own unrevealed traits', () => {
      const masked = gameLogic.getMaskedRoom(roomId, 'user1');
      const p1Traits = masked?.players['user1'].traits;
      
      expect(p1Traits?.profession.name).not.toBe('???');
    });

    it('should reveal all cards when game finished', () => {
      const room = gameLogic.getRoom(roomId);
      if (room) {
        room.status = 'FINISHED';
        room.bunker!.capacity = 10;
      }
      
      const masked = gameLogic.getMaskedRoom(roomId, 'user2');
      const p1Traits = masked?.players['user1'].traits;
      
      expect(p1Traits?.profession.name).not.toBe('???');
    });
  });

  describe('getRoom', () => {
    it('should return room by ID', async () => {
      const room = await gameLogic.createRoom('user1', 'Player1');
      const retrieved = gameLogic.getRoom(room.roomId);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.roomId).toBe(room.roomId);
    });

    it('should return null for non-existent room', () => {
      const retrieved = gameLogic.getRoom('INVALID');
      expect(retrieved).toBeNull();
    });
  });

  describe('regenerateRoomCode', () => {
    it('should regenerate room code', async () => {
      const room = await gameLogic.createRoom('user1', 'Player1');
      const oldCode = room.roomCode;
      const newCode = gameLogic.regenerateRoomCode(room.roomId);
      
      expect(newCode).toBeTruthy();
      expect(newCode).not.toBe(oldCode);
    });

    it('should return null for non-existent room', () => {
      const newCode = gameLogic.regenerateRoomCode('INVALID');
      expect(newCode).toBeNull();
    });

    it('should keep roomId the same when regenerating roomCode', async () => {
      const room = await gameLogic.createRoom('user1', 'Player1');
      const oldRoomId = room.roomId;
      gameLogic.regenerateRoomCode(room.roomId);
      
      const updatedRoom = gameLogic.getRoom(oldRoomId);
      expect(updatedRoom).toBeTruthy();
      expect(updatedRoom?.roomId).toBe(oldRoomId);
    });
  });

  describe('Chat functionality', () => {
    let roomId: string;

    beforeEach(async () => {
      const room = await gameLogic.createRoom('user1', 'Player1');
      roomId = room.roomId;
    });

    it('should add chat message', () => {
      const message = gameLogic.addChatMessage(roomId, 'socket1', 'Player1', 'Hello');
      expect(message).toBeTruthy();
      expect(message?.message).toBe('Hello');
    });

    it('should return null for non-existent room', () => {
      const message = gameLogic.addChatMessage('INVALID', 'socket1', 'Player1', 'Hello');
      expect(message).toBeNull();
    });

    it('should limit chat history to 100 messages', () => {
      for (let i = 0; i < 150; i++) {
        gameLogic.addChatMessage(roomId, 'socket1', 'Player1', `Message ${i}`);
      }
      
      const history = gameLogic.getChatHistory(roomId);
      expect(history.length).toBe(100);
    });

    it('should add system event', () => {
      const event = gameLogic.addSystemEvent(roomId, 'PLAYER_JOIN', 'Test message');
      expect(event).toBeTruthy();
      expect(event?.type).toBe('EVENT');
      expect(event?.eventType).toBe('PLAYER_JOIN');
    });

    it('should get chat history', () => {
      gameLogic.addChatMessage(roomId, 'socket1', 'Player1', 'Message 1');
      gameLogic.addChatMessage(roomId, 'socket1', 'Player1', 'Message 2');
      
      const history = gameLogic.getChatHistory(roomId);
      expect(history.length).toBe(2);
    });

    it('should return empty array for non-existent room', () => {
      const history = gameLogic.getChatHistory('INVALID');
      expect(history).toEqual([]);
    });
  });
});

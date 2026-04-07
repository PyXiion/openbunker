import { v4 as uuidv4 } from 'uuid';
import { GameRoom, Player, Trait, TraitType, GameStatus, BunkerStats, BunkerRoom, CatastropheCard, ChatMessage, ChatEventType } from './types';
import { GameSettings } from '../types';
import { GAME_CONSTANTS, BUNKER_RESOURCES } from './constants';
import * as fs from 'fs';
import * as path from 'path';

// Data loader function to support multiple languages
function loadData<T>(dataType: 'catastrophes' | 'traits' | 'bunker', language: string = 'en'): T {
  const filePath = path.join(__dirname, 'data', `${dataType}-${language}.json`);
  
  // Fallback to English if requested language file doesn't exist
  if (!fs.existsSync(filePath)) {
    const fallbackPath = path.join(__dirname, 'data', `${dataType}-en.json`);
    return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
  }
  
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getCatastrophes(language: string = 'en'): CatastropheCard[] {
  return loadData<CatastropheCard[]>('catastrophes', language);
}

function getBunkerRooms(language: string = 'en'): BunkerRoom[] {
  return loadData<BunkerRoom[]>('bunker', language);
}

function getTraits(language: string = 'en'): Record<TraitType, Array<{id: string; name: string; description: string}>> {
  return loadData<Record<TraitType, Array<{id: string; name: string; description: string}>>>('traits', language);
}

export class GameLogic {
  private rooms: Map<string, GameRoom> = new Map();

  /**
   * Generates a random 6-character uppercase room ID.
   * Uses base36 encoding of a random number for readability.
   */
  generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  generatePersistentId(): string {
    return uuidv4();
  }

  /**
   * Creates a new game room with the specified host.
   * Initializes room in LOBBY state with default settings.
   * 
   * @param hostSocketId - Socket ID of the creating player
   * @param hostName - Display name of the host
   * @param hostPersistentId - Optional existing persistent ID for rejoining
   * @param language - Game language for card data
   * @param settings - Optional lobby settings (bunker capacity, etc.)
   * @returns The newly created GameRoom
   */
  createRoom(hostSocketId: string, hostName: string, hostPersistentId?: string, language: string = 'en', settings?: GameSettings): GameRoom {
    const roomId = this.generateRoomId();
    console.log(`Creating room ${roomId} for host ${hostName} with language ${language}`);
    
    const room: GameRoom = {
      roomId,
      status: 'LOBBY',
      round: 1,
      catastrophe: null,
      bunker: null,
      players: {},
      turnOrder: [],
      currentTurnIndex: 0,
      cardsToRevealPerTurn: 1,
      cardsRevealedThisTurn: 0,
      language,
      settings: settings || { bunkerCapacity: null },
      chatHistory: []
    };

    const host = this.createPlayer(hostSocketId, hostName, true, hostPersistentId);
    room.players[host.id] = host;
    room.turnOrder.push(host.id);

    this.rooms.set(roomId, room);
    console.log(`Room ${roomId} created and stored. Total rooms: ${this.rooms.size}`);
    return room;
  }

  createPlayer(socketId: string, playerName: string, isHost: boolean = false, persistentId?: string): Player {
    const id = persistentId || this.generatePersistentId();
    return {
      id,
      socketId,
      name: playerName,
      isHost,
      isExiled: false,
      traits: {
        profession: { id: '', name: '', description: '', isRevealed: false },
        biology: { id: '', name: '', description: '', isRevealed: false },
        hobby: { id: '', name: '', description: '', isRevealed: false },
        phobia: { id: '', name: '', description: '', isRevealed: false },
        baggage: { id: '', name: '', description: '', isRevealed: false },
        fact: { id: '', name: '', description: '', isRevealed: false },
      },
      votesReceived: 0,
      hasVoted: false,
    };
  }

  /**
   * Allows a player to join an existing room.
   * Handles reconnection if player already exists (same persistentId).
   * Only allows new players to join during LOBBY phase.
   * 
   * @param roomId - 6-character room code
   * @param socketId - Current socket connection ID
   * @param playerName - Display name for the player
   * @param persistentId - Optional persistent ID for reconnection
   * @returns Updated GameRoom or null if join failed
   */
  joinRoom(roomId: string, socketId: string, playerName: string, persistentId?: string): GameRoom | null {
    const id = persistentId || this.generatePersistentId();
    console.log(`GameLogic.joinRoom called with roomId: ${roomId}, socketId: ${socketId}, playerName: ${playerName}, id: ${id}`);
    
    const room = this.rooms.get(roomId);
    console.log(`Room found: ${!!room}, status: ${room?.status}`);
    
    if (!room) {
      return null;
    }

    // Check if player is already in the room with same ID (duplicate request)
    if (room.players[id]) {
      console.log(`Player ${id} already in room ${roomId}, updating socket ID`);
      room.players[id].socketId = socketId;
      return room;
    }

    // Check if player is reconnecting (already exists in room with same name/persistentId logic)
    // For now, treat as new player if ID doesn't match
    const existingPlayer = Object.values(room.players).find(p => p.socketId === socketId);
    
    if (existingPlayer) {
      // Player is reconnecting with same socket, just update
      console.log(`Player ${playerName} is reconnecting with socket ${socketId}`);
      existingPlayer.socketId = socketId;
      return room;
    }

    // New player joining
    if (room.status !== 'LOBBY') {
      return null;
    }

    if (Object.keys(room.players).length >= GAME_CONSTANTS.MAX_PLAYERS) {
      return null;
    }

    const player = this.createPlayer(socketId, playerName, false, id);
    room.players[id] = player;
    room.turnOrder.push(id);

    console.log(`New player ${playerName} joined room ${roomId}. Room now has ${Object.keys(room.players).length} players`);

    this.addSystemEvent(room.roomId, 'PLAYER_JOIN', `${playerName} joined the room`, { playerId: id, playerName });
    return room;
  }

  /**
   * Starts the game from LOBBY phase.
   * Initializes catastrophe, bunker stats, and deals trait cards.
   * Requires minimum 2 players.
   * 
   * @param roomId - Room to start game in
   * @returns True if game started successfully
   */
  startGame(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'LOBBY') {
      return false;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount < GAME_CONSTANTS.MIN_PLAYERS_TO_START) {
      return false;
    }

    // Initialize game
    room.status = 'PLAYING';
    room.catastrophe = this.getRandomCatastrophe(room.language || 'en');
    room.bunker = this.generateBunkerStats(playerCount, room.language || 'en', room.settings?.bunkerCapacity);
    room.currentTurnIndex = 0;

    // Deal traits to players
    this.dealTraits(room);

    this.rooms.set(roomId, room);
    return true;
  }

  private getRandomCatastrophe(language: string = 'en'): CatastropheCard {
    const catastrophes = getCatastrophes(language);
    return catastrophes[Math.floor(Math.random() * catastrophes.length)];
  }

  /**
   * Generates bunker capacity based on player count (60% of players, min 2).
   * Calculates resources needed and selects random rooms for each round.
   * First room is immediately revealed, others hidden until their round.
   * 
   * @param playerCount - Number of players in the game
   * @param language - Language for room names/descriptions
   * @param customCapacity - Optional custom bunker capacity (null = auto)
   * @returns BunkerStats with calculated capacity and resources
   */
  private generateBunkerStats(playerCount: number, language: string = 'en', customCapacity?: number | null): BunkerStats {
    const capacity = customCapacity !== undefined && customCapacity !== null 
      ? customCapacity 
      : Math.max(2, Math.floor(playerCount * GAME_CONSTANTS.DEFAULT_BUNKER_CAPACITY_RATIO));
    const rounds = Math.max(1, playerCount - capacity);
    const allRooms = getBunkerRooms(language);
    
    // Randomly select rooms equal to number of rounds
    const shuffled = [...allRooms].sort(() => Math.random() - 0.5);
    const selectedRooms = shuffled.slice(0, Math.min(rounds, allRooms.length));
    
    // Initialize all rooms as hidden, first one will be revealed on round 1
    const roomsWithRevealState = selectedRooms.map((room, index) => ({
      ...room,
      isRevealed: index === 0 // First room revealed on round 1
    }));
    
    return {
      capacity,
      food: capacity * BUNKER_RESOURCES.FOOD_PER_PERSON,
      water: capacity * BUNKER_RESOURCES.WATER_PER_PERSON,
      medicine: capacity * BUNKER_RESOURCES.MEDICINE_PER_PERSON,
      power: BUNKER_RESOURCES.DEFAULT_POWER,
      rooms: roomsWithRevealState
    };
  }

  private dealTraits(room: GameRoom): void {
    const traitTypes: TraitType[] = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'];
    const traitsData = getTraits(room.language || 'en');
    
    for (const playerId of Object.keys(room.players)) {
      const player = room.players[playerId];
      
      for (const traitType of traitTypes) {
        const traitPool = traitsData[traitType];
        const randomTrait = traitPool[Math.floor(Math.random() * traitPool.length)];
        
        player.traits[traitType] = {
          id: randomTrait.id,
          name: randomTrait.name,
          description: randomTrait.description,
          isRevealed: false
        };
      }
    }
  }

  private getFirstTraitToReveal(room: GameRoom): TraitType {
    return room.settings?.firstTraitToReveal || 'profession';
  }

  /**
   * Reveals a trait card for the current player during their turn.
   * Enforces game rules: must be current turn, card not already revealed,
   * and profession must be revealed before other traits.
   * 
   * @param roomId - Room where the game is in progress
   * @param playerId - Persistent ID of the player revealing
   * @param traitType - Type of trait card to reveal
   * @returns True if card was successfully revealed
   */
  revealCard(roomId: string, playerId: string, traitType: TraitType): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'PLAYING') {
      return false;
    }

    const currentPlayer = room.turnOrder[room.currentTurnIndex];
    if (currentPlayer !== playerId) {
      return false;
    }

    // Check if player has already revealed max allowed cards this turn
    if (room.cardsRevealedThisTurn >= room.cardsToRevealPerTurn) {
      return false;
    }

    const player = room.players[playerId];
    if (!player || player.traits[traitType].isRevealed) {
      return false;
    }

    // First trait must be revealed before any other cards
    // If a specific first trait is configured, it must be revealed before any other cards
    const firstTrait = this.getFirstTraitToReveal(room);
    if (firstTrait && traitType !== firstTrait && !player.traits[firstTrait].isRevealed) {
      return false;
    }

    player.traits[traitType].isRevealed = true;
    room.cardsRevealedThisTurn++;
    return true;
  }

  /**
   * Ends the current player's turn and advances to next non-exiled player.
   * Validates that profession was revealed and minimum cards were shown.
   * Triggers voting phase when all players have taken their turn.
   * 
   * @param roomId - Room where the game is in progress
   * @param playerId - Persistent ID of the player ending turn
   * @returns True if turn was successfully ended
   */
  endTurn(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'PLAYING') return false;

    // Check if it's this player's turn
    const currentPlayer = room.turnOrder[room.currentTurnIndex];
    if (currentPlayer !== playerId) return false;

    const player = room.players[playerId];
    const firstTrait = this.getFirstTraitToReveal(room);
    
    // If a specific first trait is configured, it must be revealed first
    if (firstTrait && !player.traits[firstTrait].isRevealed) {
      return false; // Must reveal first trait before ending turn
    }
    
    // Get all traits that can be revealed (all traits except the configured first one, if any)
    const allTraitTypes: TraitType[] = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'];
    const otherTraits = firstTrait 
      ? allTraitTypes.filter(t => t !== firstTrait) as TraitType[]
      : allTraitTypes;
    const unrevealedCards = otherTraits.filter(type => !player.traits[type].isRevealed).length;
    
    // Player must reveal N cards per turn total
    // If a first trait is configured, it counts as the first one, so (N-1) more needed
    // If no first trait is configured, any N cards can be revealed
    const firstTraitRevealed = firstTrait ? 1 : 0;
    const additionalRevealsRequired = Math.max(0, room.cardsToRevealPerTurn - firstTraitRevealed);
    const additionalRevealsMade = room.cardsRevealedThisTurn - firstTraitRevealed;
    const remainingCards = Math.min(additionalRevealsRequired, unrevealedCards);
    
    if (additionalRevealsMade < remainingCards) {
      return false; // Not enough additional cards revealed
    }

    // Reset cards revealed counter for next turn
    room.cardsRevealedThisTurn = 0;

    // Find next non-exiled player
    let nextIndex = room.currentTurnIndex;
    do {
      nextIndex = (nextIndex + 1) % room.turnOrder.length;
    } while (room.players[room.turnOrder[nextIndex]].isExiled && nextIndex !== room.currentTurnIndex);

    room.currentTurnIndex = nextIndex;

    if (room.currentTurnIndex === 0) {
      this.startVotingPhase(room);
    }
    return true;
  }

  private startVotingPhase(room: GameRoom): void {
    room.status = 'VOTING';
    
    // Reset voting state
    for (const player of Object.values(room.players)) {
      if (!player.isExiled) {
        player.hasVoted = false;
        player.votesReceived = 0;
      }
    }
  }

  /**
   * Processes a vote submission during VOTING phase.
   * Automatically triggers vote resolution when all active players have voted.
   * Each player can only vote once per voting phase.
   * 
   * @param roomId - Room in VOTING phase
   * @param voterId - Persistent ID of the voting player
   * @param targetId - Persistent ID of the player being voted for
   * @returns Object with success flag and any events that were created
   */
  submitVote(roomId: string, voterId: string, targetId: string): { success: boolean; events: ChatMessage[] } {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'VOTING') {
      return { success: false, events: [] };
    }

    const voter = room.players[voterId];
    const target = room.players[targetId];

    if (!voter || !target || voter.hasVoted || voter.isExiled || target.isExiled) {
      return { success: false, events: [] };
    }

    voter.hasVoted = true;
    target.votesReceived++;

    // Check if all active players have voted
    const activePlayers = Object.values(room.players).filter(p => !p.isExiled);
    const allVoted = activePlayers.every(p => p.hasVoted);

    let events: ChatMessage[] = [];
    if (allVoted) {
      events = this.processVotingResults(room);
    }

    return { success: true, events };
  }

  /**
   * Resolves voting by exiling the player with most votes.
   * If tied, first player with max votes is exiled (deterministic).
   * Checks win condition: if survivors <= capacity, game ends and all cards revealed.
   * Otherwise, starts new round and reveals next bunker room.
   * 
   * @param room - GameRoom in VOTING phase (will be modified)
   * @returns Array of ChatMessage events that were created
   */
  private processVotingResults(room: GameRoom): ChatMessage[] {
    const events: ChatMessage[] = [];
    const activePlayers = Object.values(room.players).filter(p => !p.isExiled);
    
    if (activePlayers.length === 0) return events;

    // Find player with most votes
    let maxVotes = 0;
    let exiledPlayer: Player | null = null;

    for (const player of activePlayers) {
      if (player.votesReceived > maxVotes) {
        maxVotes = player.votesReceived;
        exiledPlayer = player;
      }
    }

    // Exile the player with most votes
    if (exiledPlayer && maxVotes > 0) {
      exiledPlayer.isExiled = true;
    }

    // Check win condition
    const remainingPlayers = Object.values(room.players).filter(p => !p.isExiled);
    
    if (remainingPlayers.length <= room.bunker!.capacity) {
      room.status = 'FINISHED';
      // Reveal all cards
      this.revealAllCards(room);
      
      // Log game finished event
      const event = this.addSystemEvent(
        room.roomId,
        'GAME_FINISHED',
        `Game over! ${remainingPlayers.length} survivors remain in the bunker.`,
        { 
          survivors: remainingPlayers.map(p => ({ id: p.id, name: p.name })),
          bunkerCapacity: room.bunker!.capacity 
        }
      );
      if (event) events.push(event);
    } else {
      // Start new round - reveal next room
      room.round++;
      room.status = 'PLAYING';
      
      // Find first non-exiled player for the new round
      let startIndex = 0;
      while (startIndex < room.turnOrder.length && room.players[room.turnOrder[startIndex]].isExiled) {
        startIndex++;
      }
      room.currentTurnIndex = startIndex >= room.turnOrder.length ? 0 : startIndex;
      
      // Log round started event
      const roundEvent = this.addSystemEvent(
        room.roomId,
        'ROUND_STARTED',
        `Round ${room.round} has started`,
        { round: room.round, remainingPlayers: remainingPlayers.length }
      );
      if (roundEvent) events.push(roundEvent);
      
      // Reveal the next bunker room (index = round - 1 since round starts at 1)
      if (room.bunker && room.bunker.rooms[room.round - 1]) {
        room.bunker.rooms[room.round - 1].isRevealed = true;
        
        // Log bunker room revealed event
        const revealedRoom = room.bunker.rooms[room.round - 1];
        const roomEvent = this.addSystemEvent(
          room.roomId,
          'BUNKER_ROOM_REVEALED',
          `New bunker room revealed: ${revealedRoom.name}`,
          { roomName: revealedRoom.name, round: room.round }
        );
        if (roomEvent) events.push(roomEvent);
      }
    }
    
    return events;
  }

  private revealAllCards(room: GameRoom): void {
    for (const player of Object.values(room.players)) {
      for (const traitType of Object.keys(player.traits) as TraitType[]) {
        player.traits[traitType].isRevealed = true;
      }
    }
  }

  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId) || null;
  }

  regenerateRoomId(oldRoomId: string): string | null {
    const room = this.rooms.get(oldRoomId);
    if (!room) {
      return null;
    }

    // Generate a new room ID that doesn't conflict with existing rooms
    let newRoomId: string;
    let attempts = 0;
    do {
      newRoomId = this.generateRoomId();
      attempts++;
    } while (this.rooms.has(newRoomId) && attempts < 10);

    if (this.rooms.has(newRoomId)) {
      return null; // Could not generate unique ID
    }

    // Update the room ID
    room.roomId = newRoomId;

    // Transfer the room to the new key
    this.rooms.set(newRoomId, room);
    this.rooms.delete(oldRoomId);

    console.log(`Room ID regenerated from ${oldRoomId} to ${newRoomId}`);
    return newRoomId;
  }

  /**
   * Removes a player from a room.
   * Handles host transfer: immediate transfer for voluntary leave,
   * 30-second TTL for disconnections (allows reconnection to reclaim host).
   * Deletes room if it becomes empty.
   * 
   * @param roomId - Room to remove player from
   * @param playerId - Persistent ID of player to remove
   * @param immediateHostTransfer - True for voluntary leave, false for disconnect
   * @returns True if player was successfully removed
   */
  removePlayer(roomId: string, playerId: string, immediateHostTransfer: boolean = false): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const player = room.players[playerId];
    if (!player) {
      console.log(`Player ${playerId} not found in room ${roomId}, may have been already removed`);
      return false;
    }

    console.log(`Removing player ${player.name} (${playerId}) from room ${roomId}`);
    delete room.players[playerId];
    room.turnOrder = room.turnOrder.filter(id => id !== playerId);

    // If host leaves, handle host ownership transfer
    if (player.isHost && room.turnOrder.length > 0) {
      if (immediateHostTransfer) {
        // Immediate transfer for voluntary leave ("Leave room" button)
        console.log(`Host ${player.name} voluntarily left room ${roomId}, transferring host immediately`);
        const newHostId = room.turnOrder[0];
        room.players[newHostId].isHost = true;
        console.log(`New host assigned immediately: ${room.players[newHostId].name}`);
      } else {
        // Set TTL for disconnections (host disconnect, might reconnect)
        console.log(`Host ${player.name} disconnected from room ${roomId}, setting 30-second TTL for host ownership`);
        room.hostOwnershipExpiry = Date.now() + 30000; // 30 seconds from now
      }
    } else if (room.turnOrder.length > 0) {
      // Non-host player left, regular cleanup
      const newHostId = room.turnOrder[0];
      room.players[newHostId].isHost = true;
    } else {
      // Delete room if empty
      console.log(`Room ${roomId} is now empty, deleting room`);
      this.rooms.delete(roomId);
    }

    return true;
  }

  /**
   * Checks if host ownership TTL has expired and transfers host if needed.
   * Called when players join/reconnect to ensure timely host transfer.
   * 
   * @param roomId - Room to check
   * @returns True if host was transferred due to expired TTL
   */
  checkHostOwnershipTTL(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || !room.hostOwnershipExpiry) {
      return false;
    }

    if (Date.now() > room.hostOwnershipExpiry) {
      // TTL expired, transfer host ownership to next player
      console.log(`Host ownership TTL expired for room ${roomId}, transferring host to next player`);
      
      const currentHost = Object.values(room.players).find(p => p.isHost);
      if (currentHost) {
        currentHost.isHost = false;
      }

      if (room.turnOrder.length > 0) {
        const newHostId = room.turnOrder[0];
        room.players[newHostId].isHost = true;
        console.log(`New host assigned: ${room.players[newHostId].name}`);
      }

      room.hostOwnershipExpiry = undefined;
      return true;
    }

    return false;
  }

  /**
   * Returns a masked view of the room for a specific player.
   * Hides unrevealed trait cards (showing '???') and unrevealed bunker rooms.
   * During FINISHED state, all cards are visible to everyone.
   * Uses deep cloning to prevent accidental mutation of master state.
   * 
   * @param roomId - Room to get masked view of
   * @param playerId - Persistent ID of the requesting player
   * @returns Masked room state or null if room not found
   */
  getMaskedRoom(roomId: string, playerId: string): any {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // 1. Deep clone the room structure so we don't mutate the master state
    // Using JSON parse/stringify is a quick way to deep clone plain objects
    const maskedRoom = JSON.parse(JSON.stringify(room));
    
    // 2. Clear the players list so we can rebuild it with masked data
    maskedRoom.players = {};

    for (const [id, player] of Object.entries(room.players)) {
      // If game is over, or it's the player's own profile, don't mask
      if (room.status === 'FINISHED' || id === playerId) {
        maskedRoom.players[id] = JSON.parse(JSON.stringify(player));
        continue;
      }

      // 3. Mask other players' traits
      const maskedPlayer = JSON.parse(JSON.stringify(player));
      const traitTypes: TraitType[] = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'];

      for (const traitType of traitTypes) {
        const trait = maskedPlayer.traits[traitType];
        
        // If the card hasn't been revealed to the group yet, hide the details
        if (!trait.isRevealed) {
          maskedPlayer.traits[traitType] = {
            ...trait,
            name: '???',
            description: 'This card has not been revealed yet.'
          };
        }
      }

      maskedRoom.players[id] = maskedPlayer;
    }

    // 4. Mask hidden bunker rooms
    if (maskedRoom.bunker?.rooms) {
      maskedRoom.bunker.rooms = maskedRoom.bunker.rooms.map((room: any) => {
        if (!room.isRevealed) {
          return {
            ...room,
            name: '???',
            description: 'This room has not been revealed yet.'
          };
        }
        return room;
      });
    }

    // Include host ownership expiry in masked data
    maskedRoom.hostOwnershipExpiry = room.hostOwnershipExpiry;

    return maskedRoom;
  }

  /**
   * Adds a chat message to the room's chat history.
   * Limits chat history to the most recent 100 messages.
   */
  addChatMessage(
    roomId: string,
    playerId: string,
    playerName: string,
    message: string,
    type: 'CHAT' | 'SYSTEM' | 'EVENT' = 'CHAT',
    eventType?: ChatEventType,
    eventData?: Record<string, any>
  ): ChatMessage | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const chatMessage: ChatMessage = {
      id: uuidv4(),
      playerId,
      playerName,
      message,
      timestamp: Date.now(),
      type,
      eventType,
      eventData
    };

    room.chatHistory.push(chatMessage);

    // Keep only the last 100 messages
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }

    return chatMessage;
  }

  /**
   * Adds a system event message to the chat history.
   */
  addSystemEvent(
    roomId: string,
    eventType: ChatEventType,
    message: string,
    eventData?: Record<string, any>
  ): ChatMessage | null {
    return this.addChatMessage(
      roomId,
      'system',
      'System',
      message,
      'EVENT',
      eventType,
      eventData
    );
  }

  /**
   * Gets the chat history for a room.
   */
  getChatHistory(roomId: string): ChatMessage[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.chatHistory;
  }
}

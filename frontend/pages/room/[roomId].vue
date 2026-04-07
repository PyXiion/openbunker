<template>
  <div class="min-h-screen bg-base text-contrast p-4">
    <div v-if="!gameStore.room" class="text-center">
      <p>{{ $t('pages.room.loading') }}</p>
    </div>

    <div v-else class="max-w-7xl mx-auto">
      <RoomHeader @leave="confirmLeaveRoom" />

      <GameLobby 
        v-if="gameStore.room.status === 'LOBBY'" 
        @start="startGame"
      />

      <GamePlaying 
        v-else-if="gameStore.room.status === 'PLAYING'"
        @reveal="revealCard"
        @end-turn="endTurn"
      />

      <GameVoting 
        v-else-if="gameStore.room.status === 'VOTING'"
        :active-players="gameStore.activePlayers"
        :current-player-id="gameStore.playerId"
        :has-voted="gameStore.currentPlayer?.hasVoted || false"
        @vote="submitVote"
      />

      <GameFinished 
        v-else-if="gameStore.room.status === 'FINISHED'"
        :players="gameStore.room.players"
      />

      <!-- Chat Box -->
      <ChatBox 
        v-if="gameStore.room" 
        :room-id="gameStore.room.roomId" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const gameStore = useGameStore();
const socket = useSocket();

// Load persisted state and handle rejoin
onMounted(async () => {
  // Note: loadPersistedState() is already called in app.vue on startup
  // Don't call it again here to avoid resetting playerId
  
  // Connect socket if not already connected
  if (!gameStore.connected) {
    socket.connect();
  }
  
  // Wait for connection to be established
  const waitForConnection = () => {
    return new Promise<void>((resolve) => {
      if (gameStore.connected) {
        resolve();
        return;
      }
      
      const checkConnection = setInterval(() => {
        if (gameStore.connected) {
          clearInterval(checkConnection);
          resolve();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkConnection);
        resolve();
      }, 5000);
    });
  };
  
  await waitForConnection();
  
  // Check if we need to rejoin a room
  const currentRoomId = route.params.roomId as string;
  
  if (gameStore.room?.roomId === currentRoomId) {
    // We have the room state but need to rejoin the socket room
    if (gameStore.playerName) {
      const persistentId = gameStore.getOrCreatePersistentId();
      socket.joinRoom(currentRoomId, gameStore.playerName);
    }
  } else if (!gameStore.room || gameStore.room.roomId !== currentRoomId) {
    // No room state or different room, redirect to home
    navigateTo('/');
  }
});

const startGame = () => {
  if (gameStore.room) {
    socket.startGame(gameStore.room.roomId);
  }
};

const revealCard = (traitType: string) => {
  if (!gameStore.isMyTurn || !gameStore.canRevealCard) return;
  if (gameStore.currentPlayer?.traits[traitType as keyof typeof gameStore.currentPlayer.traits]?.isRevealed) return;
  
  // If a specific first trait is configured, it must be revealed first
  const firstTrait = gameStore.room?.settings?.firstTraitToReveal;
  if (firstTrait && traitType !== firstTrait && gameStore.mustRevealFirstTrait) return;
  
  if (gameStore.room) {
    socket.revealCard(gameStore.room.roomId, traitType);
  }
};

const endTurn = () => {
  if (!gameStore.isMyTurn) return;
  
  if (gameStore.room) {
    socket.endTurn(gameStore.room.roomId);
  }
};

const submitVote = (targetId: string) => {
  if (gameStore.currentPlayer?.hasVoted) return;
  
  if (gameStore.room) {
    socket.submitVote(gameStore.room.roomId, targetId);
  }
};

const confirmLeaveRoom = () => {
  // Show confirmation only if game is actively playing or voting
  if (gameStore.room?.status === 'PLAYING' || gameStore.room?.status === 'VOTING') {
    if (confirm($t('pages.room.leaveConfirm'))) {
      leaveRoom();
    }
  } else {
    leaveRoom();
  }
};

const leaveRoom = () => {
  // Emit leave room event to backend
  if (gameStore.room) {
    socket.leaveRoom(gameStore.room.roomId);
  }
  
  // Clear room state
  gameStore.clearRoomState();
  navigateTo('/');
};
</script>

<template>
  <div class="tech-grid grid-cols-3 gap-4">
    <!-- Center Panel -->
    <div class="col-span-2 space-y-4">
      <CatastropheCard :catastrophe="gameStore.room?.catastrophe || null" />
      
      <BunkerStats 
        :bunker="gameStore.room?.bunker || null" 
        :active-player-count="gameStore.activePlayers.length"
      />
      
      <PlayersTable 
        :players="gameStore.room?.players || {}"
        :current-turn-index="gameStore.room?.currentTurnIndex || 0"
        :turn-order="gameStore.room?.turnOrder || []"
        :current-player-id="gameStore.playerId"
      />
    </div>

    <!-- Right Panel -->
    <div class="space-y-4">
      <PlayerHand 
        :player="gameStore.currentPlayer"
        @reveal="$emit('reveal', $event)"
      />
      
      <TurnActions
        :is-my-turn="gameStore.isMyTurn"
        :can-end-turn="gameStore.canEndTurn"
        :can-reveal-card="gameStore.canRevealCard"
        :must-reveal-first-trait="gameStore.mustRevealFirstTrait"
        :cards-remaining-to-reveal="gameStore.cardsRemainingToReveal"
        @end-turn="$emit('end-turn')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const gameStore = useGameStore();

defineEmits<{
  reveal: [type: string];
  'end-turn': [];
}>();
</script>

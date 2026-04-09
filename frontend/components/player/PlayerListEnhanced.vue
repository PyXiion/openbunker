<template>
  <div class="mb-5">
    <div class="flex justify-between items-center mb-3">
      <h3 class="font-bold uppercase text-contrast/90">
        {{ $t('components.gameLobby.players') }}
      </h3>
      <span class="font-mono text-sm text-accent">
        {{ playerCount }}/{{ maxPlayers }}
      </span>
    </div>
    
    <div class="player-grid">
      <PlayerCard
        v-for="player in players"
        :key="player.id"
        :player="player"
        :is-current-user-host="isCurrentUserHost"
        @kick="$emit('kick', player.id)"
        @toggle-ready="$emit('toggleReady', player.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import PlayerCard from './PlayerCard.vue';

interface Player {
  id: string;
  name: string;
  avatarUrl?: string;
  isHost: boolean;
  isReady: boolean;
}

defineProps<{
  players: Player[];
  playerCount: number;
  maxPlayers: number;
  isCurrentUserHost: boolean;
}>();

defineEmits<{
  kick: [playerId: string];
  toggleReady: [playerId: string];
}>();
</script>

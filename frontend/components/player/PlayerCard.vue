<template>
  <div class="tech-card player-card p-4">
    <div class="flex items-start gap-3">
      <!-- Avatar -->
      <div class="player-card-avatar border-2 border-contrast flex items-center justify-center overflow-hidden bg-base flex-shrink-0">
        <img 
          v-if="player.avatarUrl" 
          :src="player.avatarUrl" 
          :alt="player.name"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full bg-contrast/10 flex items-center justify-center">
          <span class="text-contrast font-bold text-sm">
            {{ player.name.charAt(0).toUpperCase() }}
          </span>
        </div>
      </div>
      
      <!-- Player Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-bold truncate">
            {{ player.name }}
          </span>
          <div class="player-card-badges">
            <div v-if="player.isHost" class="player-card-host-badge">
              {{ $t('components.gameLobby.host') }}
            </div>
            <div v-if="player.isGuest" class="player-card-guest-badge">
              {{ $t('components.gameLobby.guest') }}
            </div>
          </div>
        </div>
        
        <!-- Status Indicator -->
        <div class="flex items-center gap-2">
          <div 
            class="player-card-status"
            :class="player.isReady ? 'ready' : 'waiting'"
          />
          <span class="font-mono text-xs text-contrast/70">
            {{ player.isReady ? $t('components.gameLobby.ready') : $t('components.gameLobby.waiting') }}
          </span>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex items-center gap-2">
        <!-- Ready Toggle for Current User -->
        <button 
          v-if="isCurrentUser"
          @click="$emit('toggleReady')"
          class="tech-button text-xs px-2 py-1 flex-shrink-0"
          :class="{ 'border-accent text-accent': player.isReady }"
          :title="player.isReady ? $t('components.gameLobby.markNotReady') : $t('components.gameLobby.markReady')"
        >
          {{ player.isReady ? '✓' : '○' }}
        </button>
        
        <!-- Kick Button for Host -->
        <button 
          v-if="isCurrentUserHost && !player.isHost"
          @click="$emit('kick')"
          class="tech-button text-sm px-2 py-1 flex-shrink-0"
          :title="$t('components.gameLobby.kickPlayer')"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '~/stores/game';

interface Player {
  id: string;
  name: string;
  avatarUrl?: string;
  isHost: boolean;
  isReady: boolean;
  isGuest: boolean;
}

const props = defineProps<{
  player: Player;
  isCurrentUserHost: boolean;
}>();

defineEmits<{
  kick: [];
  toggleReady: [];
}>();

const gameStore = useGameStore();

const isCurrentUser = computed(() => {
  return gameStore.playerId === props.player.id;
});
</script>

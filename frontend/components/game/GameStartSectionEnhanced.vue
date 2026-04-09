<template>
  <div class="gamelobby-footer">
    <TechButton 
      v-if="canStartGame"
      @click="$emit('start')"
      class="game-start-button ready"
    >
      {{ $t('components.gameLobby.startGame') }} <span class="tui-fkey-hint">[ENTER]</span>
    </TechButton>
  
    <div v-else-if="!hasPlayerId" class="status-banner text-sm font-mono text-accent tech-pulse tech-signal-noise">
      {{ $t('components.gameLobby.reconnecting') }}
    </div>
  
    <div v-else-if="isChoosingNewHost" class="status-banner text-sm font-mono text-accent tech-pulse tech-signal-noise">
      {{ $t('components.gameLobby.choosingNewHost', { playerName: nextHostName, seconds: remainingSeconds }) }}
    </div>
  
    <div v-else class="text-sm font-mono text-contrast/70 p-2 border border-contrast/30 bg-contrast/5">
      {{ isCurrentUserHost 
        ? $t('components.gameLobby.waitingForPlayers', { min: minPlayers })
        : $t('components.gameLobby.waitingForHost') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import TechButton from '../ui/TechButton.vue';

defineProps<{
  canStartGame: boolean;
  hasPlayerId: boolean;
  isChoosingNewHost: boolean;
  isCurrentUserHost: boolean;
  nextHostName: string;
  remainingSeconds: number;
  minPlayers: number;
}>();

defineEmits<{
  start: [];
}>();
</script>

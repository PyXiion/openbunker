<template>
  <div class="tech-tile tech-boot-fade">
    <div class="tech-tile-header" :class="{ 'tech-status-blink': isMyTurn, 'tech-cursor-move': isMyTurn }">
      {{ isMyTurn ? $t('components.turnActions.yourTurn') : $t('components.turnActions.waiting') }}
    </div>
    <div v-if="isMyTurn">
      <div v-if="mustRevealFirstTrait" class="text-sm text-accent mb-2 tech-pulse">
        {{ $t('components.turnActions.mustRevealFirstTrait') }}
      </div>
      <div v-else-if="cardsRemainingToReveal > 0" class="text-sm text-accent mb-2">
        {{ $t('components.turnActions.revealMoreCards', { count: cardsRemainingToReveal }) }}
      </div>
      <div v-else-if="!canRevealCard" class="text-sm text-success mb-2">
        {{ $t('components.turnActions.maxCardsRevealed') }}
      </div>
      <button 
        @click="$emit('end-turn')" 
        class="tech-button w-full"
        :disabled="!canEndTurn"
        :class="{ 'opacity-50 cursor-not-allowed': !canEndTurn }"
      >
        {{ $t('components.turnActions.endTurn') }} <span class="tui-fkey-hint">[SPACE]</span>
      </button>
    </div>
    <div v-else class="text-sm text-contrast/75">
      {{ $t('components.turnActions.notYourTurn') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHotkeys } from '~/composables/useHotkeys';

interface Props {
  isMyTurn: boolean;
  canEndTurn: boolean;
  mustRevealFirstTrait: boolean;
  cardsRemainingToReveal: number;
  canRevealCard: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'end-turn': [];
}>();

useHotkeys([
  {
    key: 'Space',
    handler: () => emit('end-turn'),
    condition: () => props.isMyTurn && props.canEndTurn,
    preventDefault: true
  }
]);
</script>

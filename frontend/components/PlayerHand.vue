<template>
  <div class="tech-tile">
    <div class="tech-tile-header">{{ $t('components.playerHand.yourHand') }}</div>
    <div v-if="player" class="space-y-2">
      <div 
        v-for="entry in traitEntries" 
        :key="entry.type"
        class="tech-card"
        :class="{ 
          'tech-card-revealed': entry.trait.isRevealed,
          'cursor-pointer hover:border-accent': !entry.trait.isRevealed
        }"
        @click="!entry.trait.isRevealed && $emit('reveal', entry.type)"
      >
        <div class="font-bold text-sm uppercase flex justify-between">
          <span :class="entry.color">{{ $t(`traits.types.${entry.type}`) }}</span>
          <span v-if="!entry.trait.isRevealed" class="text-accent">[{{ $t('components.playerHand.hidden') }}]</span>
        </div>
        <div>
          <div class="font-mono text-xs">{{ entry.trait.name }}</div>
          <div class="text-xs opacity-75">{{ entry.trait.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Player } from '~/stores/game';

interface Trait {
  name: string;
  description: string;
  isRevealed: boolean;
}

const TRAIT_COLORS: Record<string, string> = {
  profession: 'text-blue-400',
  biology: 'text-pink-400',
  hobby: 'text-green-400',
  phobia: 'text-purple-400',
  baggage: 'text-orange-400',
  fact: 'text-cyan-400',
};

interface Props {
  player: { traits: Record<string, Trait> } | null;
}

const props = defineProps<Props>();

interface TraitEntry {
  type: string;
  trait: Trait;
  color: string;
}

const traitEntries = computed<TraitEntry[]>(() => {
  if (!props.player) return [];
  return Object.entries(props.player.traits).map(([type, trait]) => ({
    type,
    trait,
    color: TRAIT_COLORS[type] || 'text-contrast',
  }));
});

defineEmits<{
  reveal: [type: string];
}>();
</script>

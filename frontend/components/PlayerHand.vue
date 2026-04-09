<template>
  <div class="tech-tile tech-boot-fade">
    <div class="tech-tile-header">{{ $t('components.playerHand.yourHand') }}</div>
    <div v-if="player" class="space-y-2">
      <div 
        v-for="entry in traitEntries" 
        :key="entry.type"
        class="tech-card"
        :class="{ 
          'tech-card-revealed': entry.trait.isRevealed,
          'hover:border-accent': !entry.trait.isRevealed
        }"
        @click="!entry.trait.isRevealed && $emit('reveal', entry.type)"
        @contextmenu.prevent="showCardDetail(entry.type, entry.trait, $event)"
        title="Left-click to reveal (your turn only), Right-click to view details"
      >
        <div class="font-bold text-sm uppercase flex justify-between">
          <span :class="entry.color">{{ $t(`traits.types.${entry.type}`) }}</span>
          <span v-if="!entry.trait.isRevealed" class="text-accent">[{{ $t('components.playerHand.hidden') }}]</span>
        </div>
        <div>
          <div class="font-mono text-xs" :class="{ 'tech-text-scramble': entry.trait.isRevealed }">{{ entry.trait.name }}</div>
          <div class="text-xs opacity-75">{{ entry.trait.description }}</div>
        </div>
      </div>
    </div>

    <PlayingCard
      :visible="!!selectedCard"
      :position="cardPosition"
      :variant="selectedCard?.type || 'default'"
      :revealed="selectedCard?.trait.isRevealed || false"
      :hidden-label="$t('components.playerHand.hidden')"
      :title="selectedCard ? $t(`traits.types.${selectedCard.type}`) : ''"
      :subtitle="selectedCard?.trait.name || ''"
      :description="selectedCard?.trait.description || ''"
      :footer-id="selectedCard?.footerId || ''"
      :header-color-class="selectedCard ? getCardColorClass(selectedCard.type) : 'bg-gray-600'"
      @close="closeCardDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
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

const selectedCard = ref<{ type: string; trait: Trait; footerId: string } | null>(null);
const cardPosition = ref({ x: 0, y: 0 });

const showCardDetail = (type: string, trait: Trait, event: MouseEvent) => {
  const footerId = `ID: ${type.slice(0,3).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  selectedCard.value = { type, trait, footerId };
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  cardPosition.value = {
    x: rect.right + 20,
    y: rect.top + rect.height / 2 - 150
  };
};

const closeCardDetail = () => {
  selectedCard.value = null;
};

const getCardColorClass = (type: string): string => {
  const colors: Record<string, string> = {
    profession: 'bg-blue-600',
    biology: 'bg-pink-600',
    hobby: 'bg-green-600',
    phobia: 'bg-purple-600',
    baggage: 'bg-orange-600',
    fact: 'bg-cyan-600',
  };
  return colors[type] || 'bg-gray-600';
};

defineEmits<{
  reveal: [type: string];
}>();
</script>

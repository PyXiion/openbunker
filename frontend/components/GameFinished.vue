<template>
  <div class="tech-tile relative">
    <div class="tech-tile-header">{{ $t('components.gameFinished.gameFinished') }}</div>
    <div class="text-center space-y-8">
      <!-- Survivors -->
      <div>
        <h2 class="text-2xl font-bold text-accent uppercase mb-4">{{ $t('components.gameFinished.survivors') }}</h2>
        <div class="tech-grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          <div 
            v-for="player in survivors" 
            :key="player.id"
            class="border-2 border-contrast p-2 text-xs"
          >
            <h3 class="font-bold uppercase">{{ player.name }}</h3>
            <PlayerTraits 
              :traits="player.traits" 
              compact
              @show-detail="showCardDetail"
            />
          </div>
        </div>
      </div>

      <!-- Dead/Exiled Players -->
      <div v-if="exiled.length > 0">
        <h2 class="text-2xl font-bold text-red-500 uppercase mb-4">{{ $t('components.gameFinished.deadPlayers') }}</h2>
        <div class="tech-grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          <div 
            v-for="player in exiled" 
            :key="player.id"
            class="border-2 border-red-500/50 bg-red-950/10 p-2 text-xs"
          >
            <h3 class="font-bold uppercase text-red-400">{{ player.name }}</h3>
            <PlayerTraits 
              :traits="player.traits" 
              compact
              @show-detail="showCardDetail"
            />
          </div>
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

interface Trait {
  name: string;
  description: string;
  isRevealed: boolean;
}

interface SelectedCard {
  type: string;
  trait: Trait;
  footerId: string;
}

interface Player {
  id: string;
  name: string;
  isExiled: boolean;
  traits: Record<string, Trait>;
}

interface Props {
  players: Record<string, Player>;
}

const props = defineProps<Props>();

const selectedCard = ref<SelectedCard | null>(null);
const cardPosition = ref({ x: 0, y: 0 });

const survivors = computed(() => {
  return Object.values(props.players).filter(p => !p.isExiled);
});

const exiled = computed(() => {
  return Object.values(props.players).filter(p => p.isExiled);
});

function showCardDetail(type: string, trait: Trait, rect: DOMRect) {
  const footerId = `ID: ${type.slice(0,3).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  selectedCard.value = { type, trait, footerId };
  cardPosition.value = {
    x: rect.right + 20,
    y: rect.top + rect.height / 2 - 150
  };
}

function closeCardDetail() {
  selectedCard.value = null;
}

function getCardColorClass(type: string): string {
  const colors: Record<string, string> = {
    profession: 'bg-blue-600',
    biology: 'bg-pink-600',
    hobby: 'bg-green-600',
    phobia: 'bg-purple-600',
    baggage: 'bg-orange-600',
    fact: 'bg-cyan-600',
  };
  return colors[type] || 'bg-gray-600';
}
</script>

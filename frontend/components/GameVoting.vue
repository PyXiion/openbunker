<template>
  <div class="tech-tile">
    <div class="tech-tile-header">{{ $t('components.gameVoting.votingPhase') }}</div>
    <div class="space-y-2">
      <div 
        v-for="player in votablePlayers" 
        :key="player.id"
        class="border border-contrast p-2 flex items-center gap-3"
      >
        <button 
          @click="$emit('vote', player.id)"
          :disabled="hasVoted"
          class="tech-button text-sm px-3 py-1 disabled:opacity-50 shrink-0"
        >
          {{ player.name }}
        </button>
        <div class="flex-1 flex flex-wrap gap-1 text-xs">
          <span 
            v-for="entry in getRevealedTraits(player.traits)" 
            :key="entry.type"
            class="px-1 py-0.5 bg-contrast/20"
            :class="entry.color"
          >
            {{ $t(`traits.types.${entry.type}`) }}: {{ entry.trait.name }}
          </span>
        </div>
        <span class="text-xs font-mono shrink-0" :class="player.hasVoted ? 'text-green-400' : 'text-contrast/50'">
          {{ player.votesReceived }} {{ $t('components.gameVoting.votes') }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const TRAIT_COLORS: Record<string, string> = {
  profession: 'text-blue-400',
  biology: 'text-pink-400',
  hobby: 'text-green-400',
  phobia: 'text-purple-400',
  baggage: 'text-orange-400',
  fact: 'text-cyan-400',
};

interface Trait {
  name: string;
  description: string;
  isRevealed: boolean;
}

interface Player {
  id: string;
  name: string;
  hasVoted: boolean;
  votesReceived: number;
  traits: Record<string, Trait>;
}

interface Props {
  activePlayers: Player[];
  currentPlayerId: string | null;
  hasVoted: boolean;
}

const props = defineProps<Props>();

const votablePlayers = computed(() => {
  return props.activePlayers.filter(p => p.id !== props.currentPlayerId);
});

function getRevealedTraits(traits: Record<string, Trait>) {
  return Object.entries(traits)
    .filter(([_, trait]) => trait.isRevealed)
    .map(([type, trait]) => ({
      type,
      trait,
      color: TRAIT_COLORS[type] || 'text-contrast',
    }));
}

defineEmits<{
  vote: [playerId: string];
}>();
</script>

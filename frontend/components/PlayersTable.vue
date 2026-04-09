<template>
  <div class="tech-tile relative tech-boot-fade">
    <div class="tech-tile-header">{{ $t('components.playersTable.players') }}</div>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
      <div 
        v-for="player in playerList" 
        :key="player.id"
        class="border-2 p-2 min-w-0 text-xs"
        :class="getCardClasses(player)"
      >
        <div 
          class="font-bold uppercase truncate flex justify-between text-xs"
          :class="getNameColor(player)"
        >
          <span v-if="isCurrentTurn(player.id)" class="tui-cursor">►</span>
          <span :class="{ 'tech-cursor-blink': isCurrentTurn(player.id) }">{{ player.name }}</span>
          <span v-if="isCurrentUser(player)" class="font-bold" :class="getYouBadgeColor(player)">[{{ $t('components.playersTable.you') }}]</span>
        </div>
        <div class="text-xs leading-tight" :class="getStatusColor(player)">
          {{ player.isExiled ? $t('components.playersTable.exiled') : $t('components.playersTable.active') }}
        </div>
        <PlayerTraits 
          :traits="player.traits" 
          compact 
          @show-detail="showCardDetail"
        />
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

interface SelectedCard {
  type: string;
  trait: Trait;
  footerId: string;
}

interface Props {
  players: Record<string, Player>;
  currentTurnIndex: number;
  turnOrder: string[];
  currentPlayerId: string | null;
}

const props = defineProps<Props>();

const selectedCard = ref<SelectedCard | null>(null);
const cardPosition = ref({ x: 0, y: 0 });

const playerList = computed(() => Object.values(props.players));

function isCurrentTurn(playerId: string): boolean {
  return props.turnOrder[props.currentTurnIndex] === playerId;
}

function isCurrentUser(player: Player): boolean {
  return player.id === props.currentPlayerId;
}

function getCardClasses(player: Player): Record<string, boolean> {
  return {
    'border-contrast': !isCurrentTurn(player.id),
    'bg-accent border-accent': isCurrentTurn(player.id),
    'tech-border-flash': isCurrentTurn(player.id),
  };
}

function getNameColor(player: Player): string {
  return isCurrentTurn(player.id) ? 'text-white' : 'text-contrast';
}

function getYouBadgeColor(player: Player): string {
  return isCurrentTurn(player.id) ? 'text-white' : 'text-accent';
}

function getStatusColor(player: Player): string {
  if (player.isExiled) return 'text-red-400';
  return isCurrentTurn(player.id) ? 'text-white/75' : 'text-contrast/75';
}

function showCardDetail(type: string, trait: Trait, rect: DOMRect) {
  console.log('[PlayersTable] showCardDetail called', { type, trait: trait.name, rect });
  try {
    const footerId = `ID: ${type.slice(0,3).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    selectedCard.value = { type, trait, footerId };
    cardPosition.value = {
      x: rect.right + 20,
      y: rect.top + rect.height / 2 - 150
    };
    console.log('[PlayersTable] Card detail set successfully');
  } catch (error) {
    console.error('[PlayersTable] Error in showCardDetail:', error);
  }
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

<style scoped>
/* No styles needed - PlayingCard component handles all card styling */
</style>

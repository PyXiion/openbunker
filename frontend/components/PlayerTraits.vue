<template>
  <div :class="compact ? 'mt-1 space-y-0.5' : 'mt-2 space-y-2'">
    <div 
      v-for="entry in traitEntries" 
      :key="entry.type"
      class="cursor-pointer hover:border-accent transition-colors"
      :class="[
        compact ? 'p-1 text-xs' : 'p-3',
        borderColorClass,
        { 
          'bg-red-500/10': entry.trait.isRevealed && props.isExiled,
          'bg-base': !entry.trait.isRevealed 
        }
      ]"
      @click="handleClick(entry.type, entry.trait, $event)"
    >
      <div class="font-bold uppercase flex justify-between leading-tight" :class="compact ? 'text-xs' : 'text-sm'">
        <span :class="[
          entry.color,
          compact && !entry.trait.isRevealed && 'opacity-50'
        ]">
          {{ $t(`traits.types.${entry.type}`) }}
        </span>
        <span v-if="!entry.trait.isRevealed" class="text-accent">{{ compact ? '?' : `[${$t('components.playerHand.hidden')}]` }}</span>
      </div>
      <div v-if="entry.trait.isRevealed && !compact" class="mt-1">
        <div class="font-mono text-xs">{{ entry.trait.name }}</div>
        <div class="text-xs opacity-75">{{ entry.trait.description }}</div>
      </div>
      <div v-else-if="entry.trait.isRevealed && compact" class="leading-tight">
        <div class="font-mono truncate">{{ entry.trait.name }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

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
  traits: Record<string, Trait>;
  compact?: boolean;
  isExiled?: boolean;
}

const props = defineProps<Props>();

interface TraitEntry {
  type: string;
  trait: Trait;
  color: string;
}

const traitEntries = computed<TraitEntry[]>(() => {
  return Object.entries(props.traits).map(([type, trait]) => ({
    type,
    trait,
    color: TRAIT_COLORS[type] || 'text-contrast',
  }));
});

const borderColorClass = computed(() => {
  return props.isExiled ? 'border border-red-500/50' : 'border border-contrast/50';
});

const emit = defineEmits<{
  showDetail: [type: string, trait: Trait, rect: DOMRect];
}>();

const handleClick = (type: string, trait: Trait, event: MouseEvent) => {
  if (props.compact) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    emit('showDetail', type, trait, rect);
  }
};
</script>

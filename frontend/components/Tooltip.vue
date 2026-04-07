<template>
  <div class="relative inline-block">
    <slot name="trigger">
      <span 
        class="text-xs text-accent cursor-help font-mono"
        @mouseenter="showTooltip"
        @mouseleave="hideTooltip"
      >
        [?]
      </span>
    </slot>
    
    <Transition
      name="tooltip"
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div 
        v-if="isVisible"
        class="absolute z-50 w-64 p-3 text-sm font-mono tech-tile border-2 border-accent shadow-lg"
        :class="positionClass"
        @mouseenter="keepTooltipVisible"
        @mouseleave="hideTooltip"
      >
        <div class="tech-tile-header text-xs mb-2">{{ $t('components.tooltip.help') }}</div>
        <div class="text-contrast/90">{{ content }}</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';

interface Props {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top'
});

const isVisible = ref(false);
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

const positionClass = computed(() => {
  switch (props.position) {
    case 'top':
      return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    case 'bottom':
      return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
    case 'left':
      return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
    case 'right':
      return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
    default:
      return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
  }
});

const showTooltip = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  isVisible.value = true;
};

const hideTooltip = () => {
  hideTimeout = setTimeout(() => {
    isVisible.value = false;
  }, 100);
};

const keepTooltipVisible = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
};

onUnmounted(() => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }
});
</script>

<style scoped>
.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.2s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(4px);
}
</style>

<template>
  <div class="tech-tile tech-glitch">
    <div class="tech-tile-header">{{ $t('components.catastropheCard.catastrophe') }}</div>
    <div v-if="catastrophe">
      <h3 class="font-bold text-accent uppercase">{{ catastrophe.title }}</h3>
      <p class="text-sm mt-2">{{ catastrophe.description }}</p>
      <p class="text-xs mt-2 font-mono">{{ $t('components.catastropheCard.duration') }}: {{ catastrophe.duration }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  catastrophe: {
    title: string;
    description: string;
    duration: string;
  } | null;
}

defineProps<Props>();
</script>

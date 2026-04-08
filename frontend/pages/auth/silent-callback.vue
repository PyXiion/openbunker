<template>
  <div class="hidden">
    <!-- Silent callback page - should be invisible -->
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth } from '~/composables/useAuth';

const auth = useAuth();

onMounted(async () => {
  try {
    await auth.handleSilentCallback();
  } catch (error) {
    console.error('Silent callback error:', error);
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Completing authentication...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '~/composables/useAuth';

const router = useRouter();
const auth = useAuth();

onMounted(async () => {
  try {
    await auth.handleCallback();
    
    // Redirect to home or original destination
    const redirectTo = router.currentRoute.value.query.redirect as string || '/';
    await router.push(redirectTo);
  } catch (error) {
    console.error('Auth callback error:', error);
    await router.push('/?error=auth_failed');
  }
});
</script>

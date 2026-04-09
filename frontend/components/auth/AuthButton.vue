<template>
  <div class="auth-button">
    <!-- User is authenticated -->
    <div v-if="auth.isAuthenticated" class="flex items-center space-x-4">
      <div class="flex items-center space-x-2">
        <img 
          v-if="user?.avatarUrl" 
          :src="user.avatarUrl" 
          :alt="user.username"
          class="w-8 h-8 rounded-full"
        />
        <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center" v-else>
          <span class="text-white text-sm font-semibold">
            {{ user?.username?.charAt(0).toUpperCase() }}
          </span>
        </div>
        <span class="text-sm font-medium text-gray-700">{{ user?.username }}</span>
        <span v-if="user?.isVerified" class="text-green-500" title="Verified">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </span>
      </div>
      <button 
        @click="navigateTo('/profile')"
        class="text-sm text-blue-500 hover:text-blue-700"
      >
        {{ $t('profile.profile') }}
      </button>
      <button 
        @click="handleLogout"
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        Logout
      </button>
    </div>

    <!-- Guest user -->
    <div v-else-if="auth.isGuest" class="flex items-center space-x-4">
      <div class="flex items-center space-x-2">
        <div class="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
          <span class="text-white text-sm font-semibold">G</span>
        </div>
        <span class="text-sm font-medium text-gray-700">{{ guestUser?.username }} (Guest)</span>
      </div>
      <button 
        @click="handleUpgrade"
        class="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
      >
        Save Account
      </button>
    </div>

    <!-- Not authenticated -->
    <div v-else class="flex space-x-2">
      <button 
        @click="handleLogin"
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Login
      </button>
      <button 
        @click="showGuestModal = true"
        class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
      >
        Play as Guest
      </button>
    </div>

    <!-- Guest Modal -->
    <div v-if="showGuestModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-4">Play as Guest</h3>
        <form @submit.prevent="handleGuestLogin">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input 
              v-model="guestUsername"
              type="text" 
              required
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
            />
          </div>
          <div class="flex justify-end space-x-2">
            <button 
              type="button"
              @click="showGuestModal = false"
              class="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button 
              type="submit"
              :disabled="!guestUsername.trim()"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Play as Guest
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { logger } from '~/utils/logger';

const auth = useAuth();
const showGuestModal = ref(false);
const guestUsername = ref('');

const user = computed(() => auth.currentUser.value);
const guestUser = computed(() => auth.guestUser.value);

const handleLogin = async () => {
  try {
    await auth.login();
  } catch (error) {
    logger.error('Login error:', error);
  }
};

const handleGuestLogin = async () => {
  try {
    await auth.createGuestUser(guestUsername.value.trim());
    showGuestModal.value = false;
    guestUsername.value = '';
  } catch (error) {
    logger.error('Guest login error:', error);
  }
};

const handleUpgrade = async () => {
  try {
    await auth.upgradeGuestAccount();
  } catch (error) {
    logger.error('Upgrade error:', error);
  }
};

const handleLogout = async () => {
  try {
    await auth.logout();
  } catch (error) {
    logger.error('Logout error:', error);
  }
};
</script>

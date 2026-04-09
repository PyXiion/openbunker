<template>
  <div class="h-full bg-base text-contrast p-8 overflow-y-auto">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="tech-tile mb-6 relative">
        <div class="text-center">
          <h1 class="text-5xl font-bold text-center uppercase mb-2">{{ $t('profile.title') }}</h1>
          <p class="text-center text-contrast/70">{{ $t('app.subtitle') }}</p>
        </div>
        <TechButton
          @click="handleLogout"
          variant="accent"
          size="sm"
          class="absolute top-4 right-4"
          :is-loading="isLoading"
        >
          {{ $t('profile.logout') }}
        </TechButton>
      </div>

      <!-- Skeleton Preview (Loading State) -->
      <div v-if="isInitialLoading" class="tech-tile border-2 border-contrast relative">
        <div class="tech-tile-header">{{ $t('profile.title') }}</div>
        <div class="absolute top-4 right-4 text-xs font-mono text-contrast/20">
          ID: ------
        </div>

        <div class="space-y-5">
          <!-- Avatar and Username Skeleton -->
          <div class="flex items-center gap-6">
            <div class="w-24 h-24 border-2 border-contrast bg-gray-300"></div>
            <div class="flex-1 space-y-3">
              <div class="space-y-2">
                <div class="h-4 w-24 bg-gray-300"></div>
                <div class="h-8 w-48 bg-gray-300"></div>
              </div>
              <div class="space-y-2">
                <div class="h-4 w-16 bg-gray-300"></div>
                <div class="h-6 w-64 bg-gray-300"></div>
              </div>
            </div>
          </div>

          <!-- Guest Notice Skeleton -->
          <div class="p-4 border-2 border-accent/50 bg-accent/10">
            <div class="space-y-2">
              <div class="h-4 w-full bg-gray-300"></div>
              <div class="h-4 w-5/6 bg-gray-300"></div>
              <div class="h-4 w-4/6 bg-gray-300"></div>
            </div>
          </div>

          <!-- Actions Skeleton -->
          <div class="tech-grid grid-cols-2 gap-4">
            <div class="h-12 bg-gray-300"></div>
            <div class="h-12 bg-gray-300"></div>
          </div>
        </div>
      </div>

      <!-- Profile Content -->
      <div v-else class="tech-tile border-2 border-contrast relative">
        <div class="tech-tile-header">{{ $t('profile.title') }}</div>
        <div class="absolute top-4 right-4 text-xs font-mono text-contrast/20">
          ID: {{ user?.userId || guestUser?.userId || '-' }}
        </div>

        <div class="space-y-5">
          <!-- Avatar and Username -->
          <div class="flex items-center gap-6">
            <div class="w-24 h-24 rounded-full border-2 border-contrast flex items-center justify-center overflow-hidden bg-base">
              <img
                v-if="user?.avatarUrl"
                :src="user.avatarUrl"
                :alt="user.username"
                class="w-full h-full object-cover"
              />
              <div class="w-full h-full bg-contrast/10 flex items-center justify-center" v-else>
                <span class="text-contrast text-3xl font-bold">
                  {{ user?.username?.charAt(0).toUpperCase() || guestUser?.username?.charAt(0).toUpperCase() || '?' }}
                </span>
              </div>
            </div>

            <div class="flex-1">
              <div class="mb-2">
                <label class="block text-sm font-bold uppercase mb-1">{{ $t('profile.username') }}</label>
                <div v-if="isEditingUsername" class="flex gap-2">
                  <input
                    v-model="editingUsername"
                    type="text"
                    class="flex-1 border-2 border-contrast bg-base p-3 font-mono text-lg focus:outline-none focus:border-accent transition-colors"
                    maxlength="20"
                    @keydown.enter="saveUsername"
                  />
                  <TechButton
                    @click="saveUsername"
                    :is-loading="isLoading"
                  >
                    {{ $t('profile.save') }}
                  </TechButton>
                  <TechButton
                    @click="cancelEditUsername"
                    variant="accent"
                    :disabled="isLoading"
                  >
                    ×
                  </TechButton>
                </div>
                <div v-else class="flex items-center gap-2">
                  <p class="text-lg font-mono">{{ user?.username || guestUser?.username || '-' }}</p>
                  <TechButton
                    @click="startEditUsername"
                    size="sm"
                  >
                    {{ $t('profile.edit') }}
                  </TechButton>
                </div>
              </div>

              <div v-if="user?.email" class="mb-2">
                <label class="block text-sm font-bold uppercase mb-1">{{ $t('profile.email') }}</label>
                <p class="text-lg font-mono">{{ user.email }}</p>
              </div>
            </div>
          </div>

          <!-- Guest Notice -->
          <div v-if="guestUser" class="p-4 border-2 border-accent/50 bg-accent/10">
            <div class="text-contrast/80 text-sm prose" v-html="renderedGuestNotice"></div>
          </div>

          <!-- Error Display -->
          <div v-if="error" class="p-3 border-2 border-accent bg-base">
            <p class="text-accent font-bold uppercase text-sm">{{ error }}</p>
          </div>

          <!-- Actions -->
          <div class="tech-grid grid-cols-2 gap-4">
            <TechButton
              v-if="guestUser"
              @click="handleUpgrade"
              :is-loading="isLoading"
            >
              {{ $t('profile.upgradeAccount') }}
            </TechButton>
            <TechButton
              @click="navigateTo('/')"
              variant="secondary"
            >
              {{ $t('profile.backToHome') }}
            </TechButton>
          </div>

          <!-- User Statistics -->
          <div v-if="user && !guestUser" class="mt-8">
            <div class="tech-tile-header mb-4">{{ $t('profile.statistics') }}</div>
            <div v-if="isLoadingStats" class="p-4 border-2 border-contrast/30 bg-base">
              <p class="text-contrast/70">{{ $t('profile.loading') }}</p>
            </div>
            <div v-else-if="userStats" class="tech-grid grid-cols-2 gap-4">
              <div class="p-4 border-2 border-contrast/50 bg-base">
                <div class="text-sm text-contrast/70">{{ $t('profile.gamesPlayed') }}</div>
                <div class="text-2xl font-bold">{{ userStats.gamesPlayed || 0 }}</div>
              </div>
              <div class="p-4 border-2 border-contrast/50 bg-base">
                <div class="text-sm text-contrast/70">{{ $t('profile.gamesWon') }}</div>
                <div class="text-2xl font-bold">{{ userStats.gamesWon || 0 }}</div>
              </div>
              <div class="p-4 border-2 border-contrast/50 bg-base">
                <div class="text-sm text-contrast/70">{{ $t('profile.survivalRate') }}</div>
                <div class="text-2xl font-bold">{{ userStats.bunkerSurvivalRate || 0 }}%</div>
              </div>
              <div class="p-4 border-2 border-contrast/50 bg-base">
                <div class="text-sm text-contrast/70">{{ $t('profile.totalPlaytime') }}</div>
                <div class="text-2xl font-bold">{{ userStats.totalPlaytimeMinutes || 0 }} {{ $t('profile.minutes') }}</div>
              </div>
            </div>
            <div v-else class="p-4 border-2 border-contrast/30 bg-base">
              <p class="text-contrast/70">{{ $t('profile.noStatsYet') }}</p>
            </div>
          </div>

          <!-- Game History -->
          <div v-if="user && !guestUser" class="mt-8">
            <div class="tech-tile-header mb-4">{{ $t('profile.gameHistory') }}</div>
            <div v-if="isLoadingHistory" class="p-4 border-2 border-contrast/30 bg-base">
              <p class="text-contrast/70">{{ $t('profile.loading') }}</p>
            </div>
            <div v-else-if="gameHistory.length === 0" class="p-4 border-2 border-contrast/30 bg-base">
              <p class="text-contrast/70">{{ $t('profile.noGamesPlayed') }}</p>
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="game in gameHistory"
                :key="game.id"
                class="p-4 border-2 border-contrast/50 bg-base hover:border-accent/50 transition-colors"
              >
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <div class="text-sm font-mono text-contrast/70">
                      {{ formatDate(game.playedAt) }}
                    </div>
                    <div class="text-lg font-bold">
                      {{ game.survived ? $t('profile.survived') : $t('profile.exiled') }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-mono text-contrast/70">
                      {{ $t('profile.round') }} {{ game.finalRound }}
                    </div>
                    <div class="text-sm font-mono text-contrast/70">
                      {{ game.durationMinutes }} {{ $t('profile.minutes') }}
                    </div>
                  </div>
                </div>
                <div class="text-sm text-contrast/70">
                  {{ game.playersCount }} {{ $t('profile.players') }} • {{ game.bunkerCapacity }} {{ $t('profile.capacity') }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it';

const auth = useAuth();
const user = computed(() => auth.currentUser.value);
const guestUser = computed(() => auth.guestUser.value);

const md = new MarkdownIt();

const renderedGuestNotice = computed(() => {
  const notice = $t('profile.guestNotice');
  return md.render(notice);
});

const isEditingUsername = ref(false);
const editingUsername = ref('');
const isLoading = ref(false);
const isInitialLoading = ref(true);
const isLoadingHistory = ref(false);
const isLoadingStats = ref(false);
const gameHistory = ref<any[]>([]);
const userStats = ref<any>(null);
const error = ref('');

const handleLogout = async () => {
  isLoading.value = true;
  error.value = '';
  
  try {
    await auth.logout();
  } catch (err) {
    console.error('Logout error:', err);
    error.value = $t('profile.logoutError');
    isLoading.value = false;
  }
};

const handleUpgrade = async () => {
  isLoading.value = true;
  error.value = '';
  
  try {
    await auth.upgradeGuestAccount();
  } catch (err) {
    console.error('Upgrade error:', err);
    error.value = $t('profile.upgradeError');
    isLoading.value = false;
  }
};

const startEditUsername = () => {
  editingUsername.value = user.value?.username || guestUser.value?.username || '';
  isEditingUsername.value = true;
};

const saveUsername = async () => {
  if (!editingUsername.value.trim()) return;
  
  isLoading.value = true;
  error.value = '';
  
  try {
    if (guestUser.value) {
      // Update the guest user locally
      const updatedGuestUser = {
        userId: guestUser.value.userId,
        username: editingUsername.value.trim(),
        isGuest: true,
      };
      
      // Update the auth service's guestUser ref
      (auth as any).guestUser.value = updatedGuestUser;
      
      // Save to localStorage
      if (import.meta.client) {
        localStorage.setItem('guestUser', JSON.stringify(updatedGuestUser));
      }
    } else if (user.value) {
      // Update authenticated user via backend API
      const config = useRuntimeConfig();
      const token = auth.getAuthToken();
      
      const response = await fetch(`${config.public.backendUrl}/api/auth/username`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ username: editingUsername.value.trim() }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update username');
      }
      
      const result = await response.json();
      
      // Update the auth service's currentUser ref
      (auth as any).currentUser.value = {
        ...user.value,
        username: result.username,
      };
      
      // Save to localStorage
      if (import.meta.client) {
        localStorage.setItem('authUser', JSON.stringify((auth as any).currentUser.value));
      }
    }
    
    isEditingUsername.value = false;
  } catch (err) {
    console.error('Username update error:', err);
    error.value = $t('profile.usernameError');
  } finally {
    isLoading.value = false;
  }
};

const cancelEditUsername = () => {
  editingUsername.value = '';
  isEditingUsername.value = false;
};

const formatDate = (date: string) => {
  const d = new Date(date);
  return d.toLocaleDateString();
};

const fetchGameHistory = async () => {
  console.log('[PROFILE] fetchGameHistory called, user:', !!user.value, 'guestUser:', !!guestUser.value);
  if (!user.value || guestUser.value) return;

  isLoadingHistory.value = true;
  try {
    console.log('[PROFILE] Fetching game history directly from API');
    const config = useRuntimeConfig();
    const token = auth.getAuthToken();

    if (!token) {
      console.error('[PROFILE] No token found');
      return;
    }

    const response = await fetch(`${config.public.backendUrl}/api/auth/game-history?limit=20`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[PROFILE] Failed to fetch game history, status:', response.status);
      return;
    }

    const result = await response.json();
    gameHistory.value = result.history || [];
    console.log('[PROFILE] Game history fetched:', gameHistory.value.length, 'records');
  } catch (err) {
    console.error('[PROFILE] Failed to fetch game history:', err);
  } finally {
    isLoadingHistory.value = false;
  }
};

const fetchUserStats = async () => {
  console.log('[PROFILE] fetchUserStats called, user:', !!user.value, 'guestUser:', !!guestUser.value);
  if (!user.value || guestUser.value) return;

  isLoadingStats.value = true;
  try {
    console.log('[PROFILE] Fetching user stats from API');
    const config = useRuntimeConfig();
    const token = auth.getAuthToken();

    if (!token) {
      console.error('[PROFILE] No token found');
      return;
    }

    const response = await fetch(`${config.public.backendUrl}/api/auth/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[PROFILE] Failed to fetch user stats, status:', response.status);
      return;
    }

    const result = await response.json();
    userStats.value = result.stats || null;
    console.log('[PROFILE] User stats fetched:', userStats.value);
  } catch (err) {
    console.error('[PROFILE] Failed to fetch user stats:', err);
  } finally {
    isLoadingStats.value = false;
  }
};

// Redirect to home if not authenticated
onMounted(() => {
  isInitialLoading.value = false;
  if (!user.value && !guestUser.value) {
    navigateTo('/');
  } else if (user.value && !guestUser.value) {
    fetchGameHistory();
    fetchUserStats();
  }
});
</script>

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

// Redirect to home if not authenticated
onMounted(() => {
  isInitialLoading.value = false;
  if (!user.value && !guestUser.value) {
    navigateTo('/');
  }
});
</script>

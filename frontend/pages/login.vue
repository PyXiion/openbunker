<template>
  <div class="h-full bg-base text-contrast p-8 flex items-center justify-center overflow-y-auto">
    <div class="max-w-md w-full">
      <!-- Header -->
      <div class="tech-tile mb-6">
        <div class="text-center">
          <h1 class="text-5xl font-bold text-center uppercase mb-2">{{ $t('app.title') }}</h1>
          <p class="text-center text-contrast/70">{{ $t('app.subtitle') }}</p>
        </div>
      </div>

      <!-- Login Form -->
      <div class="tech-tile border-2 border-contrast">
        
        <div class="space-y-5">
          <!-- Continue as Guest (Primary) -->
          <div>
            <label class="block text-sm font-bold uppercase mb-2 text-contrast/90">{{ $t('pages.index.continueAsGuest') }}</label>
            <div class="flex gap-2">
              <input 
                v-model="guestNickname"
                type="text"
                class="flex-1 border-2 border-contrast bg-base p-3 font-mono text-lg focus:outline-none focus:border-accent transition-colors"
                :placeholder="$t('pages.index.nicknamePlaceholder')"
                maxlength="20"
                @keydown.enter="handleGuestContinue"
              />
              <TechButton 
                @click="handleGuestContinue"
                :disabled="!guestNickname.trim()"
                :is-loading="isLoading"
              >
                {{ $t('pages.index.continue') }}
              </TechButton>
            </div>
          </div>

          <!-- Sign In (Secondary) -->
          <div class="pt-4 border-t border-contrast/30">
            <p class="text-center text-contrast/60 text-sm uppercase mb-3">{{ $t('pages.index.or') }}</p>
            <TechButton 
              @click="handleLogin"
              variant="secondary"
              full-width
              :is-loading="isLoading"
            >
              {{ $t('pages.index.signIn') }}
            </TechButton>
          </div>

          <!-- Error Display -->
          <div v-if="error" class="p-3 border-2 border-accent bg-base">
            <p class="text-accent font-bold uppercase text-sm">{{ error }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const auth = useAuth();
const guestNickname = ref('');
const isLoading = ref(false);
const error = ref('');

const getRedirectUrl = () => {
  return route.query.redirect as string || '/';
};

const handleGuestContinue = async () => {
  if (!guestNickname.value.trim()) return;
  
  isLoading.value = true;
  error.value = '';
  
  try {
    await auth.createGuestUser(guestNickname.value.trim());
    navigateTo(getRedirectUrl());
  } catch (err) {
    console.error('Guest creation error:', err);
    error.value = $t('pages.index.error') + ': ' + (err as Error).message;
  } finally {
    isLoading.value = false;
  }
};

const handleLogin = async () => {
  isLoading.value = true;
  error.value = '';
  
  try {
    await auth.login();
    navigateTo(getRedirectUrl());
  } catch (err) {
    console.error('Login error:', err);
    error.value = $t('pages.index.error') + ': ' + (err as Error).message;
  } finally {
    isLoading.value = false;
  }
};

// Redirect to stored URL or home if already authenticated
onMounted(() => {
  if (auth.currentUser.value || auth.guestUser.value) {
    navigateTo(getRedirectUrl());
  }
});
</script>

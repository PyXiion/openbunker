import { AuthService } from '~/services/auth.service';

export default defineNuxtPlugin(() => {
  console.log('AuthPlugin: Starting plugin initialization...');
  
  const config = useRuntimeConfig()
  console.log('AuthPlugin: Got runtime config');
  
  const authService = new AuthService(config)
  console.log('AuthPlugin: Created auth service');

  // Initialize the auth service asynchronously but don't block plugin
  authService.initialize().then(() => {
    console.log('AuthPlugin: Auth service initialized successfully');
  }).catch((error) => {
    console.error('AuthPlugin: Auth service initialization failed:', error);
  });

  // This makes $auth available to useNuxtApp()
  console.log('AuthPlugin: Providing auth service to Nuxt app');
  return {
    provide: {
      auth: authService
    }
  }
})
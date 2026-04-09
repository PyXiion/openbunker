import { AuthService } from '~/services/auth.service';

declare module '#app' {
  interface NuxtApp {
    $auth: AuthService;
  }
}

declare module 'nuxt/app' {
  interface NuxtApp {
    $auth: AuthService;
  }
}

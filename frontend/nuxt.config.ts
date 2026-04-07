export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/i18n'
  ],
  css: ['~/assets/css/main.css'],
  i18n: {
    locales: [
      { code: 'ru', name: 'Русский', file: 'ru.json' }
    ],
    defaultLocale: 'ru',
    langDir: 'locales/',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  },
  runtimeConfig: {
    public: {
      wsUrl: process.env.WS_URL || 'http://localhost:3001'
    }
  }
})

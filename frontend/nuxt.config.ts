export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/i18n'
  ],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: {
        lang: 'ru'
      },
      title: 'Бункер — психологическая игра на выживание',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Дискуссионная игра о выживании в условиях апокалипсиса. Убеди остальных, что именно ты должен попасть в спасательный бункер.' },
        
        // Open Graph / Facebook / Telegram
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Бункер — психологическая игра на выживание' },
        { property: 'og:description', content: 'Дискуссионная игра о выживании в условиях апокалипсиса. Убеди остальных, что именно ты должен попасть в спасательный бункер.' },
        { property: 'og:site_name', content: 'Бункер' },
        
        // Twitter / X
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Бункер — психологическая игра на выживание' },
        { name: 'twitter:description', content: 'Дискуссионная игра о выживании в условиях апокалипсиса. Убеди остальных, что именно ты должен попасть в бункер.' },
        
        // Extra
        { name: 'keywords', content: 'бункер, настольная игра, социальная дедукция, выживание, онлайн игра, мафия' },
        { name: 'author', content: 'Bunker Game' }
      ]
    }
  },
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
      wsUrl: 'http://localhost:3001' // Default if env is missing
    }
  }
})

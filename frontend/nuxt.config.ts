import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Load .env file from project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env') })

// Load generated config
let generatedConfig: any = null;
try {
  const configPath = join(__dirname, 'config', 'generated.json');
  console.log(`[CONFIG] Loading generated config from ${configPath}`);
  generatedConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  console.log(`[CONFIG] Generated config loaded: ${JSON.stringify(generatedConfig, null, 2)}`);
} catch (error) {
  console.warn('[CONFIG] Failed to load generated config, using defaults');
  generatedConfig = {
    game: {
      min_players: 2,
      max_players: 12,
    },
    social: {
      telegram_url: 'https://t.me/PyXiion_channel',
      discord_url: 'https://discord.gg/KpAMMCdcrJ',
    },
  };
}

export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/i18n'
  ],
  components: [
    {
      path: '~/components',
      pathPrefix: false
    }
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
      wsUrl: process.env.WS_URL || 'http://localhost:3001',
      wsPath: process.env.WS_PATH || '/socket.io/',
      backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
      casdoorUrl: process.env.CASDOOR_URL || 'http://localhost:8000',
      casdoorClientId: process.env.CASDOOR_CLIENT_ID || 'bunker-frontend',
      casdoorAppName: process.env.CASDOOR_APP_NAME || 'bunker',
      casdoorOrgName: process.env.CASDOOR_ORG_NAME || 'bunker',
      gameConfig: generatedConfig.game,
      socialConfig: generatedConfig.social,
    }
  }
})

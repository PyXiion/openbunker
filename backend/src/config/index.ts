import * as fs from 'fs';
import * as toml from '@iarna/toml';
import { logger } from '../utils/logger';

export interface ServerConfig {
  compression_threshold: number;
  compression_level: number;
  compression_mem_level: number;
  rate_limit_window_ms: number;
  rate_limit_max: number;
  health_check_timeout_ms: number;
  server_timeout_ms: number;
  keep_alive_timeout_ms: number;
  headers_timeout_ms: number;
  graceful_shutdown_timeout_ms: number;
}

export interface DatabaseConfig {
  idle_timeout_ms: number;
  connection_timeout_ms: number;
  guest_profile_cleanup_days: number;
}

export interface ContentFilterConfig {
  cache_max: number;
  cache_ttl_ms: number;
}

export interface GameConfig {
  min_players: number;
  max_players: number;
  bunker_capacity_ratio: number;
  food_per_person: number;
  water_per_person: number;
  medicine_per_person: number;
  default_power: number;
}

export interface SocialConfig {
  telegram_url: string;
  discord_url: string;
}

export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  content_filter: ContentFilterConfig;
  game: GameConfig;
  social: SocialConfig;
}

const DEFAULT_CONFIG: Config = {
  server: {
    compression_threshold: 1024,
    compression_level: 3,
    compression_mem_level: 7,
    rate_limit_window_ms: 900000,
    rate_limit_max: 100,
    health_check_timeout_ms: 3000,
    server_timeout_ms: 30000,
    keep_alive_timeout_ms: 65000,
    headers_timeout_ms: 66000,
    graceful_shutdown_timeout_ms: 10000,
  },
  database: {
    idle_timeout_ms: 30000,
    connection_timeout_ms: 2000,
    guest_profile_cleanup_days: 30,
  },
  content_filter: {
    cache_max: 1000,
    cache_ttl_ms: 3600000,
  },
  game: {
    min_players: 2,
    max_players: 12,
    bunker_capacity_ratio: 0.4,
    food_per_person: 30,
    water_per_person: 30,
    medicine_per_person: 10,
    default_power: 100,
  },
  social: {
    telegram_url: 'https://t.me/PyXiion_channel',
    discord_url: 'https://discord.gg/KpAMMCdcrJ',
  },
};

let config: Config | null = null;

function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    server: { ...base.server, ...override.server },
    database: { ...base.database, ...override.database },
    content_filter: { ...base.content_filter, ...override.content_filter },
    game: { ...base.game, ...override.game },
    social: { ...base.social, ...override.social },
  };
}

export function loadConfig(): Config {
  if (config) {
    return config;
  }

  const configPath = process.env.BUNKER_CONFIG;
  
  logger.debug(`[CONFIG] BUNKER_CONFIG env var: ${configPath || 'not set'}`);
  
  if (!configPath) {
    logger.info('BUNKER_CONFIG not set, using default configuration');
    config = DEFAULT_CONFIG;
    return config;
  }

  if (!fs.existsSync(configPath)) {
    logger.warn(`Config file not found at ${configPath}, using default configuration`);
    config = DEFAULT_CONFIG;
    return config;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const parsed = toml.parse(configContent) as unknown as Partial<Config>;
    
    config = mergeConfig(DEFAULT_CONFIG, parsed);
    logger.info(`[CONFIG] Config loaded from ${configPath}`);
    logger.debug(`[CONFIG] Loaded config: ${JSON.stringify(config, null, 2)}`);
    return config;
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(`Failed to parse config file: ${error.message}, using default configuration`);
    } else {
      logger.warn('Failed to parse config file: Unknown error, using default configuration');
    }
    config = DEFAULT_CONFIG;
    return config;
  }
}

export function getConfig(): Config {
  if (!config) {
    return loadConfig();
  }
  return config;
}

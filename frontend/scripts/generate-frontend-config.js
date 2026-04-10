const fs = require('fs');
const path = require('path');
const toml = require('@iarna/toml');

const DEFAULT_CONFIG = {
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
  support: {
    report_bug_url: '',
    feature_request_url: '',
    faq_url: '',
  },
};

function mergeConfig(base, override) {
  const merged = { ...base };
  
  // Iterate over all keys in base and merge with override
  for (const key in base) {
    if (override[key]) {
      merged[key] = { ...base[key], ...override[key] };
    }
  }
  
  // Add any keys from override that aren't in base
  for (const key in override) {
    if (!base[key]) {
      merged[key] = override[key];
    }
  }
  
  return merged;
}

function loadConfig() {
  const configPath = process.env.BUNKER_CONFIG;
  
  console.log(`[CONFIG] BUNKER_CONFIG env var: ${configPath || 'not set'}`);
  
  if (!configPath) {
    console.log('BUNKER_CONFIG not set, using default configuration');
    return DEFAULT_CONFIG;
  }

  if (!fs.existsSync(configPath)) {
    console.warn(`Config file not found at ${configPath}, using default configuration`);
    return DEFAULT_CONFIG;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const parsed = toml.parse(configContent);
    
    const merged = mergeConfig(DEFAULT_CONFIG, parsed);
    console.log(`[CONFIG] Config loaded from ${configPath}`);
    console.log(`[CONFIG] Loaded config: ${JSON.stringify(merged, null, 2)}`);
    return merged;
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`Failed to parse config file: ${error.message}, using default configuration`);
    } else {
      console.warn('Failed to parse config file: Unknown error, using default configuration');
    }
    return DEFAULT_CONFIG;
  }
}

function main() {
  const config = loadConfig();
  
  // Generate frontend-specific config (include all sections)
  const frontendConfig = { ...config };
  
  // Write to frontend config directory
  const outputDir = path.join(process.cwd(), 'config');
  const outputFile = path.join(outputDir, 'generated.json');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputFile, JSON.stringify(frontendConfig, null, 2), 'utf-8');
  console.log(`Frontend config generated at ${outputFile}`);
}

main();

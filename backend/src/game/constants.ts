import { getConfig } from '../config';

const config = getConfig();

export const GAME_CONSTANTS = {
  MIN_PLAYERS_TO_START: config.game.min_players,
  MAX_PLAYERS: config.game.max_players,
  DEFAULT_BUNKER_CAPACITY_RATIO: config.game.bunker_capacity_ratio,
} as const;

export const BUNKER_RESOURCES = {
  FOOD_PER_PERSON: config.game.food_per_person,
  WATER_PER_PERSON: config.game.water_per_person,
  MEDICINE_PER_PERSON: config.game.medicine_per_person,
  DEFAULT_POWER: config.game.default_power,
} as const;

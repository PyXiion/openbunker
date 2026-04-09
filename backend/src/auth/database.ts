import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { getConfig } from '../config';

let pool: Pool;

export interface Profile {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  is_guest: boolean;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

export interface UserStats {
  profile_id: string;
  games_played: number;
  games_won: number;
  total_playtime_minutes: number;
  bunker_survival_rate: number;
}

export function initializeDatabase(): Pool {
  if (!pool) {
    const host = process.env.DATABASE_HOST || 'localhost';
    const port = parseInt(process.env.DATABASE_PORT || '5432', 10);
    const database = process.env.DATABASE_NAME || 'bunker';
    const user = process.env.DATABASE_USER || 'postgres';
    const password = process.env.DATABASE_PASSWORD || 'postgres';
    const config = getConfig();

    logger.info(`Initializing database connection: host=${host}, port=${port}, database=${database}, user=${user}`);
    
    pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      max: parseInt(process.env.DATABASE_POOL_SIZE || '50', 10),
      idleTimeoutMillis: config.database.idle_timeout_ms,
      connectionTimeoutMillis: config.database.connection_timeout_ms,
    });
  }
  return pool;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = initializeDatabase();
  const result = await db.query(
    'SELECT * FROM profiles WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

export async function createProfile(profile: Omit<Profile, 'created_at' | 'updated_at'>): Promise<Profile> {
  const db = initializeDatabase();
  const result = await db.query(
    `INSERT INTO profiles (id, username, email, avatar_url, is_guest, last_login)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      avatar_url = EXCLUDED.avatar_url,
      is_guest = EXCLUDED.is_guest,
      last_login = EXCLUDED.last_login
    RETURNING *`,
    [profile.id, profile.username, profile.email, profile.avatar_url, profile.is_guest, profile.last_login]
  );
  return result.rows[0];
}

export async function updateProfile(userId: string, updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>): Promise<Profile | null> {
  const db = initializeDatabase();
  
  // Whitelist of allowed column names to prevent SQL injection
  const allowedColumns = ['username', 'email', 'avatar_url', 'is_guest', 'last_login'];
  
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && allowedColumns.includes(key)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return null;

  values.push(userId);
  const result = await db.query(
    `UPDATE profiles SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function getUserStats(userId: string): Promise<UserStats | null> {
  const db = initializeDatabase();
  const result = await db.query(
    'SELECT * FROM user_stats WHERE profile_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

export async function createOrUpdateUserStats(userId: string): Promise<UserStats> {
  const db = initializeDatabase();
  const result = await db.query(
    'SELECT * FROM get_or_create_user_stats($1)',
    [userId]
  );
  return result.rows[0];
}

export async function recordGameHistory(gameData: {
  room_id: string;
  profile_id: string;
  player_name: string;
  game_status: string;
  was_exiled: boolean;
  survived: boolean;
  final_round?: number;
  players_count: number;
  bunker_capacity: number;
  catastrophe_id?: string;
  duration_minutes?: number;
}): Promise<void> {
  const db = initializeDatabase();
  
  // Start transaction
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Insert game history
    const gameResult = await client.query(
      `INSERT INTO game_history 
       (room_id, profile_id, player_name, game_status, was_exiled, survived, final_round, players_count, bunker_capacity, catastrophe_id, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        gameData.room_id,
        gameData.profile_id,
        gameData.player_name,
        gameData.game_status,
        gameData.was_exiled,
        gameData.survived,
        gameData.final_round,
        gameData.players_count,
        gameData.bunker_capacity,
        gameData.catastrophe_id,
        gameData.duration_minutes
      ]
    );
    
    const gameId = gameResult.rows[0].id;
    
    // Update user stats
    await client.query(
      `UPDATE user_stats 
       SET games_played = games_played + 1,
           games_won = games_won + $1,
           total_playtime_minutes = total_playtime_minutes + $2,
           bunker_survival_rate = ROUND(
             (SELECT COUNT(*) FROM game_history WHERE profile_id = $3 AND survived = true) * 100.0 / 
             NULLIF((SELECT COUNT(*) FROM game_history WHERE profile_id = $3), 0), 2
           )
       WHERE profile_id = $3`,
      [gameData.survived ? 1 : 0, gameData.duration_minutes || 0, gameData.profile_id]
    );
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupOldGuestProfiles(daysOld?: number): Promise<number> {
  const config = getConfig();
  const cleanupDays = daysOld ?? config.database.guest_profile_cleanup_days;
  const db = initializeDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);
  
  const result = await db.query(
    'DELETE FROM profiles WHERE is_guest = true AND last_login < $1',
    [cutoffDate]
  );
  
  return result.rowCount || 0;
}

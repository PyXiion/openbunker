import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../utils/logger';
import { getConfig } from '../config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
}

export interface UserStats {
  profileId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalPlaytimeMinutes: number;
  bunkerSurvivalRate: number;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
    });
    return profile;
  } catch (error) {
    logger.error('Error fetching profile:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function createProfile(profile: Omit<Profile, 'createdAt' | 'updatedAt'>): Promise<Profile> {
  try {
    const created = await prisma.profile.upsert({
      where: { id: profile.id },
      update: {
        username: profile.username,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        isGuest: profile.isGuest,
        lastLogin: profile.lastLogin,
      },
      create: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        isGuest: profile.isGuest,
        lastLogin: profile.lastLogin,
      },
    });
    return created;
  } catch (error) {
    logger.error('Error creating profile:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function updateProfile(userId: string, updates: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Profile | null> {
  try {
    const updated = await prisma.profile.update({
      where: { id: userId },
      data: updates,
    });
    return updated;
  } catch (error) {
    logger.error('Error updating profile:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function getUserStats(userId: string): Promise<UserStats | null> {
  try {
    const stats = await prisma.userStats.findUnique({
      where: { profileId: userId },
    });
    if (!stats) return null;
    return {
      ...stats,
      bunkerSurvivalRate: Number(stats.bunkerSurvivalRate),
    };
  } catch (error) {
    logger.error('Error fetching user stats:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function createOrUpdateUserStats(userId: string): Promise<UserStats> {
  try {
    const stats = await prisma.userStats.upsert({
      where: { profileId: userId },
      update: {},
      create: {
        profileId: userId,
      },
    });
    return {
      ...stats,
      bunkerSurvivalRate: Number(stats.bunkerSurvivalRate),
    };
  } catch (error) {
    logger.error('Error creating/updating user stats:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function recordGameHistory(gameData: {
  roomId: string;
  profileId: string;
  playerName: string;
  gameStatus: string;
  wasExiled: boolean;
  survived: boolean;
  finalRound?: number;
  playersCount: number;
  bunkerCapacity: number;
  catastropheId?: string;
  durationMinutes?: number;
}): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Insert game history
      await tx.gameHistory.create({
        data: {
          roomId: gameData.roomId,
          profileId: gameData.profileId,
          playerName: gameData.playerName,
          gameStatus: gameData.gameStatus,
          wasExiled: gameData.wasExiled,
          survived: gameData.survived,
          finalRound: gameData.finalRound,
          playersCount: gameData.playersCount,
          bunkerCapacity: gameData.bunkerCapacity,
          catastropheId: gameData.catastropheId,
          durationMinutes: gameData.durationMinutes,
        },
      });

      // Calculate new survival rate
      const allGames = await tx.gameHistory.findMany({
        where: { profileId: gameData.profileId },
      });

      const survivedGames = allGames.filter(g => g.survived).length;
      const survivalRate = allGames.length > 0 
        ? Number((survivedGames * 100.0 / allGames.length).toFixed(2))
        : 0;

      // Update user stats
      await tx.userStats.upsert({
        where: { profileId: gameData.profileId },
        update: {
          gamesPlayed: { increment: 1 },
          gamesWon: gameData.survived ? { increment: 1 } : undefined,
          totalPlaytimeMinutes: { increment: gameData.durationMinutes || 0 },
          bunkerSurvivalRate: survivalRate,
        },
        create: {
          profileId: gameData.profileId,
          gamesPlayed: 1,
          gamesWon: gameData.survived ? 1 : 0,
          totalPlaytimeMinutes: gameData.durationMinutes || 0,
          bunkerSurvivalRate: gameData.survived ? 100.00 : 0.00,
        },
      });
    });
  } catch (error) {
    logger.error('Error recording game history:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function cleanupOldGuestProfiles(daysOld?: number): Promise<number> {
  try {
    const config = getConfig();
    const cleanupDays = daysOld ?? config.database.guest_profile_cleanup_days;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);

    const result = await prisma.profile.deleteMany({
      where: {
        isGuest: true,
        lastLogin: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  } catch (error) {
    logger.error('Error cleaning up guest profiles:', { error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}

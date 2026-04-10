import express from 'express';
import { createProfile, updateProfile, getProfile, getGameHistory, getUserStats } from './database';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { casdoorService } from '../services/casdoorService';
import roomRoutes from './roomRoutes';

const router = express.Router();

// Mount room routes
router.use(roomRoutes);

// Helper function to authenticate REST requests
async function authenticateRequest(req: express.Request): Promise<{ userId: string; isGuest: boolean } | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const guestUserId = req.headers['x-guest-user-id'] as string;

  if (token) {
    // JWT authentication
    try {
      const user = await casdoorService.parseJwtToken(token);
      if (user && user.id) {
        return { userId: user.id, isGuest: false };
      }
    } catch (error) {
      logger.error('JWT authentication failed:', error);
    }
  } else if (guestUserId) {
    // Guest authentication
    const profile = await getProfile(guestUserId);
    if (profile && profile.isGuest) {
      return { userId: guestUserId, isGuest: true };
    }
  }

  return null;
}

// Validation schemas
const guestAuthSchema = z.object({
  username: z.string().min(1).max(50).trim()
});

const callbackSchema = z.object({
  code: z.string().min(1)
});

const upgradeSchema = z.object({
  shadowUserId: z.string().min(1),
  realToken: z.string().min(1)
});

const usernameSchema = z.object({
  username: z.string().min(1).max(50).trim()
});

// Guest authentication endpoint
router.post('/guest', async (req, res) => {
  try {
    const result = guestAuthSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid username', details: result.error.issues });
    }

    const { username } = result.data;

    // Generate a guest user ID
    const guestUserId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Persist guest profile to database immediately
    const profile = await createProfile({
      id: guestUserId,
      username: username,
      email: null,
      avatarUrl: null,
      isGuest: true,
      lastLogin: new Date(),
    });
    
    res.json({
      userId: guestUserId,
      username,
      isGuest: true,
    });
  } catch (error) {
    logger.error('Guest auth error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await casdoorService.parseJwtToken(token);
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    let profile = await getProfile(user.id);
    
    if (!profile) {
      // Create profile if it doesn't exist
      profile = await createProfile({
        id: user.id,
        username: user.name || user.displayName || 'Unknown',
        email: user.email ?? null,
        avatarUrl: user.avatar ?? null,
        isGuest: false,
        lastLogin: new Date(),
      });
    } else {
      // Update last login and verification status
      profile = await updateProfile(user.id, {
        lastLogin: new Date(),
        avatarUrl: user.avatar || profile.avatarUrl,
      });
    }

    res.json({
      profile,
      user: {
        userId: user.id,
        username: user.name,
        email: user.email,
        avatarUrl: user.avatar,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// OAuth callback endpoint - exchange code for token and sync with database
router.post('/callback', async (req, res) => {
  try {
    const result = callbackSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid authorization code', details: result.error.issues });
    }

    const { code } = result.data;

    const tokenResponse = await casdoorService.getAuthToken(code);
    
    const token = tokenResponse.access_token;
    
    if (!token) {
      console.error('Token is empty after extraction');
      return res.status(400).json({ error: 'Failed to get access token' });
    }

    // Parse JWT token to get user info
    const claims = await casdoorService.parseJwtToken(token) as any;
    
    // Casdoor JWT contains user info directly in claims, not nested User property
    const user = claims;
    
    if (!user || !user.id) {
      console.error('Failed to parse JWT token or missing user info');
      return res.status(400).json({ error: 'Failed to parse JWT token' });
    }

    // Get or create user profile
    let profile = await getProfile(user.id);
    
    if (!profile) {
      profile = await createProfile({
        id: user.id,
        username: user.name || user.displayName || 'Unknown',
        email: user.email,
        avatarUrl: user.avatar,
        isGuest: false,
        lastLogin: new Date(),
      });
    } else {
      profile = await updateProfile(user.id, {
        lastLogin: new Date(),
        avatarUrl: user.avatar || profile.avatarUrl,
      });
    }

    if (!profile) {
      return res.status(500).json({ error: 'Failed to create or update profile' });
    }

    res.json({
      userId: user.id,
      username: profile.username,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      token: token,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
});

// Link shadow user to real account (upgrade from guest)
router.post('/upgrade', async (req, res) => {
  try {
    const result = upgradeSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid upgrade data', details: result.error.issues });
    }

    const { shadowUserId, realToken } = result.data;

    const realUser = await casdoorService.parseJwtToken(realToken);
    
    if (!realUser || !realUser.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Update profile to mark as not a guest
    const profile = await updateProfile(shadowUserId, {
      isGuest: false,
      email: realUser.email,
      avatarUrl: realUser.avatar,
    });

    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Account upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade account' });
  }
});

// Update username endpoint
router.put('/username', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const result = usernameSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid username', details: result.error.issues });
    }

    const { username } = result.data;

    const user = await casdoorService.parseJwtToken(token);
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Update Casdoor first (IdP is source of truth)
    try {
      await casdoorService.updateUser({
        id: user.id,
        name: username.trim(),
      });
    } catch (casdoorError) {
      logger.error('Failed to update Casdoor username:', { error: casdoorError instanceof Error ? casdoorError.message : String(casdoorError) });
      return res.status(500).json({ error: 'Failed to update username in Casdoor' });
    }
    
    // Update local database after Casdoor succeeds
    const profile = await updateProfile(user.id, {
      username: username.trim(),
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      username: profile.username,
    });
  } catch (error) {
    console.error('Username update error:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// Casdoor webhook endpoint for bidirectional sync (Casdoor → DB)
router.post('/casdoor/webhook', async (req, res) => {
  try {
    const { eventType, user } = req.body;

    if (!user || !user.id) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Handle user update events
    if (eventType === 'updateUser') {
      const profile = await getProfile(user.id);

      if (profile) {
        // Sync username, email, avatar from Casdoor
        await updateProfile(user.id, {
          username: user.name || profile.username,
          email: user.email,
          avatarUrl: user.avatar,
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Casdoor webhook error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Get game history for authenticated user
router.get('/game-history', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await casdoorService.parseJwtToken(token);

    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const history = await getGameHistory(user.id, limit);

    res.json({ history });
  } catch (error) {
    logger.error('Game history fetch error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

// Get user statistics for authenticated user
router.get('/stats', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await casdoorService.parseJwtToken(token);

    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const stats = await getUserStats(user.id);

    res.json({ stats });
  } catch (error) {
    logger.error('User stats fetch error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

export default router;

import express from 'express';
import * as CasdoorSDK from 'casdoor-nodejs-sdk';
import { createProfile, updateProfile, getProfile } from './database';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = express.Router();

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

// Initialize Casdoor SDK lazily to ensure environment variables are loaded
let casdoorInstance: any = null;

function getCasdoor() {
  if (!casdoorInstance) {
    const certificate = process.env.CASDOOR_CERT || '';

    const cleanedCert = certificate
      .split(/\\n|\n/)
      .map(line => line.trim())
      .join('\n');

    const requiredEnvVars = [
      'CASDOOR_URL',
      'CASDOOR_CLIENT_ID',
      'CASDOOR_CLIENT_SECRET',
      'CASDOOR_CERT',
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required Casdoor environment variables: ${missingEnvVars.join(', ')}`);
    }

    const casdoorConfig = {
      endpoint: process.env.CASDOOR_URL || process.env.CASDOOR_ENDPOINT || 'http://localhost:8000',
      clientId: process.env.CASDOOR_CLIENT_ID || '',
      clientSecret: process.env.CASDOOR_CLIENT_SECRET || '',
      appName: process.env.CASDOOR_APP_NAME || 'bunker',
      orgName: process.env.CASDOOR_ORG_NAME || 'bunker',
      certificate: cleanedCert,
    };

    casdoorInstance = new CasdoorSDK.SDK(casdoorConfig);
  }
  return casdoorInstance;
}

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

    const casdoor = getCasdoor();
    const user = await casdoor.parseJwtToken(token);
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    let profile = await getProfile(user.id);
    
    if (!profile) {
      // Create profile if it doesn't exist
      profile = await createProfile({
        id: user.id,
        username: user.name || user.displayName || 'Unknown',
        email: user.email,
        avatar_url: user.avatar,
        is_guest: false,
        last_login: new Date(),
      });
    } else {
      // Update last login and verification status
      profile = await updateProfile(user.id, {
        last_login: new Date(),
        avatar_url: user.avatar || profile.avatar_url,
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

    const casdoor = getCasdoor();
    const tokenResponse = await casdoor.getAuthToken(code);
    
    const token = tokenResponse.access_token;
    
    if (!token) {
      console.error('Token is empty after extraction');
      return res.status(400).json({ error: 'Failed to get access token' });
    }

    // Parse JWT token to get user info
    const claims = casdoor.parseJwtToken(token) as any;
    
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
        avatar_url: user.avatar,
        is_guest: false,
        last_login: new Date(),
      });
    } else {
      profile = await updateProfile(user.id, {
        last_login: new Date(),
        avatar_url: user.avatar || profile.avatar_url,
      });
    }

    if (!profile) {
      return res.status(500).json({ error: 'Failed to create or update profile' });
    }

    res.json({
      userId: user.id,
      username: profile.username,
      email: profile.email,
      avatarUrl: profile.avatar_url,
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

    const casdoor = getCasdoor();
    const realUser = await casdoor.parseJwtToken(realToken);
    
    if (!realUser || !realUser.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Update profile to mark as not a guest
    const profile = await updateProfile(shadowUserId, {
      is_guest: false,
      email: realUser.email,
      avatar_url: realUser.avatar,
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

    const casdoor = getCasdoor();
    const user = await casdoor.parseJwtToken(token);
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Update profile in database
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

export default router;

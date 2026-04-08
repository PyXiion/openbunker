import express from 'express';
import { getZitadelClient, getServiceAccount } from './zitadel';
import { createProfile, updateProfile, getProfile } from './database';

const router = express.Router();

// Guest authentication endpoint
router.post('/guest', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Generate a guest user ID
    const guestUserId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    res.json({
      userId: guestUserId,
      username: username.trim(),
      isGuest: true,
    });
  } catch (error) {
    console.error('Guest auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create shadow user via Zitadel service account
router.post('/shadow-user', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const zitadelClient = getZitadelClient();
    const serviceAccount = getServiceAccount();
    
    // Create shadow user in Zitadel
    const shadowUserId = await zitadelClient.createShadowUser(username.trim(), serviceAccount);
    
    // Exchange service account token for user token
    const userToken = await zitadelClient.exchangeServiceAccountToken(serviceAccount, shadowUserId);
    
    // Create profile in our database
    await createProfile({
      id: shadowUserId,
      username: username.trim(),
      is_guest: true,
      is_verified: false,
      last_login: new Date(),
    });

    res.json({
      userId: shadowUserId,
      username: username.trim(),
      token: userToken,
      isGuest: true,
    });
  } catch (error) {
    console.error('Shadow user creation error:', error);
    res.status(500).json({ error: 'Failed to create shadow user' });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const zitadelClient = getZitadelClient();
    const user = await zitadelClient.verifyToken(token);
    
    let profile = await getProfile(user.userId);
    
    if (!profile) {
      // Create profile if it doesn't exist
      profile = await createProfile({
        id: user.userId,
        username: user.displayName || user.loginName || 'Unknown',
        email: user.email,
        avatar_url: user.avatarUrl,
        is_guest: false,
        is_verified: user.isEmailVerified,
        last_login: new Date(),
      });
    } else {
      // Update last login and verification status
      profile = await updateProfile(user.userId, {
        last_login: new Date(),
        is_verified: user.isEmailVerified,
        avatar_url: user.avatarUrl || profile.avatar_url,
      });
    }

    res.json({
      profile,
      user: {
        userId: user.userId,
        loginName: user.loginName,
        displayName: user.displayName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Link shadow user to real account (upgrade from guest)
router.post('/upgrade', async (req, res) => {
  try {
    const { shadowUserId, realToken } = req.body;
    
    if (!shadowUserId || !realToken) {
      return res.status(400).json({ error: 'shadowUserId and realToken are required' });
    }

    const zitadelClient = getZitadelClient();
    const serviceAccount = getServiceAccount();
    
    // Verify the real user token
    const realUser = await zitadelClient.verifyToken(realToken);
    
    // Link shadow user to real account
    await zitadelClient.linkShadowUserToRealAccount(shadowUserId, realUser.userId, serviceAccount);
    
    // Update profile to mark as verified and not a guest
    const profile = await updateProfile(shadowUserId, {
      is_guest: false,
      is_verified: realUser.isEmailVerified,
      email: realUser.email,
      avatar_url: realUser.avatarUrl,
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

export default router;

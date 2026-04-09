import { ref, computed } from 'vue';
import { logger } from '../utils/logger';
import CasdoorSDK from 'casdoor-js-sdk';

export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  isGuest: boolean;
  isVerified: boolean;
  avatarUrl?: string;
  token?: string;
}

export interface GuestUser {
  userId: string;
  username: string;
  isGuest: true;
}

export class AuthService {
  public currentUser = ref<AuthUser | null>(null);
  public guestUser = ref<GuestUser | null>(null);
  public isAuthenticated: ComputedRef<boolean>;
  public isGuest: ComputedRef<boolean>;
  private config: any;
  private isInitialized = false;
  private casdoor: CasdoorSDK | null = null;

  constructor(config: any) {
    this.config = config;
    this.isAuthenticated = computed(() => !!this.currentUser.value && !this.currentUser.value.isGuest);
    this.isGuest = computed(() => !!this.guestUser.value);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    logger.log('AuthService: Initializing...');
    
    if (!import.meta.client) {
      logger.log('AuthService: Skipping initialization on server');
      return;
    }
    
    // Initialize Casdoor SDK
    this.initCasdoor();
    
    // Try to restore from localStorage
    this.restoreFromStorage();
    this.isInitialized = true;
    
    logger.log('AuthService: Initialization complete');
    logger.log('- currentUser:', this.currentUser.value);
    logger.log('- guestUser:', this.guestUser.value);
  }

  private initCasdoor(): void {
    const casdoorUrl = this.config.public.casdoorUrl;
    const clientId = this.config.public.casdoorClientId;
    
    if (!casdoorUrl || !clientId) {
      logger.warn('Casdoor not configured');
      return;
    }

    this.casdoor = new CasdoorSDK({
      serverUrl: casdoorUrl,
      clientId: clientId,
      appName: this.config.public.casdoorAppName || 'bunker',
      orgName: this.config.public.casdoorOrgName || 'bunker',
      redirectPath: `${window.location.origin}/auth/callback`,
    });
  }

  private restoreFromStorage(): void {
    logger.log('AuthService: Restoring from storage...');
    try {
      // Try auth user first
      const storedUser = localStorage.getItem('authUser');
      logger.log('AuthService: Found stored user:', !!storedUser);
      if (storedUser) {
        const user = JSON.parse(storedUser);
        this.currentUser.value = user;
        logger.log('AuthService: Restored user:', user);
        return;
      }

      // Try guest user
      const storedGuest = localStorage.getItem('guestUser');
      logger.log('AuthService: Found stored guest:', !!storedGuest);
      if (storedGuest) {
        const guest = JSON.parse(storedGuest);
        this.guestUser.value = guest;
        logger.log('AuthService: Restored guest:', guest);
        return;
      }
      
      logger.log('AuthService: No stored auth data found');
    } catch (error) {
      logger.error('AuthService: Failed to restore auth state:', error);
      this.clearStorage();
    }
  }

  private saveToStorage(): void {
    if (!import.meta.client) return;
    
    if (this.currentUser.value) {
      localStorage.setItem('authUser', JSON.stringify(this.currentUser.value));
      localStorage.removeItem('guestUser');
    } else if (this.guestUser.value) {
      localStorage.setItem('guestUser', JSON.stringify(this.guestUser.value));
      localStorage.removeItem('authUser');
    }
  }

  private clearStorage(): void {
    if (!import.meta.client) return;
    localStorage.removeItem('authUser');
    localStorage.removeItem('guestUser');
  }

  async login(): Promise<void> {
    if (!this.casdoor) {
      throw new Error('Casdoor not configured');
    }
    
    window.location.href = this.casdoor.getSigninUrl();
  }

  async handleCallback(): Promise<void> {
    if (!import.meta.client) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const isUpgrade = localStorage.getItem('pendingUpgrade') === 'true';
    
    if (error) {
      logger.error('OAuth callback error:', error);
      this.clearSession();
      return;
    }
    
    if (code && this.casdoor) {
      try {
        // Get the code and state from URL
        // Exchange authorization code for token via backend
        const response = await fetch(`${this.config.public.backendUrl}/api/auth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code,
            state,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to exchange authorization code');
        }
        
        const userData = await response.json();
        
        // Check if this is an upgrade flow
        if (isUpgrade) {
          await this.completeUpgrade(userData.token);
        } else {
          const authUser: AuthUser = {
            userId: userData.userId,
            username: userData.username,
            email: userData.email,
            isGuest: false,
            isVerified: false,
            avatarUrl: userData.avatarUrl,
            token: userData.token,
          };
          
          this.currentUser.value = authUser;
          this.guestUser.value = null;
          this.saveToStorage();
        }
        
        logger.log('OAuth callback successful');
      } catch (error) {
        console.error('OAuth callback error:', error);
        this.clearSession();
        throw error;
      }
    } else {
      console.warn('No authorization code found in callback');
      this.clearSession();
    }
  }

  async createGuestUser(username: string): Promise<GuestUser> {
    try {
      const response = await fetch(`${this.config.public.backendUrl}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error('Failed to create guest user');
      }

      const guestData = await response.json();
      this.guestUser.value = {
        userId: guestData.userId,
        username: guestData.username,
        isGuest: true,
      };
      this.currentUser.value = null;
      this.saveToStorage();
      
      return guestData;
    } catch (error) {
      logger.error('Guest user creation error:', error);
      throw error;
    }
  }

  logout(): void {
    // Clear local session
    this.clearSession();
    
    // Redirect to home page
    window.location.href = '/';
  }

  clearSession(): void {
    this.currentUser.value = null;
    this.guestUser.value = null;
    this.clearStorage();
  }

  getAuthToken(): string | null {
    return this.currentUser.value?.token || null;
  }

  // Legacy methods for compatibility
  isAuthenticatedMethod(): boolean {
    return this.isAuthenticated.value;
  }

  isGuestMethod(): boolean {
    return this.isGuest.value;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser.value;
  }

  getGuestUser(): GuestUser | null {
    return this.guestUser.value;
  }

  async restoreSession(): Promise<void> {
    await this.initialize();
  }

  // Placeholder methods for unused functionality
  async loginWithPopup(): Promise<void> {
    throw new Error('Not implemented');
  }

  async handleSilentCallback(): Promise<void> {
    logger.log('Silent callback handled (no-op)');
  }

  async createShadowUser(): Promise<AuthUser> {
    throw new Error('Not implemented');
  }

  async upgradeGuestAccount(): Promise<void> {
    const shadowUserId = this.guestUser.value?.userId;
    if (!shadowUserId) {
      throw new Error('No guest user to upgrade');
    }

    // Store shadow user ID and upgrade flag in localStorage for after OAuth callback
    localStorage.setItem('pendingUpgradeShadowUserId', shadowUserId);
    localStorage.setItem('pendingUpgrade', 'true');

    // Redirect to Casdoor login
    if (!this.casdoor) {
      throw new Error('Casdoor not configured');
    }

    window.location.href = this.casdoor.getSigninUrl();
  }

  async completeUpgrade(realToken: string): Promise<void> {
    const shadowUserId = localStorage.getItem('pendingUpgradeShadowUserId');
    if (!shadowUserId) {
      throw new Error('No pending upgrade found');
    }

    try {
      const response = await fetch(`${this.config.public.backendUrl}/api/auth/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shadowUserId, realToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade account');
      }

      const result = await response.json();

      // Clear pending upgrade flags
      localStorage.removeItem('pendingUpgradeShadowUserId');
      localStorage.removeItem('pendingUpgrade');

      // Update auth state with the upgraded user
      const authUser: AuthUser = {
        userId: shadowUserId,
        username: this.guestUser.value?.username || '',
        email: result.profile.email,
        isGuest: false,
        isVerified: result.profile.is_verified,
        avatarUrl: result.profile.avatar_url,
        token: realToken,
      };

      this.currentUser.value = authUser;
      this.guestUser.value = null;
      this.saveToStorage();
    } catch (error) {
      logger.error('Account upgrade completion error:', error);
      throw error;
    }
  }

  async getGameHistory(limit: number = 20): Promise<any[]> {
    logger.log('AuthService.getGameHistory called');
    const token = this.getAuthToken();
    if (!token) {
      logger.error('AuthService.getGameHistory: No token found');
      throw new Error('Not authenticated');
    }

    logger.log(`AuthService.getGameHistory: Fetching from ${this.config.public.backendUrl}/api/auth/game-history?limit=${limit}`);
    const response = await fetch(`${this.config.public.backendUrl}/api/auth/game-history?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    logger.log(`AuthService.getGameHistory: Response status ${response.status}`);
    if (!response.ok) {
      logger.error('AuthService.getGameHistory: Failed to fetch');
      throw new Error('Failed to fetch game history');
    }

    const result = await response.json();
    logger.log(`AuthService.getGameHistory: Received ${result.history?.length || 0} game history records`);
    return result.history || [];
  }
}

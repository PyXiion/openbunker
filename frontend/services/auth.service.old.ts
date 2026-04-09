import { UserManager, User } from 'oidc-client-ts';
import { ref } from 'vue';

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
  private userManager: UserManager | null = null;
  public currentUser = ref<AuthUser | null>(null);
  public guestUser = ref<GuestUser | null>(null);
  private config: any;

  constructor(config: any) {
    this.config = config;
    if (import.meta.client) {
      this.initializeUserManager();
    }
  }

  private initializeUserManager() {
    if (this.config.public.zitadelUrl && this.config.public.zitadelClientId) {
      this.userManager = new UserManager({
        authority: this.config.public.zitadelUrl,
        client_id: this.config.public.zitadelClientId,
        redirect_uri: `${window.location.origin}/auth/callback`,
        post_logout_redirect_uri: `${window.location.origin}/`,
        response_type: 'code',
        scope: 'openid profile email',
        automaticSilentRenew: true,
        silent_redirect_uri: `${window.location.origin}/auth/silent-callback`,
      });

      this.userManager.events.addUserLoaded((user) => this.setCurrentUser(user));
      this.userManager.events.addUserUnloaded(() => { this.currentUser.value = null; });
    }
  }

  private setCurrentUser(user: User | null) {
    if (user) {
      this.currentUser.value = {
        userId: user.profile.sub || '',
        username: user.profile.preferred_username || user.profile.name || 'Unknown',
        email: user.profile.email,
        isGuest: false,
        isVerified: user.profile.email_verified || false,
        avatarUrl: user.profile.picture,
        token: user.access_token,
      };
    } else {
      this.currentUser.value = null;
    }
  }

  async login(): Promise<void> {
    if (!this.userManager) {
      throw new Error('User manager not initialized');
    }
    await this.userManager.signinRedirect();
  }

  async loginWithPopup(): Promise<void> {
    if (!this.userManager) {
      throw new Error('User manager not initialized');
    }
    await this.userManager.signinPopup();
  }

  async logout(): Promise<void> {
    if (this.userManager) {
      await this.userManager.signoutRedirect();
    }
    this.currentUser.value = null;
    this.guestUser.value = null;
    if (import.meta.client) {
      localStorage.removeItem('guestUser');
    }
  }

  async handleCallback(): Promise<void> {
    if (!this.userManager) {
      throw new Error('User manager not initialized');
    }
    
    try {
      const user = await this.userManager.signinRedirectCallback();
      this.setCurrentUser(user);
      
      // Clear any guest session
      this.guestUser.value = null;
      if (import.meta.client) {
        localStorage.removeItem('guestUser');
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      throw error;
    }
  }

  async handleSilentCallback(): Promise<void> {
    if (!this.userManager) {
      throw new Error('User manager not initialized');
    }
    
    try {
      await this.userManager.signinSilentCallback();
      const user = await this.userManager.getUser();
      this.setCurrentUser(user);
    } catch (error) {
      console.error('Silent callback error:', error);
    }
  }

  async createGuestUser(username: string): Promise<GuestUser> {
    try {
      const response = await fetch(`${this.config.public.backendUrl}/auth/guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error('Failed to create guest user');
      }

      const guestData = await response.json();
      this.guestUser.value = guestData;
      
      // Store guest user in localStorage for persistence
      if (import.meta.client) {
        localStorage.setItem('guestUser', JSON.stringify(guestData));
      }
      
      return guestData;
    } catch (error) {
      console.error('Guest user creation error:', error);
      throw error;
    }
  }

  async createShadowUser(username: string): Promise<AuthUser> {
    try {
      const response = await fetch(`${this.config.public.backendUrl}/auth/shadow-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error('Failed to create shadow user');
      }

      const userData = await response.json();
      const authUser: AuthUser = {
        userId: userData.userId,
        username: userData.username,
        isGuest: userData.isGuest,
        isVerified: false,
        token: userData.token,
      };

      this.currentUser.value = authUser;
      
      // Store user in localStorage
      if (import.meta.client) {
        localStorage.setItem('authUser', JSON.stringify(authUser));
      }
      
      return authUser;
    } catch (error) {
      console.error('Shadow user creation error:', error);
      throw error;
    }
  }

  async upgradeGuestAccount(realToken: string): Promise<void> {
    if (!this.guestUser.value) {
      throw new Error('No guest user to upgrade');
    }

    try {
      const response = await fetch(`${this.config.public.backendUrl}/auth/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shadowUserId: this.guestUser.value.userId,
          realToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade account');
      }

      // Clear guest session
      this.guestUser.value = null;
      if (import.meta.client) {
        localStorage.removeItem('guestUser');
      }
      
      // Get the real user info
      await this.loadUserProfile(realToken);
    } catch (error) {
      console.error('Account upgrade error:', error);
      throw error;
    }
  }

  private async loadUserProfile(token: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.public.backendUrl}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load user profile');
      }

      const data = await response.json();
      this.currentUser.value = {
        userId: data.user.userId,
        username: data.user.displayName || data.user.loginName,
        email: data.user.email,
        isGuest: false,
        isVerified: data.user.isEmailVerified,
        avatarUrl: data.user.avatarUrl,
        token,
      };
      
      if (import.meta.client) {
        localStorage.setItem('authUser', JSON.stringify(this.currentUser.value));
      }
    } catch (error) {
      console.error('Profile load error:', error);
      throw error;
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser.value;
  }

  getGuestUser(): GuestUser | null {
    return this.guestUser.value;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser.value && !this.currentUser.value.isGuest;
  }

  isGuest(): boolean {
    return !!this.guestUser.value || (this.currentUser.value?.isGuest ?? false);
  }

  getAuthToken(): string | null {
    return this.currentUser.value?.token || null;
  }

  async restoreSession(): Promise<void> {
    // Only run on client-side
    if (!import.meta.client) {
      return;
    }

    // Try to restore authenticated user session
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.currentUser.value = user;
        
        // Validate token is still valid
        if (this.userManager && user.token) {
          try {
            const oidcUser = await this.userManager.getUser();
            if (oidcUser) {
              this.setCurrentUser(oidcUser);
            } else {
              // Token expired, clear session
              this.currentUser.value = null;
              localStorage.removeItem('authUser');
            }
          } catch (error) {
            console.error('Failed to validate token:', error);
            // Token validation failed, clear session
            this.currentUser.value = null;
            localStorage.removeItem('authUser');
          }
        }
      } catch (error) {
        console.error('Failed to restore user session:', error);
        throw error;
      }
    }

    // Try to restore guest session
    const storedGuest = localStorage.getItem('guestUser');
    if (storedGuest && !this.currentUser.value) {
      try {
        const guest = JSON.parse(storedGuest);
        this.guestUser.value = guest;
      } catch (error) {
        console.error('Failed to restore guest session:', error);
        localStorage.removeItem('guestUser');
      }
    }
  }

  clearSession(): void {
    this.currentUser.value = null;
    this.guestUser.value = null;
    if (import.meta.client) {
      localStorage.removeItem('authUser');
      localStorage.removeItem('guestUser');
    }
  }
}

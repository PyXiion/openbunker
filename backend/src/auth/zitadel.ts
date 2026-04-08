import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import fetch from 'node-fetch';

export interface ZitadelUser {
  userId: string;
  loginName: string;
  displayName?: string;
  email?: string;
  isEmailVerified: boolean;
  phone?: string;
  isPhoneVerified: boolean;
  preferredLoginName?: string;
  gender?: string;
  avatarUrl?: string;
  nickName?: string;
  givenName?: string;
  familyName?: string;
  formattedName?: string;
  locale?: string;
  accessToken?: string;
}

export interface ZitadelServiceAccount {
  userId: string;
  keyId: string;
  key: string;
  projectId: string;
}

interface CreateUserResponse {
  userId: string;
}

interface TokenExchangeResponse {
  access_token: string;
}

interface ServiceAccountTokenResponse {
  access_token: string;
}

class ZitadelClient {
  private jwksCache: any = null;
  private jwksCacheExpiry: number = 0;
  private readonly JWKS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly zitadelUrl: string,
    private readonly projectId: string
  ) {}

  private async getJWKS(): Promise<any> {
    const now = Date.now();
    
    // Return cached JWKS if still valid
    if (this.jwksCache && now < this.jwksCacheExpiry) {
      return this.jwksCache;
    }

    try {
      const response = await fetch(`${this.zitadelUrl}/oauth/v2/keys`);
      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
      }
      
      const jwks = await response.json();
      this.jwksCache = createRemoteJWKSet(new URL(`${this.zitadelUrl}/oauth/v2/keys`));
      this.jwksCacheExpiry = now + this.JWKS_CACHE_TTL;
      
      return this.jwksCache;
    } catch (error) {
      console.error('Error fetching JWKS:', error);
      throw error;
    }
  }

  async verifyToken(token: string): Promise<JWTPayload & ZitadelUser> {
    try {
      const jwks = await this.getJWKS();
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${this.zitadelUrl}`,
        audience: this.projectId,
      });

      return payload as JWTPayload & ZitadelUser;
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new Error('Invalid token');
    }
  }

  async createShadowUser(username: string, serviceAccount: ZitadelServiceAccount): Promise<string> {
    try {
      // Get service account token
      const serviceToken = await this.getServiceAccountToken(serviceAccount);
      
      // Create human user (shadow user) without password
      const response = await fetch(`${this.zitadelUrl}/management/v1/users/human`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: username,
          profile: {
            displayName: username,
            givenName: 'Guest',
            familyName: 'User',
          },
          email: {
            email: `${username}@guest.bunker.local`,
            isEmailVerified: false,
          },
          password: {
            password: '',
            changeRequired: false,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create shadow user: ${error}`);
      }

      const result = await response.json() as CreateUserResponse;
      return result.userId;
    } catch (error) {
      console.error('Error creating shadow user:', error);
      throw error;
    }
  }

  async exchangeServiceAccountToken(
    serviceAccount: ZitadelServiceAccount,
    targetUserId: string
  ): Promise<string> {
    try {
      // Get service account token
      const serviceToken = await this.getServiceAccountToken(serviceAccount);
      
      // Exchange for user token
      const response = await fetch(`${this.zitadelUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: serviceToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
          scope: 'openid profile email',
          requested_subject: targetUserId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const result = await response.json() as TokenExchangeResponse;
      return result.access_token;
    } catch (error) {
      console.error('Error exchanging service account token:', error);
      throw error;
    }
  }

  private async getServiceAccountToken(serviceAccount: ZitadelServiceAccount): Promise<string> {
    try {
      const response = await fetch(`${this.zitadelUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: serviceAccount.userId,
          client_secret: serviceAccount.key,
          scope: 'openid urn:zitadel:iam:org:project:id:zitadel:aud',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Service account auth failed: ${error}`);
      }

      const result = await response.json() as ServiceAccountTokenResponse;
      return result.access_token;
    } catch (error) {
      console.error('Error getting service account token:', error);
      throw error;
    }
  }

  async linkShadowUserToRealAccount(
    shadowUserId: string,
    realUserId: string,
    serviceAccount: ZitadelServiceAccount
  ): Promise<void> {
    try {
      const serviceToken = await this.getServiceAccountToken(serviceAccount);
      
      // This would typically involve Zitadel's user linking functionality
      // For now, we'll handle this at the application level by updating the profile
      console.log(`Linking shadow user ${shadowUserId} to real account ${realUserId}`);
      
      // In a real implementation, you might use Zitadel's user management APIs
      // to properly merge or link the accounts
      
    } catch (error) {
      console.error('Error linking shadow user to real account:', error);
      throw error;
    }
  }
}

// Singleton instance
let zitadelClient: ZitadelClient | null = null;

export function getZitadelClient(): ZitadelClient {
  if (!zitadelClient) {
    const zitadelUrl = process.env.ZITADEL_URL || 'http://localhost:8080';
    const projectId = process.env.ZITADEL_PROJECT_ID || 'your-project-id';
    
    zitadelClient = new ZitadelClient(zitadelUrl, projectId);
  }
  
  return zitadelClient;
}

export function getServiceAccount(): ZitadelServiceAccount {
  const userId = process.env.ZITADEL_SERVICE_USER_ID;
  const keyId = process.env.ZITADEL_SERVICE_KEY_ID;
  const key = process.env.ZITADEL_SERVICE_KEY;
  const projectId = process.env.ZITADEL_PROJECT_ID || 'your-project-id';
  
  if (!userId || !keyId || !key) {
    throw new Error('Missing Zitadel service account configuration');
  }
  
  return {
    userId,
    keyId,
    key,
    projectId,
  };
}

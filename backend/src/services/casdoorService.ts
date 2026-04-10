import * as CasdoorSDK from 'casdoor-nodejs-sdk';
import { logger } from '../utils/logger';

/**
 * Casdoor service for authentication operations.
 * Provides singleton access to Casdoor SDK with validated configuration.
 */
class CasdoorService {
  private instance: CasdoorSDK.SDK | null = null;

  /**
   * Initializes Casdoor SDK with validation.
   */
  private initializeSDK(): CasdoorSDK.SDK {
    const requiredEnvVars = [
      'CASDOOR_URL',
      'CASDOOR_CLIENT_ID',
      'CASDOOR_CLIENT_SECRET',
      'CASDOOR_CERT',
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      logger.error(`Missing required Casdoor environment variables: ${missingEnvVars.join(', ')}`);
      throw new Error(`Missing required Casdoor environment variables: ${missingEnvVars.join(', ')}`);
    }

    // Clean certificate format
    const certificate = process.env.CASDOOR_CERT || '';
    const cleanedCert = certificate
      .split(/\\n|\n/)
      .map(line => line.trim())
      .join('\n');

    return new CasdoorSDK.SDK({
      endpoint: process.env.CASDOOR_URL || process.env.CASDOOR_ENDPOINT || 'http://localhost:8000',
      clientId: process.env.CASDOOR_CLIENT_ID || '',
      clientSecret: process.env.CASDOOR_CLIENT_SECRET || '',
      appName: process.env.CASDOOR_APP_NAME || 'bunker',
      orgName: process.env.CASDOOR_ORG_NAME || 'bunker',
      certificate: cleanedCert,
    });
  }

  /**
   * Gets the Casdoor SDK instance (lazy initialization).
   */
  getCasdoor(): CasdoorSDK.SDK {
    if (!this.instance) {
      this.instance = this.initializeSDK();
    }
    return this.instance;
  }

  /**
   * Parses and validates a JWT token.
   */
  async parseJwtToken(token: string) {
    return this.getCasdoor().parseJwtToken(token);
  }

  /**
   * Exchanges authorization code for access token.
   */
  async getAuthToken(code: string) {
    return this.getCasdoor().getAuthToken(code);
  }

  /**
   * Updates user information in Casdoor.
   */
  async updateUser(user: any) {
    return this.getCasdoor().updateUser(user);
  }
}

// Export singleton instance
export const casdoorService = new CasdoorService();

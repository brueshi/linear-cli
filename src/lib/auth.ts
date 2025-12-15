import { secrets } from './secrets.js';

const SERVICE_NAME = 'linear-cli';
const ACCOUNT_NAME = 'api-key';

/**
 * AuthManager handles secure storage and retrieval of Linear API keys
 * using the system's native credential storage.
 * 
 * Uses Bun.secrets when running under Bun, keytar for Node.js.
 * Both use the same underlying OS keychain APIs, so credentials
 * are interoperable between runtimes.
 */
export const AuthManager = {
  /**
   * Store an API key securely in the system keychain
   */
  async saveApiKey(apiKey: string): Promise<void> {
    await secrets.set(SERVICE_NAME, ACCOUNT_NAME, apiKey);
  },

  /**
   * Retrieve the stored API key from the system keychain
   * @returns The API key if found, null otherwise
   */
  async getApiKey(): Promise<string | null> {
    return secrets.get(SERVICE_NAME, ACCOUNT_NAME);
  },

  /**
   * Remove the stored API key from the system keychain
   * @returns true if a key was deleted, false if no key existed
   */
  async deleteApiKey(): Promise<boolean> {
    return secrets.delete(SERVICE_NAME, ACCOUNT_NAME);
  },

  /**
   * Check if an API key is currently stored
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== null;
  },
};

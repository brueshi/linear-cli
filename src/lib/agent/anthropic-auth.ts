import keytar from 'keytar';

const SERVICE_NAME = 'linear-cli-anthropic';
const ACCOUNT_NAME = 'api-key';

/**
 * AnthropicAuthManager handles secure storage and retrieval of Anthropic API keys
 * using the macOS Keychain via keytar.
 */
export const AnthropicAuthManager = {
  /**
   * Store an Anthropic API key securely in the system keychain
   */
  async saveApiKey(apiKey: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
  },

  /**
   * Retrieve the stored Anthropic API key from the system keychain
   * @returns The API key if found, null otherwise
   */
  async getApiKey(): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  },

  /**
   * Remove the stored Anthropic API key from the system keychain
   * @returns true if a key was deleted, false if no key existed
   */
  async deleteApiKey(): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  },

  /**
   * Check if an Anthropic API key is currently stored
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== null;
  },
};
